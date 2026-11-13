/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DisasterAlertRecord, OfficialFeedAvailability } from '../../types/disaster.ts';
import {
  fetchWithReliability,
  getProviderState,
  InvalidResponseError,
  isPlaceholderOrMissingEnv,
  updateProviderState,
} from '../dataSourceManager.ts';

const OSDMA_PORTAL_URL = 'https://www.osdma.org/';
const CWC_PORTAL_URL = 'https://ffs.india-water.gov.in/';

export async function checkOsdmaAndCwcFeeds(forceRefresh = false): Promise<{
  alerts: DisasterAlertRecord[];
  availabilities: OfficialFeedAvailability[];
}> {
  const now = new Date().toISOString();
  const alerts: DisasterAlertRecord[] = [];
  const availabilities: OfficialFeedAvailability[] = [];

  // 1. OSDMA Authorized Feed (if configured)
  const osdmaUrlRaw = process.env.OSDMA_AUTHORIZED_FEED_URL?.trim();
  const osdmaConfigured = !isPlaceholderOrMissingEnv(osdmaUrlRaw);
  if (!osdmaConfigured) {
    updateProviderState(
      'osdma',
      'NOT CONFIGURED',
      'OSDMA portal does not expose a public machine-readable JSON/RSS endpoint. Configure OSDMA_AUTHORIZED_FEED_URL if authorized.'
    );
    availabilities.push({
      agency: 'Odisha State Disaster Management Authority (OSDMA)',
      category: 'official_district_advisory',
      available: false,
      status: 'NOT CONFIGURED',
      message:
        'No public unauthenticated machine-readable API is exposed by osdma.org. State CAP warnings disseminate via NDMA SACHET unless OSDMA_AUTHORIZED_FEED_URL is set.',
      officialUrl: OSDMA_PORTAL_URL,
      lastCheckedAt: now,
    });
  } else {
    const osdmaUrl = osdmaUrlRaw!;
    try {
      const res = await fetchWithReliability<unknown>({
        providerId: 'osdma',
        cacheKey: `osdma:${osdmaUrl}`,
        url: osdmaUrl,
        cacheTtlMs: 180_000,
        timeoutMs: 6000,
        retries: 1,
        forceRefresh,
        validator: (raw) => {
          if (Array.isArray(raw)) return raw;
          if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            if (Array.isArray(obj.alerts)) return obj.alerts;
            if (Array.isArray(obj.advisories)) return obj.advisories;
            if (Array.isArray(obj.data)) return obj.data;
          }
          throw new InvalidResponseError('Invalid OSDMA JSON response (expected array or { alerts/advisories/data })');
        },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      list.forEach((row: Record<string, unknown>, idx) => {
        alerts.push({
          id: `osdma-${idx}`,
          title: String(row.title || row.subject || 'OSDMA Advisory'),
          hazardType: String(row.hazardType || 'State Advisory'),
          severity: 'MODERATE',
          severityLabel: String(row.severity || 'ADVISORY'),
          areaDescription: String(row.district || 'Odisha'),
          districtIdsMatched: [],
          targetsOdisha: true,
          message: String(row.message || row.description || ''),
          effectiveFrom: String(row.publishedAt || '') || null,
          effectiveUntil: null,
          recordClassification: 'official_government_alert',
          provenance: {
            sourceName: 'OSDMA Official Feed',
            sourceUrl: OSDMA_PORTAL_URL,
            retrievedAt: res.retrievedAt,
            observedAt: String(row.publishedAt || '') || null,
            locationOrDistrict: String(row.district || 'Odisha'),
            dataCategory: 'official_district_advisory',
            verificationStatus: 'verified',
            origin: 'official',
            isStale: res.isStale,
          },
        });
      });
      availabilities.push({
        agency: 'Odisha State Disaster Management Authority (OSDMA)',
        category: 'official_district_advisory',
        available: true,
        status: res.isStale ? 'STALE DATA' : 'CONNECTED',
        message: `Connected (${alerts.length} advisories retrieved).`,
        officialUrl: OSDMA_PORTAL_URL,
        lastCheckedAt: res.retrievedAt,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OSDMA feed error';
      const state = getProviderState('osdma');
      availabilities.push({
        agency: 'Odisha State Disaster Management Authority (OSDMA)',
        category: 'official_district_advisory',
        available: false,
        status: state.status,
        message: msg,
        officialUrl: OSDMA_PORTAL_URL,
        lastCheckedAt: now,
      });
    }
  }

  // 2. Central Water Commission (CWC) River/Flood Forecast
  const cwcUrlRaw = process.env.CWC_AUTHORIZED_FEED_URL?.trim();
  const cwcConfigured = !isPlaceholderOrMissingEnv(cwcUrlRaw);
  if (!cwcConfigured) {
    updateProviderState(
      'cwc_flood',
      'NOT CONFIGURED',
      'CWC Flood Forecasting portal does not expose an unauthenticated public REST API. Configure CWC_AUTHORIZED_FEED_URL if authorized.'
    );
    availabilities.push({
      agency: 'Central Water Commission (CWC) Flood Forecast',
      category: 'river_flood_info',
      available: false,
      status: 'NOT CONFIGURED',
      message:
        'Public unauthenticated river-gauge API is unavailable from ffs.india-water.gov.in; live river stages are not fabricated.',
      officialUrl: CWC_PORTAL_URL,
      lastCheckedAt: now,
    });
  } else {
    const cwcUrl = cwcUrlRaw!;
    try {
      const res = await fetchWithReliability<unknown>({
        providerId: 'cwc_flood',
        cacheKey: `cwc:${cwcUrl}`,
        url: cwcUrl,
        cacheTtlMs: 300_000,
        timeoutMs: 6000,
        retries: 1,
        forceRefresh,
        validator: (raw) => {
          if (Array.isArray(raw)) return raw;
          if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            if (
              Array.isArray(obj.stations) ||
              Array.isArray(obj.rivers) ||
              Array.isArray(obj.data) ||
              Array.isArray(obj.forecasts)
            ) {
              return raw;
            }
          }
          throw new InvalidResponseError('Invalid CWC JSON response (expected array or { stations/rivers/data/forecasts })');
        },
      });
      availabilities.push({
        agency: 'Central Water Commission (CWC) Flood Forecast',
        category: 'river_flood_info',
        available: true,
        status: res.isStale ? 'STALE DATA' : 'CONNECTED',
        message: 'Connected to authorized CWC river telemetry endpoint.',
        officialUrl: CWC_PORTAL_URL,
        lastCheckedAt: res.retrievedAt,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'CWC feed error';
      const state = getProviderState('cwc_flood');
      availabilities.push({
        agency: 'Central Water Commission (CWC) Flood Forecast',
        category: 'river_flood_info',
        available: false,
        status: state.status,
        message: msg,
        officialUrl: CWC_PORTAL_URL,
        lastCheckedAt: now,
      });
    }
  }

  return { alerts, availabilities };
}
