/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LiveHubWeather, LiveWeatherResponse } from '../types/disaster.ts';
import { InvalidResponseError, updateProviderState } from './dataSourceManager.ts';

interface OdishaWeatherHubConfig {
  id: string;
  hubName: string;
  districtId: string;
  corridorLabel: string;
  lat: number;
  lng: number;
}

const ODISHA_WEATHER_HUBS: OdishaWeatherHubConfig[] = [
  {
    id: 'bhubaneswar',
    hubName: 'Bhubaneswar',
    districtId: 'khordha',
    corridorLabel: 'State Capital · Khordha',
    lat: 20.2961,
    lng: 85.8245,
  },
  {
    id: 'cuttack',
    hubName: 'Cuttack',
    districtId: 'cuttack',
    corridorLabel: 'Mahanadi Delta Hub',
    lat: 20.4625,
    lng: 85.8830,
  },
  {
    id: 'puri',
    hubName: 'Puri',
    districtId: 'puri',
    corridorLabel: 'Coastal Surge Belt',
    lat: 19.8135,
    lng: 85.8312,
  },
  {
    id: 'balasore',
    hubName: 'Balasore',
    districtId: 'balasore',
    corridorLabel: 'North Coast · Subarnarekha',
    lat: 21.4934,
    lng: 86.9135,
  },
  {
    id: 'sambalpur',
    hubName: 'Sambalpur',
    districtId: 'sambalpur',
    corridorLabel: 'Western · Hirakud Basin',
    lat: 21.4669,
    lng: 83.9812,
  },
  {
    id: 'berhampur',
    hubName: 'Berhampur',
    districtId: 'ganjam',
    corridorLabel: 'South Coast · Ganjam',
    lat: 19.3150,
    lng: 84.7941,
  },
];

const WEATHER_DISCLAIMER =
  'Live surface meteorological observations only (wttr.in / Open-Meteo). Weather metrics are not flood predictions or official IMD/OSDMA warnings.';

const CACHE_TTL_MS = 120_000;
let cachedHubsWeather: { data: LiveWeatherResponse; expiresAt: number } | null = null;
const locationCache = new Map<string, { data: LiveHubWeather; expiresAt: number }>();

function mapWmoCodeToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Fog / Mist';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow / Sleet';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Overcast';
}

function compassDirectionFromDegrees(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

function requireFiniteNum(val: unknown, fieldName: string): number {
  const num = Number(val);
  if (val === undefined || val === null || val === '' || !Number.isFinite(num)) {
    throw new InvalidResponseError(`Invalid or missing numeric field "${fieldName}" in weather payload`);
  }
  return num;
}

async function fetchSingleFromWttr(hub: OdishaWeatherHubConfig): Promise<LiveHubWeather> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://wttr.in/${hub.lat},${hub.lng}?format=j1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OdishaSurakshaAI/2.0',
      },
    });
    if (!response.ok) {
      throw new Error(`wttr.in returned HTTP ${response.status} for ${hub.hubName}`);
    }
    const json = (await response.json()) as {
      current_condition?: Array<{
        temp_C?: string;
        FeelsLikeC?: string;
        humidity?: string;
        windspeedKmph?: string;
        winddir16Point?: string;
        weatherDesc?: Array<{ value?: string }>;
        weatherCode?: string;
        precipMM?: string;
        pressure?: string;
      }>;
    };
    const current = json.current_condition?.[0];
    if (!current) {
      throw new InvalidResponseError(`Missing current_condition payload for ${hub.hubName}`);
    }
    const temperatureC = requireFiniteNum(current.temp_C, 'temp_C');
    const humidityPercent = requireFiniteNum(current.humidity, 'humidity');
    const windSpeedKmph = requireFiniteNum(current.windspeedKmph, 'windspeedKmph');

    const now = new Date().toISOString();
    return {
      id: hub.id,
      hubName: hub.hubName,
      districtId: hub.districtId,
      corridorLabel: hub.corridorLabel,
      temperatureC,
      feelsLikeC: Number.isFinite(Number(current.FeelsLikeC)) ? Number(current.FeelsLikeC) : temperatureC,
      humidityPercent,
      windSpeedKmph,
      windDirection: current.winddir16Point || 'N',
      condition: current.weatherDesc?.[0]?.value || 'Clear',
      weatherCode: Number.isFinite(Number(current.weatherCode)) ? Number(current.weatherCode) : 113,
      precipMm: Number.isFinite(Number(current.precipMM)) ? Number(current.precipMM) : 0,
      pressureHpa: Number.isFinite(Number(current.pressure)) ? Number(current.pressure) : 1013,
      source: 'wttr.in (Live)',
      sourceUrl: `https://wttr.in/${hub.lat},${hub.lng}`,
      observedAt: now,
      retrievedAt: now,
      isStale: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBatchFromOpenMeteo(hubConfigs: OdishaWeatherHubConfig[]): Promise<LiveHubWeather[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);
  try {
    const lats = hubConfigs.map((h) => h.lat).join(',');
    const lngs = hubConfigs.map((h) => h.lng).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&timezone=Asia%2FKolkata`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Open-Meteo returned HTTP ${response.status}`);
    }
    const raw = (await response.json()) as
      | Array<{ current?: Record<string, unknown> }>
      | { current?: Record<string, unknown> };

    const items = Array.isArray(raw) ? raw : [raw];
    if (items.length !== hubConfigs.length) {
      throw new InvalidResponseError('Unexpected Open-Meteo weather batch length');
    }

    const now = new Date().toISOString();
    return hubConfigs.map((hub, index) => {
      const current = items[index]?.current;
      if (!current || typeof current !== 'object') {
        throw new InvalidResponseError(`Missing Open-Meteo current object for ${hub.hubName}`);
      }
      const temp = requireFiniteNum(current.temperature_2m, 'temperature_2m');
      const humidity = requireFiniteNum(current.relative_humidity_2m, 'relative_humidity_2m');
      const wind = requireFiniteNum(current.wind_speed_10m, 'wind_speed_10m');
      const code = Number.isFinite(Number(current.weather_code)) ? Number(current.weather_code) : 0;

      return {
        id: hub.id,
        hubName: hub.hubName,
        districtId: hub.districtId,
        corridorLabel: hub.corridorLabel,
        temperatureC: Math.round(temp * 10) / 10,
        feelsLikeC: Number.isFinite(Number(current.apparent_temperature))
          ? Math.round(Number(current.apparent_temperature) * 10) / 10
          : Math.round(temp * 10) / 10,
        humidityPercent: Math.round(humidity),
        windSpeedKmph: Math.round(wind * 10) / 10,
        windDirection: compassDirectionFromDegrees(
          Number.isFinite(Number(current.wind_direction_10m)) ? Number(current.wind_direction_10m) : 0
        ),
        condition: mapWmoCodeToLabel(code),
        weatherCode: code,
        precipMm: Number.isFinite(Number(current.precipitation)) ? Number(current.precipitation) : 0,
        pressureHpa: Number.isFinite(Number(current.surface_pressure))
          ? Math.round(Number(current.surface_pressure))
          : 1013,
        source: 'Open-Meteo (Live)',
        sourceUrl: 'https://open-meteo.com/',
        observedAt: now,
        retrievedAt: now,
        isStale: false,
      };
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchOdishaHubsWeather(forceRefresh = false): Promise<LiveWeatherResponse> {
  if (!forceRefresh && cachedHubsWeather && Date.now() < cachedHubsWeather.expiresAt) {
    return cachedHubsWeather.data;
  }

  let hubs: LiveHubWeather[];
  let provider = 'wttr.in Live Meteorological Feed';
  try {
    hubs = await Promise.all(ODISHA_WEATHER_HUBS.map(fetchSingleFromWttr));
    updateProviderState('wttr_weather', 'CONNECTED', null, new Date().toISOString());
  } catch (wttrErr) {
    try {
      hubs = await fetchBatchFromOpenMeteo(ODISHA_WEATHER_HUBS);
      provider = 'Open-Meteo Live Meteorological Feed';
      updateProviderState('wttr_weather', 'CONNECTED', null, new Date().toISOString());
    } catch (omErr) {
      const msg =
        omErr instanceof Error
          ? omErr.message
          : wttrErr instanceof Error
          ? wttrErr.message
          : 'Weather providers unreachable';
      if (cachedHubsWeather) {
        updateProviderState('wttr_weather', 'STALE DATA', msg, cachedHubsWeather.data.fetchedAt);
        return {
          ...cachedHubsWeather.data,
          isStale: true,
          hubs: cachedHubsWeather.data.hubs.map((h) => ({ ...h, isStale: true })),
        };
      }
      const nextStatus =
        omErr instanceof InvalidResponseError ? 'INVALID RESPONSE' : 'TEMPORARILY UNAVAILABLE';
      updateProviderState('wttr_weather', nextStatus, msg);
      throw new Error(msg);
    }
  }

  const now = new Date().toISOString();
  const data: LiveWeatherResponse = {
    hubs,
    fetchedAt: now,
    provider,
    disclaimer: WEATHER_DISCLAIMER,
    isStale: false,
  };

  cachedHubsWeather = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return data;
}

export async function fetchWeatherForDistrictLocation(params: {
  lat: number;
  lng: number;
  districtId: string;
  districtName: string;
  forceRefresh?: boolean;
}): Promise<LiveHubWeather> {
  const key = params.districtId;
  const cached = locationCache.get(key);
  if (!params.forceRefresh && cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const config: OdishaWeatherHubConfig = {
    id: params.districtId,
    hubName: params.districtName,
    districtId: params.districtId,
    corridorLabel: `${params.districtName} HQ`,
    lat: params.lat,
    lng: params.lng,
  };

  let result: LiveHubWeather;
  try {
    result = await fetchSingleFromWttr(config);
    updateProviderState('wttr_weather', 'CONNECTED', null, result.observedAt);
  } catch (err) {
    try {
      const batch = await fetchBatchFromOpenMeteo([config]);
      result = batch[0];
      updateProviderState('wttr_weather', 'CONNECTED', null, result.observedAt);
    } catch (omErr) {
      if (cached) {
        const msg = omErr instanceof Error ? omErr.message : 'Weather timeout';
        updateProviderState('wttr_weather', 'STALE DATA', msg, cached.data.observedAt);
        return { ...cached.data, isStale: true };
      }
      const msg =
        omErr instanceof Error
          ? omErr.message
          : err instanceof Error
          ? err.message
          : 'Weather unavailable';
      const nextStatus =
        omErr instanceof InvalidResponseError ? 'INVALID RESPONSE' : 'TEMPORARILY UNAVAILABLE';
      updateProviderState('wttr_weather', nextStatus, msg);
      throw new Error(msg);
    }
  }

  locationCache.set(key, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return result;
}
