/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DisasterAlertRecord } from '../../types/disaster.ts';
import { fetchWithReliability, InvalidResponseError } from '../dataSourceManager.ts';

function isNearOdishaOrBay(lat: number, lng: number): boolean {
  return lat >= 14.0 && lat <= 23.0 && lng >= 80.0 && lng <= 90.0;
}

function isInsideOdishaState(lat: number, lng: number): boolean {
  return lat >= 17.75 && lat <= 22.6 && lng >= 81.3 && lng <= 87.55;
}

export async function fetchGdacsIndiaEvents(forceRefresh = false): Promise<DisasterAlertRecord[]> {
  try {
    const res = await fetchWithReliability<{
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          eventid?: number;
          eventtype?: string;
          name?: string;
          htmldescription?: string;
          alertlevel?: string;
          country?: string;
          fromdate?: string;
          todate?: string;
          datemodified?: string;
          url?: { report?: string };
          severitydata?: { severitytext?: string };
        };
      }>;
    }>({
      providerId: 'gdacs',
      cacheKey: 'gdacs_india',
      url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?country=India&limit=8',
      cacheTtlMs: 300_000,
      timeoutMs: 6500,
      retries: 1,
      forceRefresh,
      validator: (raw) => {
        if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { features?: unknown }).features)) {
          throw new InvalidResponseError('Unexpected GDACS GeoJSON response');
        }
        return raw as { features: Array<Record<string, unknown>> };
      },
    });

    const features = res.data.features || [];
    return features.slice(0, 6).map((f, idx) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates;
      const lng = coords && coords.length >= 2 ? Number(coords[0]) : null;
      const lat = coords && coords.length >= 2 ? Number(coords[1]) : null;
      const nearOdisha = lat !== null && lng !== null && isNearOdishaOrBay(lat, lng);
      const sev =
        p.alertlevel === 'Red'
          ? 'CRITICAL'
          : p.alertlevel === 'Orange'
          ? 'HIGH'
          : 'MODERATE';

      return {
        id: `gdacs-${p.eventid ?? idx}`,
        title: String(p.name || 'GDACS Regional Event'),
        hazardType: String(p.eventtype === 'TC' ? 'Tropical Cyclone' : p.eventtype === 'FL' ? 'Flood' : p.eventtype || 'Disaster Event'),
        severity: sev,
        severityLabel: `${p.alertlevel || 'Info'} Alert (GDACS)`,
        areaDescription: nearOdisha ? 'India / Bay of Bengal Corridor' : String(p.country || 'India'),
        districtIdsMatched: [],
        targetsOdisha: nearOdisha,
        message:
          String(p.severitydata?.severitytext || p.htmldescription || p.name || '').replace(/<[^>]+>/g, ''),
        effectiveFrom: p.fromdate || null,
        effectiveUntil: p.todate || null,
        lat,
        lng,
        recordClassification: 'secondary_external_info',
        provenance: {
          sourceName: 'GDACS (UN / European Commission)',
          sourceUrl: p.url?.report || 'https://www.gdacs.org/',
          retrievedAt: res.retrievedAt,
          observedAt: p.datemodified || p.fromdate || null,
          locationOrDistrict: p.country || 'India',
          dataCategory: 'external_contextual_info',
          verificationStatus: 'verified',
          origin: 'secondary',
          isStale: res.isStale,
        },
      };
    });
  } catch {
    return [];
  }
}

export async function fetchUsgsOdishaEarthquakes(forceRefresh = false): Promise<{
  events: DisasterAlertRecord[];
  checkedAt: string;
}> {
  try {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDate}&minmagnitude=2.5&minlatitude=17.5&maxlatitude=23.0&minlongitude=81.0&maxlongitude=88.0`;

    const res = await fetchWithReliability<{
      features?: Array<{
        id?: string;
        geometry?: { coordinates?: [number, number, number] };
        properties?: {
          mag?: number;
          place?: string;
          time?: number;
          url?: string;
          title?: string;
        };
      }>;
    }>({
      providerId: 'usgs_seismic',
      cacheKey: 'usgs_odisha_30d',
      url,
      cacheTtlMs: 300_000,
      timeoutMs: 6500,
      retries: 1,
      forceRefresh,
      validator: (raw) => {
        if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { features?: unknown }).features)) {
          throw new InvalidResponseError('Unexpected USGS GeoJSON response');
        }
        return raw as { features: Array<Record<string, unknown>> };
      },
    });

    const events = (res.data.features || []).map((f, idx) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates;
      const lng = coords ? Number(coords[0]) : null;
      const lat = coords ? Number(coords[1]) : null;
      const mag = Number(p.mag ?? 0);
      const timeIso = p.time ? new Date(p.time).toISOString() : null;

      return {
        id: `usgs-${f.id ?? idx}`,
        title: String(p.title || `M${mag} Seismic Event`),
        hazardType: 'Earthquake',
        severity: mag >= 5.5 ? 'CRITICAL' : mag >= 4.5 ? 'HIGH' : 'LOW',
        severityLabel: `M${mag.toFixed(1)}`,
        areaDescription: String(p.place || 'Odisha / Bay of Bengal Region'),
        districtIdsMatched: [],
        targetsOdisha: lat !== null && lng !== null && isInsideOdishaState(lat, lng),
        message: `USGS recorded seismic event magnitude ${mag.toFixed(1)} near ${p.place || 'Odisha sector'}.`,
        effectiveFrom: timeIso,
        effectiveUntil: null,
        lat,
        lng,
        recordClassification: 'secondary_external_info',
        provenance: {
          sourceName: 'USGS Earthquake Hazards Program',
          sourceUrl: p.url || 'https://earthquake.usgs.gov/',
          retrievedAt: res.retrievedAt,
          observedAt: timeIso,
          locationOrDistrict: String(p.place || 'Odisha Sector'),
          dataCategory: 'external_contextual_info',
          verificationStatus: 'verified',
          origin: 'official',
          isStale: res.isStale,
        },
      } satisfies DisasterAlertRecord;
    });

    return { events, checkedAt: res.retrievedAt };
  } catch {
    return { events: [], checkedAt: new Date().toISOString() };
  }
}

export async function fetchNasaEonetRegionalEvents(forceRefresh = false): Promise<DisasterAlertRecord[]> {
  try {
    const res = await fetchWithReliability<{
      events?: Array<{
        id?: string;
        title?: string;
        link?: string;
        categories?: Array<{ title?: string }>;
        geometry?: Array<{ date?: string; coordinates?: unknown }>;
      }>;
    }>({
      providerId: 'nasa_eonet',
      cacheKey: 'nasa_eonet_open',
      url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=40',
      cacheTtlMs: 300_000,
      timeoutMs: 6500,
      retries: 1,
      forceRefresh,
      validator: (raw) => {
        if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { events?: unknown }).events)) {
          throw new InvalidResponseError('Unexpected NASA EONET response');
        }
        return raw as { events: Array<Record<string, unknown>> };
      },
    });

    const filtered: DisasterAlertRecord[] = [];
    for (const ev of res.data.events || []) {
      const lastGeom = ev.geometry?.[ev.geometry.length - 1];
      const coords = Array.isArray(lastGeom?.coordinates) ? lastGeom.coordinates : null;
      const lng = coords && typeof coords[0] === 'number' ? coords[0] : null;
      const lat = coords && typeof coords[1] === 'number' ? coords[1] : null;
      if (lat === null || lng === null || !isNearOdishaOrBay(lat, lng)) continue;

      filtered.push({
        id: `eonet-${ev.id || filtered.length}`,
        title: String(ev.title || 'NASA EONET Natural Event'),
        hazardType: String(ev.categories?.[0]?.title || 'Natural Hazard'),
        severity: 'MODERATE',
        severityLabel: 'NASA EONET Active',
        areaDescription: 'Odisha / Bay of Bengal Sector',
        districtIdsMatched: [],
        targetsOdisha: isInsideOdishaState(lat, lng),
        message: `Satellite-observed natural event tracked by NASA EONET: ${ev.title}.`,
        effectiveFrom: lastGeom?.date || null,
        effectiveUntil: null,
        lat,
        lng,
        recordClassification: 'secondary_external_info',
        provenance: {
          sourceName: 'NASA EONET v3',
          sourceUrl: ev.link || 'https://eonet.gsfc.nasa.gov/',
          retrievedAt: res.retrievedAt,
          observedAt: lastGeom?.date || null,
          locationOrDistrict: 'Odisha / Bay of Bengal',
          dataCategory: 'external_contextual_info',
          verificationStatus: 'verified',
          origin: 'official',
          isStale: res.isStale,
        },
      });
    }
    return filtered;
  } catch {
    return [];
  }
}
