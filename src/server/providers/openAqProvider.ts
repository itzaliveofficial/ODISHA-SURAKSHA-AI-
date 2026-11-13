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

export const OPENAQ_DOCS_URL = 'https://docs.openaq.org/';

export interface OpenAqLocationSummary {
  id: number;
  name: string;
  city: string;
  lat: number;
  lng: number;
  observedAt: string | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  coMgM3: number | null;
  o3: number | null;
}

export async function fetchOpenAqOdishaStations(forceRefresh = false): Promise<{
  available: boolean;
  stations: OpenAqLocationSummary[];
  retrievedAt: string;
  isStale: boolean;
  reason?: string;
}> {
  const apiKey = process.env.OPENAQ_API_KEY?.trim();
  const now = new Date().toISOString();

  if (isPlaceholderOrMissingEnv(apiKey)) {
    updateProviderState(
      'openaq',
      'NOT CONFIGURED',
      'Missing or placeholder server environment variable: OPENAQ_API_KEY'
    );
    return {
      available: false,
      stations: [],
      retrievedAt: now,
      isStale: false,
      reason: 'OPENAQ_API_KEY is not configured for OpenAQ v3 X-API-Key authentication.',
    };
  }

  try {
    const url = 'https://api.openaq.org/v3/locations?bbox=81.3,17.75,87.55,22.6&limit=50';
    interface OpenAqApiResponse {
      results?: Array<{
        id: number;
        name?: string;
        locality?: string;
        coordinates?: { latitude?: number; longitude?: number };
        datetimeLast?: { utc?: string };
        sensors?: Array<{
          parameter?: { name?: string };
          latest?: { value?: number };
        }>;
      }>;
    }
    const res = await fetchWithReliability<OpenAqApiResponse>({
      providerId: 'openaq',
      cacheKey: 'openaq_odisha_v3',
      url,
      cacheTtlMs: 300_000,
      timeoutMs: 7000,
      retries: 1,
      forceRefresh,
      headers: { 'X-API-Key': apiKey! },
      validator: (raw): OpenAqApiResponse => {
        if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { results?: unknown }).results)) {
          throw new InvalidResponseError('Unexpected OpenAQ v3 response format');
        }
        return raw as OpenAqApiResponse;
      },
    });

    const stations: OpenAqLocationSummary[] = (res.data.results || [])
      .filter(
        (loc) =>
          typeof loc.id === 'number' &&
          Number.isFinite(loc.coordinates?.latitude) &&
          Number.isFinite(loc.coordinates?.longitude)
      )
      .map((loc) => {
        const readParam = (names: string[]): number | null => {
          const match = loc.sensors?.find((s) =>
            names.includes((s.parameter?.name || '').toLowerCase())
          );
          const rawVal = match?.latest?.value;
          const v = rawVal !== null && rawVal !== undefined ? Number(rawVal) : NaN;
          return Number.isFinite(v) && v >= 0 ? v : null;
        };
        const coRaw = readParam(['co']);
        return {
          id: loc.id,
          name: String(loc.name || '').trim(),
          city: String(loc.locality || loc.name || '').trim(),
          lat: Number(loc.coordinates!.latitude),
          lng: Number(loc.coordinates!.longitude),
          observedAt: loc.datetimeLast?.utc || null,
          pm25: readParam(['pm25']),
          pm10: readParam(['pm10']),
          no2: readParam(['no2']),
          so2: readParam(['so2']),
          coMgM3: coRaw !== null ? Number((coRaw > 50 ? coRaw / 1000 : coRaw).toFixed(2)) : null,
          o3: readParam(['o3']),
        };
      })
      .filter(
        (s) =>
          s.name.length > 0 &&
          (s.pm25 !== null ||
            s.pm10 !== null ||
            s.no2 !== null ||
            s.so2 !== null ||
            s.coMgM3 !== null ||
            s.o3 !== null)
      );

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
      reason: err instanceof Error ? err.message : 'OpenAQ request failed',
    };
  }
}
