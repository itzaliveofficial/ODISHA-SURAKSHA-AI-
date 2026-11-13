/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DisasterAlertRecord } from '../../types/disaster.ts';
import { ODISHA_DISTRICTS } from '../../data/odishaDistricts.ts';
import { fetchWithReliability, InvalidResponseError } from '../dataSourceManager.ts';

const SACHET_API_URL = 'https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails';
const SACHET_PORTAL_URL = 'https://sachet.ndma.gov.in/';

interface RawSachetAlert {
  identifier?: string | number;
  severity?: string;
  severity_level?: string;
  disaster_type?: string;
  area_description?: string;
  warning_message?: string;
  effective_start_time?: string;
  effective_end_time?: string;
  alert_source?: string;
  centroid?: string;
  disseminated?: string;
}

function normalizeSeverity(sev?: string): DisasterAlertRecord['severity'] {
  const s = (sev || '').toUpperCase();
  if (s.includes('EXTREME') || s.includes('RED')) return 'CRITICAL';
  if (s.includes('SEVERE') || s.includes('ORANGE') || s.includes('HIGH')) return 'HIGH';
  if (s.includes('MODERATE') || s.includes('YELLOW')) return 'MODERATE';
  if (s.includes('LOW') || s.includes('GREEN')) return 'LOW';
  return 'INFO';
}

function parseCentroid(centroid?: string): { lat: number | null; lng: number | null } {
  if (!centroid || typeof centroid !== 'string') return { lat: null, lng: null };
  const parts = centroid.split(',').map((v) => Number(v.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    return { lat: null, lng: null };
  }
  const [lng, lat] = parts;
  return { lat, lng };
}

function matchOdishaDistricts(areaDesc: string, message: string, source: string, lat: number | null, lng: number | null): {
  districtIds: string[];
  targetsOdisha: boolean;
} {
  const combined = `${areaDesc} ${message} ${source}`.toLowerCase();
  const matched = ODISHA_DISTRICTS.filter((d) =>
    combined.includes(d.name.toLowerCase()) ||
    combined.includes(d.headquarters.toLowerCase())
  ).map((d) => d.id);

  const inOdishaBounds =
    lat !== null &&
    lng !== null &&
    lat >= 17.75 &&
    lat <= 22.6 &&
    lng >= 81.3 &&
    lng <= 87.55;

  const mentionsOdisha =
    combined.includes('odisha') ||
    combined.includes('orissa') ||
    combined.includes('osdma') ||
    combined.includes('bhubaneswar');

  return {
    districtIds: matched,
    targetsOdisha: matched.length > 0 || mentionsOdisha || inOdishaBounds,
  };
}

export async function fetchNdmaSachetAlerts(forceRefresh = false): Promise<{
  odishaAlerts: DisasterAlertRecord[];
  nationalAlerts: DisasterAlertRecord[];
  retrievedAt: string;
  isStale: boolean;
}> {
  const res = await fetchWithReliability<RawSachetAlert[]>({
    providerId: 'ndma_sachet',
    cacheKey: 'ndma_sachet_all',
    url: SACHET_API_URL,
    cacheTtlMs: 120_000,
    timeoutMs: 7000,
    retries: 1,
    forceRefresh,
    validator: (raw) => {
      if (!Array.isArray(raw)) {
        throw new InvalidResponseError('Unexpected NDMA SACHET response shape (expected JSON array)');
      }
      if (raw.length > 0) {
        const sample = raw[0] as Record<string, unknown> | null;
        const hasCapKeys =
          sample &&
          typeof sample === 'object' &&
          ('identifier' in sample ||
            'severity' in sample ||
            'disaster_type' in sample ||
            'area_description' in sample ||
            'warning_message' in sample);
        if (!hasCapKeys) {
          throw new InvalidResponseError('Unexpected NDMA SACHET item structure (missing CAP alert fields)');
        }
      }
      return raw as RawSachetAlert[];
    },
  });

  const normalized: DisasterAlertRecord[] = res.data.map((item, idx) => {
    const areaDescription = String(item.area_description || 'Unspecified Region');
    const message = String(item.warning_message || item.severity_level || 'No detailed message provided.');
    const sourceLabel = String(item.alert_source || 'NDMA SACHET CAP Feed');
    const { lat, lng } = parseCentroid(item.centroid);
    const { districtIds, targetsOdisha } = matchOdishaDistricts(areaDescription, message, sourceLabel, lat, lng);

    return {
      id: `sachet-${item.identifier ?? idx}`,
      title: `${item.disaster_type || 'CAP Alert'} — ${areaDescription}`,
      hazardType: String(item.disaster_type || 'Advisory'),
      severity: normalizeSeverity(item.severity),
      severityLabel: String(item.severity || 'INFO'),
      areaDescription,
      districtIdsMatched: districtIds,
      targetsOdisha,
      message,
      effectiveFrom: item.effective_start_time || null,
      effectiveUntil: item.effective_end_time || null,
      lat,
      lng,
      recordClassification: 'official_government_alert',
      provenance: {
        sourceName: `NDMA SACHET (${sourceLabel})`,
        sourceUrl: SACHET_PORTAL_URL,
        retrievedAt: res.retrievedAt,
        observedAt: item.effective_start_time || null,
        locationOrDistrict: areaDescription,
        dataCategory: 'official_disaster_alert',
        verificationStatus: 'verified',
        origin: 'official',
        isStale: res.isStale,
      },
    };
  });

  return {
    odishaAlerts: normalized.filter((a) => a.targetsOdisha),
    nationalAlerts: normalized,
    retrievedAt: res.retrievedAt,
    isStale: res.isStale,
  };
}
