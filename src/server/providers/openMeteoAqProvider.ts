/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchWithReliability, InvalidResponseError } from '../dataSourceManager.ts';

export const OPEN_METEO_AQ_DOCS = 'https://open-meteo.com/en/docs/air-quality-api';

export interface OpenMeteoAqReading {
  lat: number;
  lng: number;
  observedAt: string | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  coMgM3: number | null;
  o3: number | null;
  usAqi: number | null;
  europeanAqi: number | null;
}

export async function fetchOpenMeteoAqBatch(
  coords: Array<{ lat: number; lng: number }>,
  forceRefresh = false
): Promise<{
  readings: OpenMeteoAqReading[];
  retrievedAt: string;
  isStale: boolean;
}> {
  if (coords.length === 0) {
    return { readings: [], retrievedAt: new Date().toISOString(), isStale: false };
  }

  const lats = coords.map((c) => c.lat.toFixed(4)).join(',');
  const lngs = coords.map((c) => c.lng.toFixed(4)).join(',');
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi&timezone=Asia%2FKolkata`;

  const res = await fetchWithReliability<
    Array<{ current?: Record<string, unknown> }> | { current?: Record<string, unknown> }
  >({
    providerId: 'open_meteo_aq',
    cacheKey: `open_meteo_aq_batch:${lats}:${lngs}`,
    url,
    cacheTtlMs: 300_000,
    timeoutMs: 7000,
    retries: 1,
    forceRefresh,
    validator: (raw) => {
      if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
        throw new InvalidResponseError('Unexpected Open-Meteo Air Quality payload');
      }
      const list = Array.isArray(raw) ? raw : [raw];
      if (list.length !== coords.length) {
        throw new InvalidResponseError(`Unexpected Open-Meteo batch length (${list.length} vs ${coords.length})`);
      }
      for (const item of list) {
        if (!item || typeof item !== 'object' || !item.current || typeof item.current !== 'object') {
          throw new InvalidResponseError('Missing current air-quality block in Open-Meteo response');
        }
      }
      return list;
    },
  });

  const items = Array.isArray(res.data) ? res.data : [res.data];
  const readings: OpenMeteoAqReading[] = items.map((item, idx) => {
    const c = (item.current || {}) as Record<string, unknown>;
    const numOrNull = (val: unknown): number | null => {
      const n = Number(val);
      return val !== null && val !== undefined && Number.isFinite(n) ? n : null;
    };
    const coUgM3 = numOrNull(c.carbon_monoxide);

    return {
      lat: coords[idx].lat,
      lng: coords[idx].lng,
      observedAt: typeof c.time === 'string' ? `${c.time}:00+05:30` : null,
      pm25: numOrNull(c.pm2_5),
      pm10: numOrNull(c.pm10),
      no2: numOrNull(c.nitrogen_dioxide),
      so2: numOrNull(c.sulphur_dioxide),
      coMgM3: coUgM3 !== null ? Number((coUgM3 / 1000).toFixed(2)) : null,
      o3: numOrNull(c.ozone),
      usAqi: numOrNull(c.us_aqi),
      europeanAqi: numOrNull(c.european_aqi),
    };
  });

  return {
    readings,
    retrievedAt: res.retrievedAt,
    isStale: res.isStale,
  };
}
