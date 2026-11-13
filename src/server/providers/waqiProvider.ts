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

export const WAQI_PORTAL_URL = 'https://aqicn.org/';

export interface WaqiStationEntry {
  uid: number;
  name: string;
  lat: number;
  lng: number;
  usAqi: number | null;
  observedAt: string | null;
}

export async function fetchWaqiOdishaStations(forceRefresh = false): Promise<{
  available: boolean;
  stations: WaqiStationEntry[];
  retrievedAt: string;
  isStale: boolean;
  reason?: string;
}> {
  const token = process.env.WAQI_API_TOKEN?.trim();
  const now = new Date().toISOString();

  if (isPlaceholderOrMissingEnv(token)) {
    updateProviderState(
      'waqi',
      'NOT CONFIGURED',
      'Missing or placeholder server environment variable: WAQI_API_TOKEN'
    );
    return {
      available: false,
      stations: [],
      retrievedAt: now,
      isStale: false,
      reason: 'WAQI_API_TOKEN is not configured.',
    };
  }

  try {
    const url = `https://api.waqi.info/v2/map/bounds?latlng=17.75,81.3,22.6,87.55&token=${encodeURIComponent(
      token!
    )}`;

    const res = await fetchWithReliability<{
      status?: string;
      data?: Array<{
        uid?: number;
        aqi?: string | number;
        lat?: number;
        lon?: number;
        station?: { name?: string; time?: string };
      }> | string;
    }>({
      providerId: 'waqi',
      cacheKey: 'waqi_odisha_bounds',
      url,
      cacheTtlMs: 300_000,
      timeoutMs: 6500,
      retries: 1,
      forceRefresh,
      validator: (raw) => {
        const obj = raw as { status?: string; data?: unknown };
        if (!obj || obj.status !== 'ok' || !Array.isArray(obj.data)) {
          throw new InvalidResponseError(
            typeof obj?.data === 'string' ? `WAQI error: ${obj.data}` : 'Unexpected WAQI response'
          );
        }
        return obj as {
          status: string;
          data: Array<{
            uid?: number;
            aqi?: string | number;
            lat?: number;
            lon?: number;
            station?: { name?: string; time?: string };
          }>;
        };
      },
    });

    const list = Array.isArray(res.data.data) ? res.data.data : [];
    const stations: WaqiStationEntry[] = list
      .filter(
        (s) =>
          typeof s.lat === 'number' &&
          typeof s.lon === 'number' &&
          typeof s.station?.name === 'string' &&
          s.station.name.trim().length > 0
      )
      .map((s) => {
        const parsedAqi = s.aqi !== '-' && s.aqi !== '' && s.aqi !== null ? Number(s.aqi) : NaN;
        return {
          uid: Number(s.uid ?? 0),
          name: String(s.station?.name).trim(),
          lat: Number(s.lat),
          lng: Number(s.lon),
          usAqi: Number.isFinite(parsedAqi) && parsedAqi >= 0 ? parsedAqi : null,
          observedAt: s.station?.time || null,
        };
      })
      .filter((s) => s.usAqi !== null);

    return {
      available: true,
      stations,
      retrievedAt: res.retrievedAt,
      isStale: res.isStale,
    };
  } catch (err: unknown) {
    return {
      available: false,
      stations: [],
      retrievedAt: now,
      isStale: false,
      reason: err instanceof Error ? err.message : 'WAQI request failed',
    };
  }
}
