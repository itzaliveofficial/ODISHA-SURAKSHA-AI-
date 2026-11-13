/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type {
  AqiPollutants,
  AqiStationRecord,
  IndianAqiCategory,
  OdishaAqiResponse,
} from '../types/disaster.ts';
import { isPlaceholderOrMissingEnv } from './dataSourceManager.ts';
import { fetchCpcbOdishaStations, CPCB_PORTAL_URL } from './providers/cpcbProvider.ts';
import { fetchOpenAqOdishaStations, OPENAQ_DOCS_URL } from './providers/openAqProvider.ts';
import { fetchWaqiOdishaStations, WAQI_PORTAL_URL } from './providers/waqiProvider.ts';
import { fetchIqAirOdishaCity, IQAIR_PORTAL_URL } from './providers/iqairProvider.ts';
import {
  fetchOpenMeteoAqBatch,
  OPEN_METEO_AQ_DOCS,
} from './providers/openMeteoAqProvider.ts';
import { GEMINI_TRIAGE_MODEL } from './aiTriageHandler.ts';

interface TargetOdishaAqiLocation {
  locationId: string;
  city: string;
  districtId: string;
  districtName: string;
  lat: number;
  lng: number;
}

// Reference coordinates of major Odisha urban/industrial districts for querying live AQI providers
// or atmospheric grids. Physical station presence is NEVER assumed from this list; it is verified
// strictly against live provider station metadata at runtime.
const ODISHA_AQI_TARGET_LOCATIONS: TargetOdishaAqiLocation[] = [
  { locationId: 'bbsr-khordha', city: 'Bhubaneswar', districtId: 'khordha', districtName: 'Khordha', lat: 20.2961, lng: 85.8245 },
  { locationId: 'ctc-cuttack', city: 'Cuttack', districtId: 'cuttack', districtName: 'Cuttack', lat: 20.4625, lng: 85.8830 },
  { locationId: 'puri-coastal', city: 'Puri', districtId: 'puri', districtName: 'Puri', lat: 19.8135, lng: 85.8312 },
  { locationId: 'rkl-sundargarh', city: 'Rourkela', districtId: 'sundargarh', districtName: 'Sundargarh', lat: 22.2604, lng: 84.8536 },
  { locationId: 'sbp-sambalpur', city: 'Sambalpur', districtId: 'sambalpur', districtName: 'Sambalpur', lat: 21.4669, lng: 83.9812 },
  { locationId: 'bls-balasore', city: 'Balasore', districtId: 'balasore', districtName: 'Balasore', lat: 21.4934, lng: 86.9135 },
  { locationId: 'angul-talcher', city: 'Angul', districtId: 'angul', districtName: 'Angul', lat: 20.8409, lng: 85.1016 },
  { locationId: 'paradeep-jsg', city: 'Paradeep', districtId: 'jagatsinghpur', districtName: 'Jagatsinghpur', lat: 20.3165, lng: 86.6114 },
  { locationId: 'jhg-jharsuguda', city: 'Jharsuguda', districtId: 'jharsuguda', districtName: 'Jharsuguda', lat: 21.8554, lng: 84.0062 },
  { locationId: 'jjp-kalinganagar', city: 'Byasanagar', districtId: 'jajpur', districtName: 'Jajpur', lat: 20.9478, lng: 86.1211 },
];

// Additional districts intentionally kept in explicit unmonitored registry unless a ground station API responds
const UNMONITORED_ODISHA_LOCATIONS: TargetOdishaAqiLocation[] = [
  { locationId: 'unmon-malkangiri', city: 'Malkangiri', districtId: 'malkangiri', districtName: 'Malkangiri', lat: 18.3476, lng: 81.8825 },
  { locationId: 'unmon-kandhamal', city: 'Phulbani', districtId: 'kandhamal', districtName: 'Kandhamal', lat: 20.4785, lng: 84.2345 },
  { locationId: 'unmon-boudh', city: 'Boudh', districtId: 'boudh', districtName: 'Boudh', lat: 20.8364, lng: 84.3264 },
  { locationId: 'unmon-nuapada', city: 'Nuapada', districtId: 'nuapada', districtName: 'Nuapada', lat: 20.8027, lng: 82.5364 },
  { locationId: 'unmon-nabarangpur', city: 'Nabarangpur', districtId: 'nabarangpur', districtName: 'Nabarangpur', lat: 19.2314, lng: 82.5484 },
  { locationId: 'unmon-deogarh', city: 'Deogarh', districtId: 'deogarh', districtName: 'Deogarh', lat: 21.5396, lng: 84.7289 },
  { locationId: 'unmon-subarnapur', city: 'Sonepur', districtId: 'subarnapur', districtName: 'Subarnapur', lat: 20.8339, lng: 83.9165 },
  { locationId: 'unmon-gajapati', city: 'Paralakhemundi', districtId: 'gajapati', districtName: 'Gajapati', lat: 18.7798, lng: 84.0884 },
];

// --- Official CPCB National AQI Breakpoint Tables (CPCB NAQI 2014) ---
interface BreakpointBand {
  bpLo: number;
  bpHi: number;
  iLo: number;
  iHi: number;
}

const CPCB_BANDS: Record<'pm25' | 'pm10' | 'no2' | 'so2' | 'coMgM3' | 'o3', BreakpointBand[]> = {
  pm25: [
    { bpLo: 0, bpHi: 30, iLo: 0, iHi: 50 },
    { bpLo: 30, bpHi: 60, iLo: 51, iHi: 100 },
    { bpLo: 60, bpHi: 90, iLo: 101, iHi: 200 },
    { bpLo: 90, bpHi: 120, iLo: 201, iHi: 300 },
    { bpLo: 120, bpHi: 250, iLo: 301, iHi: 400 },
    { bpLo: 250, bpHi: 500, iLo: 401, iHi: 500 },
  ],
  pm10: [
    { bpLo: 0, bpHi: 50, iLo: 0, iHi: 50 },
    { bpLo: 50, bpHi: 100, iLo: 51, iHi: 100 },
    { bpLo: 100, bpHi: 250, iLo: 101, iHi: 200 },
    { bpLo: 250, bpHi: 350, iLo: 201, iHi: 300 },
    { bpLo: 350, bpHi: 430, iLo: 301, iHi: 400 },
    { bpLo: 430, bpHi: 600, iLo: 401, iHi: 500 },
  ],
  no2: [
    { bpLo: 0, bpHi: 40, iLo: 0, iHi: 50 },
    { bpLo: 40, bpHi: 80, iLo: 51, iHi: 100 },
    { bpLo: 80, bpHi: 180, iLo: 101, iHi: 200 },
    { bpLo: 180, bpHi: 280, iLo: 201, iHi: 300 },
    { bpLo: 280, bpHi: 400, iLo: 301, iHi: 400 },
    { bpLo: 400, bpHi: 800, iLo: 401, iHi: 500 },
  ],
  so2: [
    { bpLo: 0, bpHi: 40, iLo: 0, iHi: 50 },
    { bpLo: 40, bpHi: 80, iLo: 51, iHi: 100 },
    { bpLo: 80, bpHi: 380, iLo: 101, iHi: 200 },
    { bpLo: 380, bpHi: 800, iLo: 201, iHi: 300 },
    { bpLo: 800, bpHi: 1600, iLo: 301, iHi: 400 },
    { bpLo: 1600, bpHi: 2100, iLo: 401, iHi: 500 },
  ],
  coMgM3: [
    { bpLo: 0, bpHi: 1.0, iLo: 0, iHi: 50 },
    { bpLo: 1.0, bpHi: 2.0, iLo: 51, iHi: 100 },
    { bpLo: 2.0, bpHi: 10.0, iLo: 101, iHi: 200 },
    { bpLo: 10.0, bpHi: 17.0, iLo: 201, iHi: 300 },
    { bpLo: 17.0, bpHi: 34.0, iLo: 301, iHi: 400 },
    { bpLo: 34.0, bpHi: 50.0, iLo: 401, iHi: 500 },
  ],
  o3: [
    { bpLo: 0, bpHi: 50, iLo: 0, iHi: 50 },
    { bpLo: 50, bpHi: 100, iLo: 51, iHi: 100 },
    { bpLo: 100, bpHi: 168, iLo: 101, iHi: 200 },
    { bpLo: 168, bpHi: 208, iLo: 201, iHi: 300 },
    { bpLo: 208, bpHi: 748, iLo: 301, iHi: 400 },
    { bpLo: 748, bpHi: 1000, iLo: 401, iHi: 500 },
  ],
};

function computeSubIndex(value: number, bands: BreakpointBand[]): number {
  const clamped = Math.max(0, value);
  for (const band of bands) {
    if (clamped <= band.bpHi) {
      return Math.round(
        ((band.iHi - band.iLo) / (band.bpHi - band.bpLo)) * (clamped - band.bpLo) + band.iLo
      );
    }
  }
  return 500;
}

export function classifyIndianCpcbCategory(aqi: number | null): IndianAqiCategory {
  if (aqi === null || !Number.isFinite(aqi)) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function calculateIndianCpcbAqi(pollutants: AqiPollutants): {
  aqi: number | null;
  category: IndianAqiCategory;
  prominentPollutant: string | null;
  validPollutantCount: number;
} {
  const entries: Array<{ key: keyof typeof CPCB_BANDS; label: string; value: number | null }> = [
    { key: 'pm25', label: 'PM2.5', value: pollutants.pm25 },
    { key: 'pm10', label: 'PM10', value: pollutants.pm10 },
    { key: 'no2', label: 'NO2', value: pollutants.no2 },
    { key: 'so2', label: 'SO2', value: pollutants.so2 },
    { key: 'coMgM3', label: 'CO', value: pollutants.coMgM3 },
    { key: 'o3', label: 'O3', value: pollutants.o3 },
  ];

  const valid = entries.filter((e) => e.value !== null && Number.isFinite(e.value));
  const hasParticulate = pollutants.pm25 !== null || pollutants.pm10 !== null;

  if (valid.length < 3 || !hasParticulate) {
    return {
      aqi: null,
      category: 'Unavailable',
      prominentPollutant: null,
      validPollutantCount: valid.length,
    };
  }

  let maxSub = -1;
  let prominent: string | null = null;
  for (const item of valid) {
    const sub = computeSubIndex(item.value!, CPCB_BANDS[item.key]);
    if (sub > maxSub) {
      maxSub = sub;
      prominent = item.label;
    }
  }

  return {
    aqi: maxSub,
    category: classifyIndianCpcbCategory(maxSub),
    prominentPollutant: prominent,
    validPollutantCount: valid.length,
  };
}

function buildUnmonitoredRecords(now: string): AqiStationRecord[] {
  return UNMONITORED_ODISHA_LOCATIONS.map((loc) => ({
    stationId: loc.locationId,
    stationName: `${loc.city} (${loc.districtName}) — No Verified Ground Monitor`,
    city: loc.city,
    districtId: loc.districtId,
    districtName: loc.districtName,
    lat: loc.lat,
    lng: loc.lng,
    sourceKind: 'unavailable',
    scaleMethod: 'unavailable',
    hasPhysicalStation: false,
    stationMetadataVerified: false,
    dataAvailable: false,
    freshness: 'UNAVAILABLE',
    cpcbAqi: null,
    cpcbAqiIsOfficial: false,
    cpcbAqiMethodologyNote:
      'No verified CPCB / OSPCB or secondary physical air-quality station metadata was retrieved for this district; AQI values are not fabricated.',
    cpcbCategory: 'Unavailable',
    prominentPollutant: null,
    usAqi: null,
    europeanAqi: null,
    pollutants: { pm25: null, pm10: null, no2: null, so2: null, coMgM3: null, o3: null },
    provenance: {
      sourceName: 'Station Registry Check (Unmonitored)',
      sourceUrl: CPCB_PORTAL_URL,
      retrievedAt: now,
      observedAt: null,
      locationOrDistrict: loc.districtName,
      dataCategory: 'air_quality',
      verificationStatus: 'unavailable',
      origin: 'official',
    },
    unavailableReason: `No verified ground monitoring station reported for ${loc.city} (${loc.districtName}).`,
  }));
}

export async function getOdishaAqiOverview(forceRefresh = false): Promise<OdishaAqiResponse> {
  const now = new Date().toISOString();

  const [cpcbRes, openAqRes, waqiRes, iqAirBbsrRes, openMeteoRes] = await Promise.allSettled([
    fetchCpcbOdishaStations(forceRefresh),
    fetchOpenAqOdishaStations(forceRefresh),
    fetchWaqiOdishaStations(forceRefresh),
    fetchIqAirOdishaCity('Bhubaneswar', forceRefresh),
    fetchOpenMeteoAqBatch(
      ODISHA_AQI_TARGET_LOCATIONS.map((s) => ({ lat: s.lat, lng: s.lng })),
      forceRefresh
    ),
  ]);

  const cpcbOk =
    cpcbRes.status === 'fulfilled' && cpcbRes.value.available && cpcbRes.value.records.length > 0;
  const openAqOk =
    openAqRes.status === 'fulfilled' && openAqRes.value.available && openAqRes.value.stations.length > 0;
  const waqiOk =
    waqiRes.status === 'fulfilled' && waqiRes.value.available && waqiRes.value.stations.length > 0;
  const openMeteoOk =
    openMeteoRes.status === 'fulfilled' &&
    openMeteoRes.value.readings.length === ODISHA_AQI_TARGET_LOCATIONS.length;

  const monitoredStations: AqiStationRecord[] = ODISHA_AQI_TARGET_LOCATIONS.map((loc, idx) => {
    // 1. Official CPCB Ground CAAQMS Station (requires verified CPCB OGD API payload + station match)
    if (cpcbOk && cpcbRes.status === 'fulfilled') {
      const cityRecords = cpcbRes.value.records.filter(
        (r) =>
          (r.city.toLowerCase().includes(loc.city.toLowerCase()) ||
            r.station.toLowerCase().includes(loc.city.toLowerCase())) &&
          r.station.trim().length > 0 &&
          r.avgValue !== null
      );
      if (cityRecords.length > 0) {
        const readCpcb = (keys: string[]) => {
          const hit = cityRecords.find((r) => keys.includes(r.pollutantId));
          return hit?.avgValue ?? null;
        };
        const coRaw = readCpcb(['CO']);
        const pollutants: AqiPollutants = {
          pm25: readCpcb(['PM2.5', 'PM25']),
          pm10: readCpcb(['PM10']),
          no2: readCpcb(['NO2']),
          so2: readCpcb(['SO2']),
          coMgM3: coRaw !== null ? Number((coRaw > 50 ? coRaw / 1000 : coRaw).toFixed(2)) : null,
          o3: readCpcb(['OZONE', 'O3']),
        };
        const calc = calculateIndianCpcbAqi(pollutants);
        const primaryRec = cityRecords[0];
        return {
          stationId: loc.locationId,
          providerStationId: primaryRec.station,
          stationName: primaryRec.station,
          city: loc.city,
          districtId: loc.districtId,
          districtName: loc.districtName,
          lat: primaryRec.lat ?? loc.lat,
          lng: primaryRec.lng ?? loc.lng,
          sourceKind: 'cpcb_ground_station',
          scaleMethod: calc.aqi !== null ? 'cpcb_calculated_from_official_pollutants' : 'unavailable',
          hasPhysicalStation: true,
          stationMetadataVerified: true,
          dataAvailable: true,
          freshness: cpcbRes.value.isStale ? 'STALE' : 'LIVE',
          cpcbAqi: calc.aqi,
          cpcbAqiIsOfficial: calc.aqi !== null,
          cpcbAqiMethodologyNote:
            calc.aqi !== null
              ? 'Derived from official CPCB CAAQMS pollutant averages retrieved via data.gov.in OGD API using Indian NAQI breakpoints.'
              : 'Official CPCB ground station matched, but fewer than 3 criteria pollutants (or PM) were published for CPCB NAQI calculation.',
          cpcbCategory: calc.category,
          prominentPollutant: calc.prominentPollutant,
          usAqi: null,
          europeanAqi: null,
          pollutants,
          provenance: {
            sourceName: 'Central Pollution Control Board (CPCB Ground CAAQMS via data.gov.in)',
            sourceUrl: CPCB_PORTAL_URL,
            retrievedAt: cpcbRes.value.retrievedAt,
            observedAt: primaryRec.lastUpdate,
            locationOrDistrict: `${loc.city}, ${loc.districtName}`,
            dataCategory: 'air_quality',
            verificationStatus: 'verified',
            origin: 'official',
            isStale: cpcbRes.value.isStale,
            scaleNote: 'CPCB Official CAAQMS Pollutants · Indian NAQI (0–500)',
          },
        };
      }
    }

    // 2. OpenAQ v3 Verified Ground Sensor Match
    if (openAqOk && openAqRes.status === 'fulfilled') {
      const match = openAqRes.value.stations.find(
        (s) =>
          s.city.toLowerCase().includes(loc.city.toLowerCase()) ||
          s.name.toLowerCase().includes(loc.city.toLowerCase()) ||
          (Math.abs(s.lat - loc.lat) < 0.25 && Math.abs(s.lng - loc.lng) < 0.25)
      );
      if (match) {
        const pollutants: AqiPollutants = {
          pm25: match.pm25,
          pm10: match.pm10,
          no2: match.no2,
          so2: match.so2,
          coMgM3: match.coMgM3,
          o3: match.o3,
        };
        const calc = calculateIndianCpcbAqi(pollutants);
        return {
          stationId: loc.locationId,
          providerStationId: `openaq-${match.id}`,
          stationName: `${match.name} (OpenAQ #${match.id})`,
          city: loc.city,
          districtId: loc.districtId,
          districtName: loc.districtName,
          lat: match.lat,
          lng: match.lng,
          sourceKind: 'openaq_ground_station',
          scaleMethod:
            calc.aqi !== null ? 'indian_scale_calculated_from_secondary_sensors' : 'unavailable',
          hasPhysicalStation: true,
          stationMetadataVerified: true,
          dataAvailable: true,
          freshness: openAqRes.value.isStale ? 'STALE' : 'LIVE',
          cpcbAqi: calc.aqi,
          cpcbAqiIsOfficial: false,
          cpcbAqiMethodologyNote:
            calc.aqi !== null
              ? 'Independently calculated Indian-scale AQI from OpenAQ physical sensor measurements (NOT an official CPCB feed).'
              : 'OpenAQ physical sensor matched, but fewer than 3 pollutants (or PM) are available for Indian-scale AQI calculation.',
          cpcbCategory: calc.category,
          prominentPollutant: calc.prominentPollutant,
          usAqi: null,
          europeanAqi: null,
          pollutants,
          provenance: {
            sourceName: 'OpenAQ v3 Secondary Ground Station Network',
            sourceUrl: OPENAQ_DOCS_URL,
            retrievedAt: openAqRes.value.retrievedAt,
            observedAt: match.observedAt,
            locationOrDistrict: `${loc.city}, ${loc.districtName}`,
            dataCategory: 'air_quality',
            verificationStatus: 'verified',
            origin: 'secondary',
            isStale: openAqRes.value.isStale,
            scaleNote: 'Secondary Ground Sensor Concentrations + Independent Indian-Scale Calc',
          },
        };
      }
    }

    // 3. Secondary Station Provider Match (WAQI / AQICN — verified US-EPA station metadata, no modeled mixing)
    const waqiMatch =
      waqiOk && waqiRes.status === 'fulfilled'
        ? waqiRes.value.stations.find(
            (s) =>
              s.name.toLowerCase().includes(loc.city.toLowerCase()) ||
              (Math.abs(s.lat - loc.lat) < 0.25 && Math.abs(s.lng - loc.lng) < 0.25)
          )
        : undefined;

    if (waqiMatch && waqiRes.status === 'fulfilled') {
      return {
        stationId: loc.locationId,
        providerStationId: `waqi-${waqiMatch.uid}`,
        stationName: `${waqiMatch.name} (WAQI #${waqiMatch.uid})`,
        city: loc.city,
        districtId: loc.districtId,
        districtName: loc.districtName,
        lat: waqiMatch.lat,
        lng: waqiMatch.lng,
        sourceKind: 'secondary_provider_station',
        scaleMethod: 'us_epa_secondary_only',
        hasPhysicalStation: true,
        stationMetadataVerified: true,
        dataAvailable: true,
        freshness: waqiRes.value.isStale ? 'STALE' : 'LIVE',
        cpcbAqi: null,
        cpcbAqiIsOfficial: false,
        cpcbAqiMethodologyNote:
          'WAQI bounds feed reports US-EPA AQI only; Indian CPCB AQI is not fabricated from US-EPA scores.',
        cpcbCategory: 'Unavailable',
        prominentPollutant: null,
        usAqi: waqiMatch.usAqi,
        europeanAqi: null,
        pollutants: { pm25: null, pm10: null, no2: null, so2: null, coMgM3: null, o3: null },
        provenance: {
          sourceName: 'WAQI / AQICN Secondary Station Feed',
          sourceUrl: WAQI_PORTAL_URL,
          retrievedAt: waqiRes.value.retrievedAt,
          observedAt: waqiMatch.observedAt,
          locationOrDistrict: `${loc.city}, ${loc.districtName}`,
          dataCategory: 'air_quality',
          verificationStatus: 'verified',
          origin: 'secondary',
          isStale: waqiRes.value.isStale,
          scaleNote: 'US-EPA AQI Scale Only (Secondary Provider Station)',
        },
      };
    }

    // Optional IQAir city match (US-EPA secondary without ground station ID)
    const iqAirUsAqi =
      loc.city === 'Bhubaneswar' && iqAirBbsrRes.status === 'fulfilled' && iqAirBbsrRes.value.available
        ? iqAirBbsrRes.value.observation?.usAqi ?? null
        : null;

    // 4. Open-Meteo Atmospheric CAMS Model Estimate (NOT a physical ground station!)
    if (openMeteoOk && openMeteoRes.status === 'fulfilled') {
      const reading = openMeteoRes.value.readings[idx];
      const pollutants: AqiPollutants = {
        pm25: reading.pm25,
        pm10: reading.pm10,
        no2: reading.no2,
        so2: reading.so2,
        coMgM3: reading.coMgM3,
        o3: reading.o3,
      };
      const calc = calculateIndianCpcbAqi(pollutants);

      return {
        stationId: loc.locationId,
        stationName: `${loc.city} Atmospheric Grid (${loc.districtName}) — Modeled Estimate`,
        city: loc.city,
        districtId: loc.districtId,
        districtName: loc.districtName,
        lat: loc.lat,
        lng: loc.lng,
        sourceKind: 'open_meteo_model_estimate',
        scaleMethod:
          calc.aqi !== null ? 'indian_scale_calculated_from_model_estimates' : 'unavailable',
        hasPhysicalStation: false,
        stationMetadataVerified: false,
        dataAvailable: true,
        freshness: openMeteoRes.value.isStale ? 'STALE' : 'LIVE',
        cpcbAqi: calc.aqi,
        cpcbAqiIsOfficial: false,
        cpcbAqiMethodologyNote:
          'Modeled Atmospheric Estimate: Indian-scale index independently calculated from Open-Meteo CAMS gridded hourly pollutants. NOT a physical ground sensor observation or official CPCB CAAQMS reading.',
        cpcbCategory: calc.category,
        prominentPollutant: calc.prominentPollutant,
        usAqi: iqAirUsAqi ?? reading.usAqi,
        europeanAqi: reading.europeanAqi,
        pollutants,
        provenance: {
          sourceName: iqAirUsAqi !== null
            ? 'Open-Meteo CAMS Atmospheric Model + IQAir (US-EPA Secondary)'
            : 'Open-Meteo Air Quality (CAMS Atmospheric Model)',
          sourceUrl: OPEN_METEO_AQ_DOCS,
          retrievedAt: openMeteoRes.value.retrievedAt,
          observedAt: reading.observedAt,
          locationOrDistrict: `${loc.city} Grid (${loc.districtName})`,
          dataCategory: 'air_quality',
          verificationStatus: 'verified',
          origin: 'secondary',
          isStale: openMeteoRes.value.isStale,
          scaleNote: 'Modeled Estimates (CAMS) · Indian-Scale Independent Calc + US AQI + European EAQI',
        },
      };
    }

    // 5. Fallback when all AQI providers are unconfigured or unreachable
    return {
      stationId: loc.locationId,
      stationName: `${loc.city} (${loc.districtName}) — Telemetry Unavailable`,
      city: loc.city,
      districtId: loc.districtId,
      districtName: loc.districtName,
      lat: loc.lat,
      lng: loc.lng,
      sourceKind: 'unavailable',
      scaleMethod: iqAirUsAqi !== null ? 'us_epa_secondary_only' : 'unavailable',
      hasPhysicalStation: false,
      stationMetadataVerified: false,
      dataAvailable: iqAirUsAqi !== null,
      freshness: iqAirUsAqi !== null ? 'LIVE' : 'UNAVAILABLE',
      cpcbAqi: null,
      cpcbAqiIsOfficial: false,
      cpcbAqiMethodologyNote:
        'Verified CPCB/OpenAQ station APIs are unconfigured/unavailable and Open-Meteo atmospheric model could not be reached.',
      cpcbCategory: 'Unavailable',
      prominentPollutant: null,
      usAqi: iqAirUsAqi,
      europeanAqi: null,
      pollutants: { pm25: null, pm10: null, no2: null, so2: null, coMgM3: null, o3: null },
      provenance: {
        sourceName: iqAirUsAqi !== null ? 'IQAir Secondary Feed' : 'AQI Aggregator',
        sourceUrl: iqAirUsAqi !== null ? IQAIR_PORTAL_URL : CPCB_PORTAL_URL,
        retrievedAt: now,
        observedAt: null,
        locationOrDistrict: `${loc.city}, ${loc.districtName}`,
        dataCategory: 'air_quality',
        verificationStatus: iqAirUsAqi !== null ? 'verified' : 'unavailable',
        origin: 'secondary',
      },
      unavailableReason:
        'Live AQI providers could not be reached. Configure DATA_GOV_IN_API_KEY (CPCB), OPENAQ_API_KEY, or WAQI_API_TOKEN for verified station telemetry.',
    };
  });

  const verifiedPhysicalStationCount = monitoredStations.filter(
    (s) => s.hasPhysicalStation && s.stationMetadataVerified
  ).length;
  const modelEstimateCount = monitoredStations.filter(
    (s) => s.sourceKind === 'open_meteo_model_estimate'
  ).length;
  const unmonitoredLocations = buildUnmonitoredRecords(now);
  const unavailableLocationCount =
    monitoredStations.filter((s) => s.sourceKind === 'unavailable').length +
    unmonitoredLocations.length;

  let activePrimarySource = 'Unavailable (No active air-quality provider responded)';
  if (verifiedPhysicalStationCount > 0 && cpcbOk) {
    activePrimarySource = `CPCB Official CAAQMS Ground Stations (${verifiedPhysicalStationCount} verified) + Regional Fallback`;
  } else if (verifiedPhysicalStationCount > 0 && openAqOk) {
    activePrimarySource = `OpenAQ v3 Physical Ground Sensors (${verifiedPhysicalStationCount} verified)`;
  } else if (verifiedPhysicalStationCount > 0 && waqiOk) {
    activePrimarySource = `WAQI / AQICN Secondary Stations (${verifiedPhysicalStationCount} verified · US-EPA Scale)`;
  } else if (modelEstimateCount > 0) {
    activePrimarySource =
      'Open-Meteo CAMS Atmospheric Model Estimates ONLY (0 verified physical ground stations active — CPCB/OpenAQ/WAQI keys not configured)';
  }

  return {
    fetchedAt: now,
    activePrimarySource,
    cpcbOfficialConnected: cpcbOk && verifiedPhysicalStationCount > 0,
    verifiedPhysicalStationCount,
    modelEstimateCount,
    unavailableLocationCount,
    scaleDisclaimer:
      'Physical monitoring station identity is strictly verified from live CPCB, OpenAQ, or WAQI metadata (never inferred from city coordinates). When physical station APIs are unconfigured, Open-Meteo CAMS gridded atmospheric model estimates are displayed explicitly as MODELED ESTIMATES (not physical sensors or official CPCB readings), and Indian CPCB NAQI, US-EPA AQI, and European EAQI remain cleanly separated.',
    monitoredStations,
    unmonitoredLocations,
  };
}

export async function getAqiStationById(
  stationId: string,
  forceRefresh = false
): Promise<AqiStationRecord | null> {
  const overview = await getOdishaAqiOverview(forceRefresh);
  return (
    overview.monitoredStations.find((s) => s.stationId === stationId) ||
    overview.unmonitoredLocations.find((s) => s.stationId === stationId) ||
    null
  );
}

export async function explainAqiStationWithGemini(station: AqiStationRecord): Promise<{
  explanation: string;
  usedGemini: boolean;
  reason?: string;
}> {
  if (!station.dataAvailable) {
    return {
      explanation: `Information unavailable: ${station.unavailableReason || 'No verified air-quality measurements exist for this location.'} Missing AQI data is never estimated.`,
      usedGemini: false,
    };
  }

  const isModelOnly = station.sourceKind === 'open_meteo_model_estimate';
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (isPlaceholderOrMissingEnv(apiKey)) {
    return {
      explanation: `${station.city} (${station.districtName}): ${
        isModelOnly ? 'Open-Meteo CAMS modeled estimate (not a physical station)' : station.provenance.sourceName
      } — Indian-scale index ${station.cpcbAqi ?? 'N/A'} (${station.cpcbCategory}), US AQI ${
        station.usAqi ?? 'N/A'
      }, PM2.5 ${station.pollutants.pm25 ?? 'N/A'} µg/m³. Configure GEMINI_API_KEY on the server for AI health-advisory summarization.`,
      usedGemini: false,
      reason: 'GEMINI_API_KEY not configured.',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const promptPayload = {
      stationName: station.stationName,
      city: station.city,
      district: station.districtName,
      sourceKind: station.sourceKind,
      hasPhysicalStation: station.hasPhysicalStation,
      scaleMethod: station.scaleMethod,
      cpcbAqi: station.cpcbAqi,
      cpcbCategory: station.cpcbCategory,
      cpcbAqiIsOfficial: station.cpcbAqiIsOfficial,
      methodologyNote: station.cpcbAqiMethodologyNote,
      usAqiSeparateScale: station.usAqi,
      europeanAqiSeparateScale: station.europeanAqi,
      prominentPollutant: station.prominentPollutant,
      pollutants: station.pollutants,
      observedAt: station.provenance.observedAt,
      source: station.provenance.sourceName,
    };

    const response = await ai.models.generateContent({
      model: GEMINI_TRIAGE_MODEL,
      contents: `Provide a concise, factual air-quality health & vulnerable-population preparedness explanation using ONLY these values. State explicitly whether this record is a verified physical ground station (${station.hasPhysicalStation}) or an Open-Meteo CAMS atmospheric model estimate (${isModelOnly}), NEVER describe a model estimate as an official CPCB reading or physical sensor, and mention precautions for children, elderly, pregnant women, and respiratory/cardiac patients.\n\nRECORD:\n${JSON.stringify(
        promptPayload
      )}`,
      config: {
        systemInstruction:
          'You are an environmental health communication assistant. Never fabricate missing pollutants and never label modeled Open-Meteo CAMS estimates as physical CPCB sensor readings. Keep under 120 words and cite the exact sourceKind.',
      },
    });

    const text = (response.text || '').trim();
    if (!text) throw new Error('Empty response from Gemini.');
    return { explanation: text, usedGemini: true };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Gemini request failed';
    return {
      explanation: `${station.city}: ${
        isModelOnly ? 'Modeled estimate (Open-Meteo CAMS)' : station.provenance.sourceName
      } — Indian-scale AQI ${station.cpcbAqi ?? 'N/A'} (${station.cpcbCategory}), prominent pollutant ${
        station.prominentPollutant ?? 'N/A'
      }. (AI narrative unavailable: ${reason})`,
      usedGemini: false,
      reason,
    };
  }
}
