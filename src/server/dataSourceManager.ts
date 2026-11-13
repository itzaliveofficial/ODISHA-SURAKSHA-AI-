/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataSourceStatusEntry, ProviderHealthStatus } from '../types/disaster.ts';

interface ProviderRegistryMeta {
  id: string;
  name: string;
  category: DataSourceStatusEntry['category'];
  categoryLabel: string;
  classification: DataSourceStatusEntry['classification'];
  apiKeyRequired: boolean;
  envVarName?: string;
  websiteUrl: string;
  notes: string;
}

interface ProviderRuntimeState {
  status: ProviderHealthStatus;
  lastSuccessfulRetrieval: string | null;
  lastError: string | null;
}

interface CacheEntry<T> {
  data: T;
  retrievedAt: string;
  expiresAt: number;
}

const REGISTRY: ProviderRegistryMeta[] = [
  {
    id: 'ndma_sachet',
    name: 'NDMA SACHET CAP Alert System',
    category: 'official_disaster_alert',
    categoryLabel: 'Official Disaster Alerts (CAP)',
    classification: 'official',
    apiKeyRequired: false,
    websiteUrl: 'https://sachet.ndma.gov.in/',
    notes: 'Official Common Alerting Protocol (CAP) feed from National Disaster Management Authority & State SDMAs (includes OSDMA alerts when issued).',
  },
  {
    id: 'imd_warnings',
    name: 'India Meteorological Department (IMD)',
    category: 'official_district_advisory',
    categoryLabel: 'Official District Advisories & Rainfall',
    classification: 'official',
    apiKeyRequired: true,
    envVarName: 'IMD_AUTHORIZED_API_URL',
    websiteUrl: 'https://mausam.imd.gov.in/',
    notes: 'IMD district warning API requires server IP whitelisting or an authorized IMD_AUTHORIZED_API_URL endpoint.',
  },
  {
    id: 'osdma',
    name: 'Odisha State Disaster Management Authority (OSDMA)',
    category: 'official_district_advisory',
    categoryLabel: 'State Disaster Management',
    classification: 'official',
    apiKeyRequired: true,
    envVarName: 'OSDMA_AUTHORIZED_FEED_URL',
    websiteUrl: 'https://www.osdma.org/',
    notes: 'OSDMA portal does not publish an open machine-readable public JSON/RSS API; state CAP alerts disseminate via NDMA SACHET unless OSDMA_AUTHORIZED_FEED_URL is configured.',
  },
  {
    id: 'cwc_flood',
    name: 'Central Water Commission (CWC) Flood Forecast',
    category: 'river_flood_info',
    categoryLabel: 'River Gauge & Flood Information',
    classification: 'official',
    apiKeyRequired: true,
    envVarName: 'CWC_AUTHORIZED_FEED_URL',
    websiteUrl: 'https://ffs.india-water.gov.in/',
    notes: 'Official CWC river hydrograph telemetry requires authorized access via CWC_AUTHORIZED_FEED_URL.',
  },
  {
    id: 'cpcb_ogd',
    name: 'CPCB National AQI (via data.gov.in OGD)',
    category: 'air_quality',
    categoryLabel: 'Official Air Quality (Ground CAAQMS)',
    classification: 'official',
    apiKeyRequired: true,
    envVarName: 'DATA_GOV_IN_API_KEY',
    websiteUrl: 'https://airquality.cpcb.gov.in/',
    notes: 'Official Indian CPCB real-time CAAQMS station API via Government of India OGD dataset 3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69.',
  },
  {
    id: 'openaq',
    name: 'OpenAQ v3 Ground Sensor Network',
    category: 'air_quality',
    categoryLabel: 'Air Quality (Secondary Ground Stations)',
    classification: 'secondary',
    apiKeyRequired: true,
    envVarName: 'OPENAQ_API_KEY',
    websiteUrl: 'https://docs.openaq.org/',
    notes: 'Secondary global air-quality ground sensor aggregator; requires OpenAQ v3 X-API-Key.',
  },
  {
    id: 'waqi',
    name: 'World Air Quality Index (WAQI / AQICN)',
    category: 'air_quality',
    categoryLabel: 'Air Quality (Secondary Stations)',
    classification: 'secondary',
    apiKeyRequired: true,
    envVarName: 'WAQI_API_TOKEN',
    websiteUrl: 'https://aqicn.org/api/',
    notes: 'Secondary station network publishing US-EPA AQI scale readings (never conflated with Indian CPCB AQI).',
  },
  {
    id: 'iqair',
    name: 'IQAir AirVisual API',
    category: 'air_quality',
    categoryLabel: 'Air Quality (Secondary)',
    classification: 'secondary',
    apiKeyRequired: true,
    envVarName: 'IQAIR_API_KEY',
    websiteUrl: 'https://www.iqair.com/air-pollution-data-api',
    notes: 'Secondary commercial air-quality API reporting US-EPA AQI when IQAIR_API_KEY is configured.',
  },
  {
    id: 'open_meteo_aq',
    name: 'Open-Meteo Air Quality (CAMS Atmospheric Model)',
    category: 'air_quality',
    categoryLabel: 'Air Quality (Modeled Atmospheric Baseline)',
    classification: 'secondary',
    apiKeyRequired: false,
    websiteUrl: 'https://open-meteo.com/en/docs/air-quality-api',
    notes: 'Atmospheric reanalysis & forecast model feed (PM2.5, PM10, NO2, SO2, CO, O3, US AQI, EAQI). Modeled estimates only — NOT physical ground sensor stations.',
  },
  {
    id: 'wttr_weather',
    name: 'wttr.in / Open-Meteo Live Weather',
    category: 'official_weather',
    categoryLabel: 'Live Surface Weather Observations',
    classification: 'secondary',
    apiKeyRequired: false,
    websiteUrl: 'https://wttr.in/',
    notes: 'Live surface temperature, humidity, wind, and precipitation observations for Odisha district hubs.',
  },
  {
    id: 'gdacs',
    name: 'GDACS (UN / EC Global Disaster Alerts)',
    category: 'external_contextual_info',
    categoryLabel: 'Secondary External Regional Events',
    classification: 'secondary',
    apiKeyRequired: false,
    websiteUrl: 'https://www.gdacs.org/',
    notes: 'Global Disaster Alert and Coordination System secondary contextual feed tracking cyclones, floods, and severe events.',
  },
  {
    id: 'usgs_seismic',
    name: 'USGS Earthquake Hazards GeoJSON Feed',
    category: 'external_contextual_info',
    categoryLabel: 'Secondary External Seismic Monitoring',
    classification: 'official',
    apiKeyRequired: false,
    websiteUrl: 'https://earthquake.usgs.gov/',
    notes: 'USGS regional seismic event feed bounded to Odisha & Bay of Bengal coordinates (external contextual info).',
  },
  {
    id: 'nasa_eonet',
    name: 'NASA EONET v3 Natural Events',
    category: 'external_contextual_info',
    categoryLabel: 'Secondary External Satellite Events',
    classification: 'official',
    apiKeyRequired: false,
    websiteUrl: 'https://eonet.gsfc.nasa.gov/',
    notes: 'NASA Earth Observatory Natural Event Tracker filtered geographically for Odisha & eastern India.',
  },
  {
    id: 'local_incident_store',
    name: 'User Incident Reports (Local JSON Store)',
    category: 'user_submitted_report',
    categoryLabel: 'User-Submitted Field Reports (Unverified)',
    classification: 'local_storage',
    apiKeyRequired: false,
    websiteUrl: 'about:blank',
    notes: 'Local JSON persistence (.data/incidents.json) storing community-submitted field reports (unverified) separately from simulated training scenarios.',
  },
];

const runtimeStates = new Map<string, ProviderRuntimeState>();
const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function isPlaceholderOrMissingEnv(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  return (
    upper.startsWith('MY_') ||
    upper.startsWith('YOUR_') ||
    upper.includes('PLACEHOLDER') ||
    upper === 'CHANGEME' ||
    upper === 'DEMO'
  );
}

export function isEnvKeyConfigured(envVar?: string): boolean {
  if (!envVar) return true;
  return !isPlaceholderOrMissingEnv(process.env[envVar]);
}

// Initialize initial runtime statuses
for (const meta of REGISTRY) {
  const configured = isEnvKeyConfigured(meta.envVarName);
  runtimeStates.set(meta.id, {
    status: meta.id === 'local_incident_store'
      ? 'CONNECTED'
      : meta.apiKeyRequired && !configured
      ? 'NOT CONFIGURED'
      : 'TEMPORARILY UNAVAILABLE',
    lastSuccessfulRetrieval: meta.id === 'local_incident_store' ? new Date().toISOString() : null,
    lastError: meta.apiKeyRequired && !configured
      ? `Missing or placeholder server environment variable: ${meta.envVarName}`
      : null,
  });
}

export function updateProviderState(
  providerId: string,
  status: ProviderHealthStatus,
  errorMsg: string | null = null,
  retrievedAt?: string
): void {
  const prev = runtimeStates.get(providerId) || {
    status: 'TEMPORARILY UNAVAILABLE' as ProviderHealthStatus,
    lastSuccessfulRetrieval: null,
    lastError: null,
  };
  runtimeStates.set(providerId, {
    status,
    lastSuccessfulRetrieval: retrievedAt ?? prev.lastSuccessfulRetrieval,
    lastError: errorMsg,
  });
}

export function getProviderState(providerId: string): ProviderRuntimeState {
  return (
    runtimeStates.get(providerId) || {
      status: 'NOT CONFIGURED',
      lastSuccessfulRetrieval: null,
      lastError: 'Unknown provider',
    }
  );
}

export function getAllProviderStatuses(): DataSourceStatusEntry[] {
  return REGISTRY.map((meta) => {
    const configured = isEnvKeyConfigured(meta.envVarName);
    const runtime = getProviderState(meta.id);
    const status: ProviderHealthStatus =
      meta.apiKeyRequired && !configured ? 'NOT CONFIGURED' : runtime.status;
    return {
      id: meta.id,
      name: meta.name,
      category: meta.category,
      categoryLabel: meta.categoryLabel,
      classification: meta.classification,
      status,
      lastSuccessfulRetrieval: runtime.lastSuccessfulRetrieval,
      lastError: runtime.lastError,
      apiKeyRequired: meta.apiKeyRequired,
      apiKeyConfigured: configured,
      envVarName: meta.envVarName,
      websiteUrl: meta.websiteUrl,
      notes: meta.notes,
    };
  });
}

export function getCustomFeedUrls(): string[] {
  const raw = process.env.CUSTOM_DISASTER_FEED_URLS || '';
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter((u) => {
      if (isPlaceholderOrMissingEnv(u)) return false;
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    });
}

export interface ReliableFetchResult<T> {
  data: T;
  retrievedAt: string;
  isStale: boolean;
  fromCache: boolean;
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseError';
  }
}

class NonRetryableHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchWithReliability<T>(options: {
  providerId: string;
  cacheKey: string;
  url: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  retries?: number;
  forceRefresh?: boolean;
  headers?: Record<string, string>;
  validator: (raw: unknown) => T;
}): Promise<ReliableFetchResult<T>> {
  const {
    providerId,
    cacheKey,
    url,
    cacheTtlMs = 180_000,
    timeoutMs = 7000,
    retries = 1,
    forceRefresh = false,
    headers = {},
    validator,
  } = options;

  const existing = responseCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (!forceRefresh && existing && Date.now() < existing.expiresAt) {
    return {
      data: existing.data,
      retrievedAt: existing.retrievedAt,
      isStale: false,
      fromCache: true,
    };
  }

  const inflightKey = `${cacheKey}:${forceRefresh ? 'refresh' : 'std'}`;
  const existingFlight = inFlightRequests.get(inflightKey) as Promise<ReliableFetchResult<T>> | undefined;
  if (existingFlight) {
    return existingFlight;
  }

  const exec = (async (): Promise<ReliableFetchResult<T>> => {
    let lastErr: Error = new Error('Unknown fetch error');

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'OdishaSurakshaAI/2.0',
            ...headers,
          },
        });

        if (res.status === 401 || res.status === 403 || res.status === 404) {
          const textSample = (await res.text().catch(() => '')).slice(0, 140);
          throw new NonRetryableHttpError(
            res.status,
            `HTTP ${res.status}: ${textSample || res.statusText}`
          );
        }

        if (res.status === 429) {
          throw new Error('HTTP 429: Provider rate limit exceeded');
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        let rawJson: unknown;
        try {
          rawJson = await res.json();
        } catch (parseErr) {
          throw new InvalidResponseError(
            `Malformed JSON response: ${parseErr instanceof Error ? parseErr.message : 'parse error'}`
          );
        }

        const validated = validator(rawJson);
        const now = new Date().toISOString();

        responseCache.set(cacheKey, {
          data: validated,
          retrievedAt: now,
          expiresAt: Date.now() + cacheTtlMs,
        });
        updateProviderState(providerId, 'CONNECTED', null, now);

        return {
          data: validated,
          retrievedAt: now,
          isStale: false,
          fromCache: false,
        };
      } catch (err: unknown) {
        if (err instanceof NonRetryableHttpError || err instanceof InvalidResponseError) {
          lastErr = err;
          break;
        }
        const msg =
          err instanceof Error && err.name === 'AbortError'
            ? `Request timed out after ${timeoutMs}ms`
            : err instanceof Error
            ? err.message
            : 'Network request failed';
        lastErr = new Error(msg);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const errText = lastErr.message;
    const isInvalidShape =
      lastErr instanceof InvalidResponseError ||
      lastErr instanceof SyntaxError ||
      errText.includes('Unexpected') ||
      errText.includes('Invalid') ||
      errText.includes('JSON');

    if (existing) {
      updateProviderState(providerId, 'STALE DATA', errText, existing.retrievedAt);
      return {
        data: existing.data,
        retrievedAt: existing.retrievedAt,
        isStale: true,
        fromCache: true,
      };
    }

    if (lastErr instanceof NonRetryableHttpError && (lastErr.status === 401 || lastErr.status === 403)) {
      updateProviderState(providerId, 'NOT CONFIGURED', errText);
    } else if (isInvalidShape) {
      updateProviderState(providerId, 'INVALID RESPONSE', errText);
    } else {
      updateProviderState(providerId, 'TEMPORARILY UNAVAILABLE', errText);
    }
    throw lastErr;
  })();

  inFlightRequests.set(inflightKey, exec);
  try {
    return await exec;
  } finally {
    inFlightRequests.delete(inflightKey);
  }
}
