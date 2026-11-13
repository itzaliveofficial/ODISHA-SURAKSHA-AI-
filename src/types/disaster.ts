/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HazardType = 'cyclone' | 'flood' | 'heatwave' | 'embankment' | 'landslide';

export type RiskLevel = 'critical' | 'high' | 'moderate' | 'advisory' | 'normal';

export type DistrictZone = 'coastal' | 'central' | 'northern' | 'southern';

export type DataMode = 'demonstration' | 'verified';

export type PlatformRecordClassification =
  | 'official_government_alert'
  | 'user_submitted_report'
  | 'secondary_external_info'
  | 'simulated_incident';

export type DataCategory =
  | 'official_disaster_alert'
  | 'official_weather'
  | 'rainfall_observation'
  | 'river_flood_info'
  | 'official_district_advisory'
  | 'air_quality'
  | 'user_submitted_report'
  | 'external_contextual_info'
  | 'simulated_demo';

export type RecordOrigin = 'official' | 'secondary' | 'user_submitted' | 'simulated';

export type ProviderHealthStatus =
  | 'CONNECTED'
  | 'NOT CONFIGURED'
  | 'TEMPORARILY UNAVAILABLE'
  | 'STALE DATA'
  | 'INVALID RESPONSE';

export interface SourceProvenance {
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  observedAt: string | null;
  locationOrDistrict: string;
  dataCategory: DataCategory;
  verificationStatus: 'verified' | 'unverified_user_report' | 'unavailable' | 'simulated';
  origin: RecordOrigin;
  isStale?: boolean;
  scaleNote?: string;
}

export interface DataSourceStatusEntry {
  id: string;
  name: string;
  category: DataCategory | 'incident_store';
  categoryLabel: string;
  classification: 'official' | 'secondary' | 'local_storage';
  status: ProviderHealthStatus;
  lastSuccessfulRetrieval: string | null;
  lastError: string | null;
  apiKeyRequired: boolean;
  apiKeyConfigured: boolean;
  envVarName?: string;
  websiteUrl: string;
  notes: string;
}

export interface SimulatedDistrictScenario {
  isSimulated: true;
  dataLabel: 'SIMULATED DATA';
  riskLevel: RiskLevel;
  rainfall24h: number; // mm (simulated demonstration values)
  rainfallForecast48h: number; // mm (simulated demonstration values)
  riverWaterLevelPercent: number; // % of danger level (simulated demonstration values)
  riverStatus: 'normal' | 'rising' | 'danger' | 'critical';
  windSpeedKmph: number; // simulated demonstration value
  heatIndexCelsius: number; // simulated demonstration value
  activeSheltersCount: number; // simulated demonstration value
  shelterCapacityTotal: number; // simulated demonstration value
  shelterCurrentOccupancy: number; // simulated demonstration value
  keyVulnerabilities: string[]; // planning/exercise notes
}

export interface DistrictRisk {
  id: string;
  name: string;
  odiaName: string;
  headquarters: string;
  zone: DistrictZone;
  riverBasin: string;
  populationDensity: number; // approx census persons per sq km
  lat: number;
  lng: number;
  svgPath: string;
  centroid: [number, number]; // [x, y] for label positioning in 0-1000 coordinate space
  simulatedScenario: SimulatedDistrictScenario;
}

export interface VulnerableDemographics {
  elderlyCount: number;          // Age 65+
  childrenCount: number;         // Age <10
  disabledCount: number;         // Persons with disabilities
  pregnantCount: number;         // Expectant & nursing mothers
  medicalConditionCount: number; // Serious chronic / acute medical conditions
  mobilityAidCount: number;      // Requiring wheelchair / stretcher / mobility aid
  livestockCount: number;        // Cattle & livestock needing shelter
}

export type IncidentStatus =
  | 'reported'
  | 'under_review'
  | 'assistance_required'
  | 'response_in_progress'
  | 'resolved';

export type IncidentUrgency = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_STANDARD';

export interface AITriageResult {
  summary: string;
  categorizedHazard: string;
  urgencyLevel: IncidentUrgency;
  priorityRationale: string;
  safetyChecklist: string[];
  immediateActions: string[];
  vulnerabilityImpact: string;
  missingInformation: string[];
  recommendedUnits: {
    unitName: string;
    role: string;
    equipment: string[];
  }[];
  evacuationAndShelterNotes: string;
  analyzedAt: string;
  isSimulatedAI: boolean;
  modelUsed: string;
  fallbackReason?: string;
}

export interface Incident {
  id: string;
  incidentCode: string;
  timestamp: string;
  updatedAt?: string;
  dataOrigin: 'simulated_demo' | 'user_submitted';
  recordClassification?: 'simulated_incident' | 'user_submitted_report';
  verificationStatus?: 'simulated' | 'unverified_user_report';
  districtId: string;
  districtName: string;
  blockOrLocation: string;
  landmark: string;
  hazardType: HazardType;
  urgency: IncidentUrgency;
  affectedKnown: boolean;
  peopleAffected: number | null;
  injuredCount: number | null;
  missingCount: number | null;
  hasVulnerablePeople: boolean;
  vulnerable: VulnerableDemographics;
  availableResources?: string;
  description: string;
  supportingImageDataUrl?: string;
  reporterName?: string;
  reporterContact?: string;
  status: IncidentStatus;
  coordinationNote?: string;
  assignedUnit?: string;
  vulnerabilityScore: number;
  aiTriageResult?: AITriageResult;
  clientSubmissionId?: string;
}

export interface EmergencyHelpline {
  agency: string;
  number: string;
  coverage: string;
  description: string;
  badge?: string;
}

export interface LiveHubWeather {
  id: string;
  hubName: string;
  districtId: string;
  corridorLabel: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windSpeedKmph: number;
  windDirection: string;
  condition: string;
  weatherCode: number;
  precipMm: number;
  pressureHpa: number;
  source: string;
  sourceUrl?: string;
  observedAt: string;
  retrievedAt?: string;
  isStale?: boolean;
}

export interface LiveWeatherResponse {
  hubs: LiveHubWeather[];
  fetchedAt: string;
  provider: string;
  disclaimer: string;
  isStale?: boolean;
}

// --- Official & Secondary Live Disaster Alerts ---

export interface DisasterAlertRecord {
  id: string;
  title: string;
  hazardType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';
  severityLabel: string;
  areaDescription: string;
  districtIdsMatched: string[];
  targetsOdisha: boolean;
  message: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  lat?: number | null;
  lng?: number | null;
  recordClassification: 'official_government_alert' | 'secondary_external_info';
  provenance: SourceProvenance;
}

export interface OfficialFeedAvailability {
  agency: string;
  category: DataCategory;
  available: boolean;
  status: ProviderHealthStatus;
  message: string;
  officialUrl: string;
  lastCheckedAt: string;
}

export interface DisasterAlertsResponse {
  fetchedAt: string;
  odishaAlerts: DisasterAlertRecord[];
  nationalCapAlerts: DisasterAlertRecord[];
  secondaryRegionalEvents: DisasterAlertRecord[];
  officialFeedStatuses: OfficialFeedAvailability[];
  disclaimer: string;
}

// --- Air Quality Index (AQI) Types ---

export type IndianAqiCategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Unavailable';

export type AqiSourceKind =
  | 'cpcb_ground_station'
  | 'openaq_ground_station'
  | 'secondary_provider_station'
  | 'open_meteo_model_estimate'
  | 'unavailable';

export type AqiScaleMethod =
  | 'cpcb_calculated_from_official_pollutants'
  | 'indian_scale_calculated_from_secondary_sensors'
  | 'indian_scale_calculated_from_model_estimates'
  | 'us_epa_secondary_only'
  | 'unavailable';

export interface AqiPollutants {
  pm25: number | null; // µg/m³
  pm10: number | null; // µg/m³
  no2: number | null; // µg/m³
  so2: number | null; // µg/m³
  coMgM3: number | null; // mg/m³ (converted if upstream in µg/m³)
  o3: number | null; // µg/m³
}

export interface AqiStationRecord {
  stationId: string;
  stationName: string;
  providerStationId?: string;
  city: string;
  districtId: string;
  districtName: string;
  lat: number;
  lng: number;
  sourceKind: AqiSourceKind;
  scaleMethod: AqiScaleMethod;
  hasPhysicalStation: boolean;
  stationMetadataVerified: boolean;
  dataAvailable: boolean;
  freshness: 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';
  // Indian CPCB National AQI (0–500)
  cpcbAqi: number | null;
  cpcbAqiIsOfficial: boolean; // true ONLY when derived from verified official CPCB CAAQMS data
  cpcbAqiMethodologyNote: string;
  cpcbCategory: IndianAqiCategory;
  prominentPollutant: string | null;
  // Separate Secondary Scales (NEVER mixed into CPCB AQI)
  usAqi: number | null;
  europeanAqi: number | null;
  pollutants: AqiPollutants;
  provenance: SourceProvenance;
  unavailableReason?: string;
}

export interface OdishaAqiResponse {
  fetchedAt: string;
  activePrimarySource: string;
  cpcbOfficialConnected: boolean;
  verifiedPhysicalStationCount: number;
  modelEstimateCount: number;
  unavailableLocationCount: number;
  scaleDisclaimer: string;
  monitoredStations: AqiStationRecord[];
  unmonitoredLocations: AqiStationRecord[];
}
