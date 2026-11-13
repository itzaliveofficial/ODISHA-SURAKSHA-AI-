/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type {
  DisasterAlertRecord,
  DisasterAlertsResponse,
  OfficialFeedAvailability,
} from '../types/disaster.ts';
import {
  getCustomFeedUrls,
  fetchWithReliability,
  getProviderState,
  InvalidResponseError,
  isPlaceholderOrMissingEnv,
} from './dataSourceManager.ts';
import { fetchNdmaSachetAlerts } from './providers/ndmaSachetProvider.ts';
import { checkImdOfficialFeed } from './providers/imdProvider.ts';
import { checkOsdmaAndCwcFeeds } from './providers/osdmaProvider.ts';
import {
  fetchGdacsIndiaEvents,
  fetchUsgsOdishaEarthquakes,
  fetchNasaEonetRegionalEvents,
} from './providers/globalDisasterProviders.ts';
import { GEMINI_TRIAGE_MODEL } from './aiTriageHandler.ts';

async function fetchCustomConfiguredFeeds(forceRefresh = false): Promise<DisasterAlertRecord[]> {
  const urls = getCustomFeedUrls();
  if (urls.length === 0) return [];
  const results: DisasterAlertRecord[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const res = await fetchWithReliability<unknown>({
        providerId: `custom_feed_${i}`,
        cacheKey: `custom_feed:${url}`,
        url,
        cacheTtlMs: 300_000,
        timeoutMs: 5000,
        retries: 0,
        forceRefresh,
        validator: (raw) => {
          if (!raw || typeof raw !== 'object') {
            throw new InvalidResponseError('Invalid custom JSON feed');
          }
          return raw;
        },
      });
      const arr = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as { alerts?: unknown[] }).alerts)
        ? ((res.data as { alerts: unknown[] }).alerts)
        : [];
      arr.slice(0, 10).forEach((item: unknown, idx: number) => {
        const obj = (item || {}) as Record<string, unknown>;
        results.push({
          id: `custom-${i}-${idx}`,
          title: String(obj.title || obj.headline || 'Configured Custom Feed Record'),
          hazardType: String(obj.hazardType || obj.event || 'Advisory'),
          severity: 'INFO',
          severityLabel: String(obj.severity || 'CUSTOM FEED'),
          areaDescription: String(obj.area || obj.district || 'Configured Scope'),
          districtIdsMatched: [],
          targetsOdisha: true,
          message: String(obj.message || obj.description || obj.summary || 'See source URL.'),
          effectiveFrom: String(obj.timestamp || obj.publishedAt || '') || null,
          effectiveUntil: null,
          recordClassification: 'secondary_external_info',
          provenance: {
            sourceName: String(obj.sourceName || new URL(url).hostname),
            sourceUrl: url,
            retrievedAt: res.retrievedAt,
            observedAt: String(obj.timestamp || '') || null,
            locationOrDistrict: String(obj.area || 'Configured Feed'),
            dataCategory: 'external_contextual_info',
            verificationStatus: 'verified',
            origin: 'secondary',
            isStale: res.isStale,
          },
        });
      });
    } catch {
      // Custom feed failures are non-fatal
    }
  }
  return results;
}

export async function getLiveDisasterAlerts(forceRefresh = false): Promise<DisasterAlertsResponse> {
  const now = new Date().toISOString();

  const [sachetRes, imdRes, osdmaCwcRes, gdacsRes, usgsRes, eonetRes, customRes] =
    await Promise.allSettled([
      fetchNdmaSachetAlerts(forceRefresh),
      checkImdOfficialFeed(forceRefresh),
      checkOsdmaAndCwcFeeds(forceRefresh),
      fetchGdacsIndiaEvents(forceRefresh),
      fetchUsgsOdishaEarthquakes(forceRefresh),
      fetchNasaEonetRegionalEvents(forceRefresh),
      fetchCustomConfiguredFeeds(forceRefresh),
    ]);

  let odishaAlerts: DisasterAlertRecord[] = [];
  let nationalCapAlerts: DisasterAlertRecord[] = [];
  const feedStatuses: OfficialFeedAvailability[] = [];

  if (sachetRes.status === 'fulfilled') {
    odishaAlerts = [...odishaAlerts, ...sachetRes.value.odishaAlerts];
    nationalCapAlerts = sachetRes.value.nationalAlerts;
    feedStatuses.push({
      agency: 'NDMA SACHET (CAP Alert Portal)',
      category: 'official_disaster_alert',
      available: true,
      status: sachetRes.value.isStale ? 'STALE DATA' : 'CONNECTED',
      message: `Connected (${sachetRes.value.odishaAlerts.length} active Odisha CAP alerts; ${sachetRes.value.nationalAlerts.length} national CAP alerts).`,
      officialUrl: 'https://sachet.ndma.gov.in/',
      lastCheckedAt: sachetRes.value.retrievedAt,
    });
  } else {
    const errMsg =
      sachetRes.reason instanceof Error ? sachetRes.reason.message : 'NDMA SACHET unreachable';
    const state = getProviderState('ndma_sachet');
    feedStatuses.push({
      agency: 'NDMA SACHET (CAP Alert Portal)',
      category: 'official_disaster_alert',
      available: false,
      status: state.status,
      message: errMsg,
      officialUrl: 'https://sachet.ndma.gov.in/',
      lastCheckedAt: now,
    });
  }

  if (imdRes.status === 'fulfilled') {
    odishaAlerts = [...odishaAlerts, ...imdRes.value.alerts];
    feedStatuses.push(imdRes.value.availability);
  }

  if (osdmaCwcRes.status === 'fulfilled') {
    odishaAlerts = [...odishaAlerts, ...osdmaCwcRes.value.alerts];
    feedStatuses.push(...osdmaCwcRes.value.availabilities);
  }

  const secondaryRegionalEvents: DisasterAlertRecord[] = [
    ...(gdacsRes.status === 'fulfilled' ? gdacsRes.value : []),
    ...(usgsRes.status === 'fulfilled' ? usgsRes.value.events : []),
    ...(eonetRes.status === 'fulfilled' ? eonetRes.value : []),
    ...(customRes.status === 'fulfilled' ? customRes.value : []),
  ];

  return {
    fetchedAt: now,
    odishaAlerts,
    nationalCapAlerts,
    secondaryRegionalEvents,
    officialFeedStatuses: feedStatuses,
    disclaimer:
      'Live Verified Mode separates active official CAP alerts (NDMA SACHET), restricted/unconfigured official portals (IMD/OSDMA/CWC), and secondary external contextual feeds (GDACS/USGS/NASA EONET). Missing official feeds are never fabricated.',
  };
}

export async function summarizeVerifiedAlertsWithGemini(
  alertsPayload: DisasterAlertsResponse
): Promise<{
  summary: string;
  usedGemini: boolean;
  reason?: string;
}> {
  const totalCount =
    alertsPayload.odishaAlerts.length +
    alertsPayload.nationalCapAlerts.length +
    alertsPayload.secondaryRegionalEvents.length;

  if (totalCount === 0) {
    return {
      summary:
        'Information unavailable: zero active official CAP alerts or regional external events were retrieved from live feeds. Gemini cannot invent alerts where none are published.',
      usedGemini: false,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (isPlaceholderOrMissingEnv(apiKey)) {
    return {
      summary: `Retrieved ${alertsPayload.odishaAlerts.length} active Odisha official CAP alert(s), ${alertsPayload.nationalCapAlerts.length} India CAP alert(s), and ${alertsPayload.secondaryRegionalEvents.length} regional contextual event(s). Configure GEMINI_API_KEY on the server to enable AI briefing synthesis.`,
      usedGemini: false,
      reason: 'GEMINI_API_KEY not configured.',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const groundedRecords = {
      fetchedAt: alertsPayload.fetchedAt,
      odishaOfficialAlerts: alertsPayload.odishaAlerts.map((a) => ({
        title: a.title,
        severity: a.severityLabel,
        area: a.areaDescription,
        message: a.message,
        source: a.provenance.sourceName,
        observedAt: a.provenance.observedAt,
      })),
      nationalCapCount: alertsPayload.nationalCapAlerts.length,
      secondaryRegionalEvents: alertsPayload.secondaryRegionalEvents.slice(0, 6).map((e) => ({
        title: e.title,
        hazard: e.hazardType,
        severity: e.severityLabel,
        message: e.message,
        source: e.provenance.sourceName,
        observedAt: e.provenance.observedAt,
      })),
      unavailableFeeds: alertsPayload.officialFeedStatuses
        .filter((f) => !f.available)
        .map((f) => `${f.agency}: ${f.status}`),
    };

    const response = await ai.models.generateContent({
      model: GEMINI_TRIAGE_MODEL,
      contents: `Summarize ONLY the following retrieved disaster alert records for Odisha disaster preparedness operators. Do NOT invent any alerts, rainfall values, river gauges, or warnings not present in the JSON. Explicitly mention unavailable feeds if asked about state-level data.\n\nDATA:\n${JSON.stringify(
        groundedRecords
      )}`,
      config: {
        systemInstruction:
          'You are a strict disaster telemetry summarizer. Only restate facts present in the supplied JSON records, cite exact source names, and clearly state when Odisha-specific official alerts are 0 or feeds are unavailable. Max 4 concise bullet sentences.',
      },
    });

    const text = (response.text || '').trim();
    if (!text) {
      throw new Error('Empty response from Gemini.');
    }
    return { summary: text, usedGemini: true };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Gemini request failed';
    return {
      summary: `Retrieved ${alertsPayload.odishaAlerts.length} Odisha alert(s), ${alertsPayload.nationalCapAlerts.length} India CAP alert(s), and ${alertsPayload.secondaryRegionalEvents.length} regional contextual event(s). (AI summary unavailable: ${reason})`,
      usedGemini: false,
      reason,
    };
  }
}
