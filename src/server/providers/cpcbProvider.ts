/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  fetchWithReliability,
  InvalidResponseError,
  isPlaceholderOrMissingEnv,
  updateProviderState,
} from '../dataSourceManager.ts';

export interface CpcbRawStationRecord {
  station: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  lastUpdate: string | null;
  pollutantId: string;
  avgValue: number | null;
}

const CPCB_OGD_RESOURCE = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';
export const CPCB_PORTAL_URL = 'https://airquality.cpcb.gov.in/';

export async function fetchCpcbOdishaStations(forceRefresh = false): Promise<{
  available: boolean;
  records: CpcbRawStationRecord[];
  retrievedAt: string;
  isStale: boolean;
  reason?: string;
}> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY?.trim();
  const now = new Date().toISOString();

  if (isPlaceholderOrMissingEnv(apiKey)) {
    updateProviderState(
      'cpcb_ogd',
      'NOT CONFIGURED',
      'Missing or placeholder server environment variable: DATA_GOV_IN_API_KEY'
    );
    return {
      available: false,
      records: [],
      retrievedAt: now,
      isStale: false,
      reason: 'DATA_GOV_IN_API_KEY is not configured for official CPCB OGD station queries.',
    };
  }

  try {
    const url = `https://api.data.gov.in/resource/${CPCB_OGD_RESOURCE}?api-key=${encodeURIComponent(
      apiKey!
    )}&format=json&limit=500&filters[state]=Odisha`;

    const res = await fetchWithReliability<{
      records?: Array<Record<string, unknown>>;
    }>({
      providerId: 'cpcb_ogd',
      cacheKey: 'cpcb_odisha_ogd',
      url,
      cacheTtlMs: 300_000,
      timeoutMs: 7000,
      retries: 1,
      forceRefresh,
      validator: (raw) => {
        if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { records?: unknown }).records)) {
          throw new InvalidResponseError('Unexpected CPCB OGD response format');
        }
        return raw as { records: Array<Record<string, unknown>> };
      },
    });

    const parsed: CpcbRawStationRecord[] = (res.data.records || [])
      .map((r) => {
        const rawAvg = r.pollutant_avg ?? r.avg_value;
        const avg = rawAvg !== null && rawAvg !== undefined && rawAvg !== '' && rawAvg !== 'NA' ? Number(rawAvg) : NaN;
        const lat = Number(r.latitude);
        const lng = Number(r.longitude);
        return {
          station: String(r.station || '').trim(),
          city: String(r.city || '').trim(),
          state: String(r.state || 'Odisha').trim(),
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          lastUpdate: String(r.last_update || '').trim() || null,
          pollutantId: String(r.pollutant_id || '').toUpperCase().trim(),
          avgValue: Number.isFinite(avg) && avg >= 0 ? avg : null,
        };
      })
      .filter((rec) => rec.station.length > 0 && rec.pollutantId.length > 0);

    return {
      available: true,
      records: parsed,
      retrievedAt: res.retrievedAt,
      isStale: res.isStale,
    };
  } catch (err: unknown) {
    return {
      available: false,
      records: [],
      retrievedAt: now,
      isStale: false,
      reason: err instanceof Error ? err.message : 'CPCB OGD request failed',
    };
  }
}
