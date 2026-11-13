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

const IMD_DEFAULT_API = 'https://mausam.imd.gov.in/api/warnings_district_api.php';
const IMD_PORTAL_URL = 'https://mausam.imd.gov.in/';

export async function checkImdOfficialFeed(forceRefresh = false): Promise<{
  alerts: DisasterAlertRecord[];
  availability: OfficialFeedAvailability;
}> {
  const rawConfigured = process.env.IMD_AUTHORIZED_API_URL?.trim();
  const hasAuthorizedConfig = !isPlaceholderOrMissingEnv(rawConfigured);
  const now = new Date().toISOString();

  const targetUrl = hasAuthorizedConfig ? rawConfigured! : IMD_DEFAULT_API;

  try {
    const res = await fetchWithReliability<unknown>({
      providerId: 'imd_warnings',
      cacheKey: `imd_warnings:${targetUrl}`,
      url: targetUrl,
      cacheTtlMs: 300_000,
      timeoutMs: 5000,
      retries: 0,
      forceRefresh,
      validator: (raw) => {
        if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
          throw new InvalidResponseError('Unexpected IMD response payload');
        }
        if (!Array.isArray(raw)) {
          const obj = raw as Record<string, unknown>;
          if (!Array.isArray(obj.warnings) && !Array.isArray(obj.alerts) && !Array.isArray(obj.data)) {
            throw new InvalidResponseError('Unexpected IMD object structure (expected warnings/alerts/data array)');
          }
        }
        return raw;
      },
    });

    const rawItems = Array.isArray(res.data)
      ? res.data
      : ((res.data as Record<string, unknown>).warnings ||
          (res.data as Record<string, unknown>).alerts ||
          (res.data as Record<string, unknown>).data ||
          []) as unknown[];

    const alerts: DisasterAlertRecord[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const entry = rawItems[i] as Record<string, unknown>;
      const text = JSON.stringify(entry).toLowerCase();
      if (!text.includes('odisha') && !text.includes('bhubaneswar')) continue;
      alerts.push({
        id: `imd-${i}`,
        title: String(entry.District || entry.Subdivision || 'IMD Odisha District Warning'),
        hazardType: String(entry.Warning || entry.Hazard || 'Weather Warning'),
        severity: 'MODERATE',
        severityLabel: String(entry.Color || entry.Severity || 'IMD ADVISORY'),
        areaDescription: String(entry.District || 'Odisha'),
        districtIdsMatched: [],
        targetsOdisha: true,
        message: String(entry.Message || entry.Warning || 'Refer to IMD district bulletin.'),
        effectiveFrom: String(entry.Date || '') || null,
        effectiveUntil: null,
        recordClassification: 'official_government_alert',
        provenance: {
          sourceName: 'India Meteorological Department (IMD)',
          sourceUrl: IMD_PORTAL_URL,
          retrievedAt: res.retrievedAt,
          observedAt: String(entry.Date || '') || null,
          locationOrDistrict: String(entry.District || 'Odisha'),
          dataCategory: 'official_district_advisory',
          verificationStatus: 'verified',
          origin: 'official',
          isStale: res.isStale,
        },
      });
    }

    return {
      alerts,
      availability: {
        agency: 'India Meteorological Department (IMD)',
        category: 'official_district_advisory',
        available: true,
        status: res.isStale ? 'STALE DATA' : 'CONNECTED',
        message: `Connected to authorized IMD district endpoint (${alerts.length} Odisha records).`,
        officialUrl: IMD_PORTAL_URL,
        lastCheckedAt: res.retrievedAt,
      },
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'IMD API unreachable';
    const providerState = getProviderState('imd_warnings');

    if (!hasAuthorizedConfig) {
      updateProviderState(
        'imd_warnings',
        'NOT CONFIGURED',
        `IMD API requires server IP whitelisting or authorized IMD_AUTHORIZED_API_URL (${errMsg})`
      );
      return {
        alerts: [],
        availability: {
          agency: 'India Meteorological Department (IMD)',
          category: 'official_district_advisory',
          available: false,
          status: 'NOT CONFIGURED',
          message:
            errMsg.includes('401') || errMsg.includes('403')
              ? 'IMD district warning API returned HTTP 401/403 (server IP whitelisting required by IMD). Configure an authorized IMD_AUTHORIZED_API_URL.'
              : `IMD_AUTHORIZED_API_URL is not configured and default public probe could not authenticate (${errMsg}).`,
          officialUrl: IMD_PORTAL_URL,
          lastCheckedAt: now,
        },
      };
    }

    // Preserve actual error classification (INVALID RESPONSE, TEMPORARILY UNAVAILABLE, NOT CONFIGURED on 401/403)
    return {
      alerts: [],
      availability: {
        agency: 'India Meteorological Department (IMD)',
        category: 'official_district_advisory',
        available: false,
        status: providerState.status,
        message: `Configured IMD feed check failed: ${errMsg}`,
        officialUrl: IMD_PORTAL_URL,
        lastCheckedAt: now,
      },
    };
  }
}
