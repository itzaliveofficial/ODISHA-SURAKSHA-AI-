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

export const IQAIR_PORTAL_URL = 'https://www.iqair.com/india/odisha';

export interface IqAirCityObservation {
  city: string;
  usAqi: number | null;
  observedAt: string | null;
}

export async function fetchIqAirOdishaCity(
  city: string,
  forceRefresh = false
): Promise<{
  available: boolean;
  observation?: IqAirCityObservation;
  retrievedAt: string;
  isStale: boolean;
  reason?: string;
}> {
  const apiKey = process.env.IQAIR_API_KEY?.trim();
  const now = new Date().toISOString();

  if (isPlaceholderOrMissingEnv(apiKey)) {
    updateProviderState(
      'iqair',
      'NOT CONFIGURED',
      'Missing or placeholder server environment variable: IQAIR_API_KEY'
    );
    return {
      available: false,
      retrievedAt: now,
      isStale: false,
      reason: 'IQAIR_API_KEY is not configured.',
    };
  }

  try {
    const url = `https://api.airvisual.com/v2/city?city=${encodeURIComponent(
      city
    )}&state=Odisha&country=India&key=${encodeURIComponent(apiKey!)}`;

    const res = await fetchWithReliability<{
      status?: string;
      data?: {
        city?: string;
        current?: {
          pollution?: { aqius?: number; ts?: string };
        };
      };
    }>({
      providerId: 'iqair',
      cacheKey: `iqair:${city.toLowerCase()}`,
      url,
      cacheTtlMs: 600_000,
      timeoutMs: 6500,
      retries: 0,
      forceRefresh,
      validator: (raw) => {
        const obj = raw as { status?: string; data?: { message?: string } };
        if (!obj || obj.status !== 'success') {
          throw new InvalidResponseError(obj?.data?.message || 'Unexpected IQAir response');
        }
        return obj as {
          status: string;
          data: { city?: string; current?: { pollution?: { aqius?: number; ts?: string } } };
        };
      },
    });

    const p = res.data.data?.current?.pollution;
    return {
      available: true,
      observation: {
        city: res.data.data?.city || city,
        usAqi: typeof p?.aqius === 'number' ? p.aqius : null,
        observedAt: p?.ts || null,
      },
      retrievedAt: res.retrievedAt,
      isStale: res.isStale,
    };
  } catch (err: unknown) {
    return {
      available: false,
      retrievedAt: now,
      isStale: false,
      reason: err instanceof Error ? err.message : 'IQAir request failed',
    };
  }
}
