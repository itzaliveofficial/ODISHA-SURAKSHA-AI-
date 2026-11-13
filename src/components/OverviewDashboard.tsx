/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type {
  DataMode,
  DisasterAlertsResponse,
  DistrictRisk,
  Incident,
  OdishaAqiResponse,
} from '../types/disaster';
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Activity,
  ArrowRight,
  Flame,
  Droplets,
  Waves,
  HeartHandshake,
  Cpu,
  FilePlus2,
  Wind,
  Radio,
  RefreshCw,
  ExternalLink,
  Database,
} from 'lucide-react';
import type { ActiveTab } from './Header';
import { LiveWeatherWidget } from './LiveWeatherWidget';
import { summarizeVerifiedAlerts } from '../services/liveDataService';

interface OverviewDashboardProps {
  districts: DistrictRisk[];
  incidents: Incident[];
  dataMode: DataMode;
  storageType: string;
  liveAlerts: DisasterAlertsResponse | null;
  liveAlertsLoading: boolean;
  liveAlertsError: string;
  aqiOverview: OdishaAqiResponse | null;
  onRefreshLiveFeeds: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onSelectDistrict: (district: DistrictRisk) => void;
  onSelectIncidentForTriage: (incident: Incident) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  districts,
  incidents,
  dataMode,
  storageType,
  liveAlerts,
  liveAlertsLoading,
  liveAlertsError,
  aqiOverview,
  onRefreshLiveFeeds,
  onNavigate,
  onSelectDistrict,
  onSelectIncidentForTriage,
}) => {
  const isDemoMode = dataMode === 'demonstration';
  const [aiBriefing, setAiBriefing] = useState<{
    summary: string;
    usedGemini: boolean;
    alertsSnapshotAt: string;
  } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const totalDistricts = districts.length;
  const criticalDistricts = districts.filter((d) => d.simulatedScenario.riskLevel === 'critical').length;
  const highRiskDistricts = districts.filter((d) => d.simulatedScenario.riskLevel === 'high').length;

  const totalIncidents = incidents.length;
  const p1Incidents = incidents.filter((i) => i.urgency === 'P1_CRITICAL').length;
  const p2Incidents = incidents.filter((i) => i.urgency === 'P2_HIGH').length;
  const inProgressCount = incidents.filter(
    (i) => i.status === 'assistance_required' || i.status === 'response_in_progress'
  ).length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;

  const totalVulnerable = incidents.reduce((acc, i) => {
    const v = i.vulnerable;
    return (
      acc +
      (v.pregnantCount || 0) +
      (v.childrenCount || 0) +
      (v.disabledCount || 0) +
      (v.elderlyCount || 0) +
      (v.medicalConditionCount || 0) +
      (v.mobilityAidCount || 0)
    );
  }, 0);
  const totalPregnant = incidents.reduce((acc, i) => acc + (i.vulnerable.pregnantCount || 0), 0);
  const totalMedicalMobility = incidents.reduce(
    (acc, i) => acc + (i.vulnerable.medicalConditionCount || 0) + (i.vulnerable.mobilityAidCount || 0),
    0
  );

  const floodIncidents = incidents.filter((i) => i.hazardType === 'flood').length;
  const cycloneIncidents = incidents.filter((i) => i.hazardType === 'cyclone').length;
  const embankmentIncidents = incidents.filter((i) => i.hazardType === 'embankment').length;
  const heatwaveIncidents = incidents.filter((i) => i.hazardType === 'heatwave').length;
  const landslideIncidents = incidents.filter((i) => i.hazardType === 'landslide').length;
  const pct = (count: number) => (totalIncidents > 0 ? Math.round((count / totalIncidents) * 100) : 0);

  const odishaCapAlerts = liveAlerts?.odishaAlerts || [];
  const nationalCapAlerts = liveAlerts?.nationalCapAlerts || [];
  const regionalEvents = liveAlerts?.secondaryRegionalEvents || [];
  const feedStatuses = liveAlerts?.officialFeedStatuses || [];
  const sachetConnected = feedStatuses.some(
    (f) => f.agency.includes('NDMA') && f.available
  );

  const sampleAqiCities = (aqiOverview?.monitoredStations || []).slice(0, 4);

  const handleSummarizeAlerts = async () => {
    setIsSummarizing(true);
    try {
      const res = await summarizeVerifiedAlerts();
      setAiBriefing({
        summary: res.summary,
        usedGemini: res.usedGemini,
        alertsSnapshotAt: res.alertsSnapshotAt,
      });
    } catch {
      setAiBriefing({
        summary: 'Unable to generate summary right now. Review verified source cards directly below.',
        usedGemini: false,
        alertsSnapshotAt: new Date().toISOString(),
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Operational Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#111C35] to-[#0A1326] border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal-400 font-semibold tracking-wider uppercase">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>Odisha Disaster &amp; Environmental Intelligence</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={isDemoMode ? 'text-amber-300' : 'text-teal-300'}>
                {isDemoMode ? 'DEMONSTRATION MODE (SIMULATED)' : 'LIVE OFFICIAL / VERIFIED MODE'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {isDemoMode
                ? 'Statewide Multi-Hazard Simulation & Training Console'
                : 'Live Verified Alerts, Weather & Odisha AQI Console'}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isDemoMode
                ? 'Displays clearly labelled simulated Odisha disaster exercises alongside live surface weather & air quality context for rapid demonstration.'
                : 'Retrieves real CAP feeds from NDMA SACHET, live weather observations, Odisha AQI telemetry, regional UN GDACS / USGS / NASA feeds, and persisted community incident reports.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              <span>
                NDMA SACHET CAP:{' '}
                <strong className={sachetConnected ? 'text-emerald-300' : 'text-amber-300'}>
                  {sachetConnected ? 'CONNECTED' : 'Checking / Unavailable'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Odisha AQI:{' '}
                <strong className="text-teal-300">
                  {aqiOverview
                    ? aqiOverview.verifiedPhysicalStationCount > 0
                      ? `${aqiOverview.verifiedPhysicalStationCount} physical station(s) verified`
                      : `${aqiOverview.modelEstimateCount} Open-Meteo model locations (0 physical stations)`
                    : 'Loading'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onNavigate('sources')}
                className="text-teal-400 hover:text-teal-300 underline"
              >
                Inspect All Data Sources →
              </button>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('aqi')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Wind className="w-4 h-4" />
              <span>Open Odisha AQI Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('districts')}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>Inspect District Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Official CAP Alerts / Demo District Risk */}
        <button
          type="button"
          onClick={() => onNavigate(isDemoMode ? 'districts' : 'sources')}
          className="text-left bg-[#0D1527] border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>{isDemoMode ? 'District Risk (SIMULATED)' : 'Official CAP Alerts (Odisha)'}</span>
            <ShieldAlert className={`w-4 h-4 ${isDemoMode ? 'text-rose-400' : 'text-teal-400'}`} />
          </div>
          {isDemoMode ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white font-mono tabular-nums">{criticalDistricts}</span>
                <span className="text-xs text-amber-300 font-semibold">
                  Critical ({highRiskDistricts} High · Sim)
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                <span>{totalDistricts} districts mapped</span>
                <span className="text-teal-400">District map →</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white font-mono tabular-nums">
                  {odishaCapAlerts.length}
                </span>
                <span className="text-xs text-teal-300 font-semibold">
                  Odisha ({nationalCapAlerts.length} India CAP)
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                <span>Source: NDMA SACHET</span>
                <span className="text-teal-400">Sources →</span>
              </div>
            </>
          )}
        </button>

        {/* Card 2: User-Submitted / Active Incidents */}
        <button
          type="button"
          onClick={() => onNavigate('response')}
          className="text-left bg-[#0D1527] border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>{isDemoMode ? 'Incidents (Simulated + User)' : 'User Reports (Unverified)'}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono tabular-nums">{totalIncidents}</span>
            <span className="text-xs text-amber-400 font-semibold">({p1Incidents} Priority 1)</span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>{p2Incidents} P2 High · {storageType.split(' ')[0]} Store</span>
            <span className="text-teal-400">Response deck →</span>
          </div>
        </button>

        {/* Card 3: Odisha AQI Summary */}
        <button
          type="button"
          onClick={() => onNavigate('aqi')}
          className="text-left bg-[#0D1527] border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>
              {sampleAqiCities[0]?.sourceKind === 'cpcb_ground_station'
                ? 'Odisha Air Quality (CPCB Station)'
                : sampleAqiCities[0]?.sourceKind === 'open_meteo_model_estimate'
                ? 'Odisha Air Quality (Model Estimate)'
                : 'Odisha Air Quality Index'}
            </span>
            <Wind className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono tabular-nums">
              {sampleAqiCities[0]?.cpcbAqi ?? sampleAqiCities[0]?.usAqi ?? '—'}
            </span>
            <span className="text-xs text-cyan-300 font-semibold">
              {sampleAqiCities[0]
                ? `${sampleAqiCities[0].city} (${
                    sampleAqiCities[0].cpcbAqi !== null
                      ? sampleAqiCities[0].cpcbCategory
                      : sampleAqiCities[0].usAqi !== null
                      ? 'US AQI'
                      : 'Unavailable'
                  })`
                : 'Loading AQI...'}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>
              {aqiOverview?.cpcbOfficialConnected
                ? 'CPCB Official Station'
                : sampleAqiCities[0]?.sourceKind === 'openaq_ground_station'
                ? 'OpenAQ Physical Sensor'
                : sampleAqiCities[0]?.sourceKind === 'secondary_provider_station'
                ? 'WAQI Secondary Station (US-EPA)'
                : 'Open-Meteo CAMS Model (No Sensor)'}
            </span>
            <span className="text-teal-400">AQI tab →</span>
          </div>
        </button>

        {/* Card 4: Vulnerable Needs / Coordination */}
        <button
          type="button"
          onClick={() => onNavigate('vulnerable')}
          className="text-left bg-[#0D1527] border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Vulnerable Cohort Flagged</span>
            <HeartHandshake className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono tabular-nums">{totalVulnerable}</span>
            <span className="text-xs text-emerald-400 font-semibold">
              {inProgressCount} active · {resolvedCount} resolved
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>{totalPregnant} Expectant · {totalMedicalMobility} Med/Mob</span>
            <span className="text-teal-400">Queue →</span>
          </div>
        </button>
      </div>

      {/* LIVE OFFICIAL & SECONDARY VERIFIED DATA SECTION (Always cleanly separated by origin) */}
      <section className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Radio className="w-4 h-4 text-teal-400" />
              <h2 className="text-base font-semibold text-white">
                {isDemoMode
                  ? 'External Feeds (Separated from Simulated Scenarios)'
                  : 'Official Government Alerts & Secondary External Feeds'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Retrieved live from NDMA SACHET CAP, GDACS, USGS Earthquakes, and NASA EONET with explicit agency availability reporting.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSummarizeAlerts}
              disabled={isSummarizing || liveAlertsLoading}
              className="px-3 py-1.5 text-xs font-medium text-teal-200 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{isSummarizing ? 'Summarizing...' : 'Gemini Briefing'}</span>
            </button>
            <button
              type="button"
              onClick={onRefreshLiveFeeds}
              disabled={liveAlertsLoading}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${liveAlertsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {liveAlertsError && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
            Live alert feed warning: {liveAlertsError}
          </div>
        )}

        {aiBriefing && (
          <div className="bg-[#121B30] border border-teal-500/30 rounded-lg p-4 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-teal-300 font-semibold">
              <span>
                {aiBriefing.usedGemini
                  ? 'Gemini Briefing (Grounded Exclusively in Retrieved Feeds Below)'
                  : 'Deterministic Telemetry Summary'}
              </span>
              <span className="font-mono text-slate-400">
                Snapshot: {new Date(aiBriefing.alertsSnapshotAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              </span>
            </div>
            <p className="text-slate-200 leading-relaxed whitespace-pre-line">{aiBriefing.summary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Category 1: Official CAP Alerts (Odisha + India) */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-teal-300">Official Disaster Alerts (NDMA SACHET)</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300">
                OFFICIAL CAP
              </span>
            </div>
            {odishaCapAlerts.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                {odishaCapAlerts.map((alert) => (
                  <div key={alert.id} className="p-2.5 rounded bg-slate-900 border border-rose-500/30 text-xs space-y-1">
                    <div className="font-semibold text-rose-300">{alert.title}</div>
                    <p className="text-[11px] text-slate-300">{alert.message}</p>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{alert.provenance.sourceName}</span>
                      <a
                        href={alert.provenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:underline flex items-center gap-0.5"
                      >
                        Verify <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-300 space-y-2">
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-[11px]">
                  <strong className="text-emerald-300">0 Active Odisha CAP Alerts</strong> published right now on{' '}
                  <a
                    href="https://sachet.ndma.gov.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:underline"
                  >
                    NDMA SACHET
                  </a>
                  . ({nationalCapAlerts.length} active alert(s) in other Indian states.)
                </div>
                {nationalCapAlerts.slice(0, 2).map((a) => (
                  <div key={a.id} className="text-[11px] text-slate-400 border-l-2 border-slate-700 pl-2">
                    <span className="text-slate-200 font-medium">{a.hazardType}:</span> {a.areaDescription}{' '}
                    <span className="font-mono text-[10px]">({a.severityLabel})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category 2: Regional Context (GDACS / USGS / NASA EONET) */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-300">Secondary Regional Feeds (GDACS / USGS / EONET)</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">
                EXTERNAL
              </span>
            </div>
            {regionalEvents.length === 0 ? (
              <div className="text-[11px] text-slate-400 p-2.5 rounded bg-slate-900/80 border border-slate-800">
                0 active regional seismic (USGS M2.5+ Odisha sector), NASA EONET, or GDACS India alerts retrieved.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                {regionalEvents.slice(0, 4).map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">{ev.title}</span>
                      <span className="text-[10px] font-mono text-amber-300 shrink-0">{ev.severityLabel}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{ev.message}</p>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>{ev.provenance.sourceName}</span>
                      <a
                        href={ev.provenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:underline flex items-center gap-0.5"
                      >
                        Source <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category 3: Official Agency Availability (IMD / OSDMA / CWC) */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Official Indian Agency Integration Status</span>
              <button
                type="button"
                onClick={() => onNavigate('sources')}
                className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                <Database className="w-3 h-3" />
                <span>Details</span>
              </button>
            </div>
            <div className="space-y-2 text-[11px]">
              {feedStatuses.map((f) => (
                <div key={f.agency} className="p-2 rounded bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200 truncate">{f.agency}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        f.available
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-800 text-amber-300'
                      }`}
                    >
                      {f.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{f.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Odisha Hub Weather Widget */}
      <LiveWeatherWidget
        onSelectHubDistrict={(districtId) => {
          const matchedDistrict = districts.find((d) => d.id === districtId);
          if (matchedDistrict) {
            onSelectDistrict(matchedDistrict);
            onNavigate('districts');
          }
        }}
      />

      {/* Main Grid: Active Incident Queue & Hazard Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                {isDemoMode
                  ? 'Recent Incidents (Simulated Scenarios + User Reports)'
                  : 'User-Submitted Field Reports (Unverified Community Inputs)'}
              </h2>
              <p className="text-xs text-slate-400">
                {isDemoMode
                  ? 'Clearly labelled demonstration exercises combined with persisted field submissions'
                  : 'Separated from official NDMA/government CAP feeds; displays reports submitted via Report Incident'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('response')}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium whitespace-nowrap"
            >
              View all ({incidents.length})
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="py-10 text-center space-y-3 bg-[#121B30] border border-slate-800 rounded-lg p-6">
              <FilePlus2 className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">
                No Community Field Reports Logged Yet
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Live Official / Verified Mode keeps community reports separate from official CAP
                feeds above. Submit an incident report or switch to Demonstration Mode for sample scenarios.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('report')}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors"
              >
                Report Field Incident
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 4).map((incident) => {
                const isP1 = incident.urgency === 'P1_CRITICAL';
                const isSim = incident.dataOrigin === 'simulated_demo';
                return (
                  <div
                    key={incident.id}
                    className="bg-[#121B30] border border-slate-800/80 hover:border-slate-700 rounded-lg p-4 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                            isP1
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {incident.urgency.replace('_', ' ')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isSim
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {isSim ? 'SIMULATED INCIDENT' : 'USER REPORT (UNVERIFIED)'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{incident.incidentCode}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-xs font-semibold text-slate-200">{incident.districtName}</span>
                        <span className="text-xs text-slate-400">({incident.blockOrLocation})</span>
                      </div>

                      <div className="text-xs text-slate-400 font-mono tabular-nums">
                        VPI: <strong className="text-teal-300">{incident.vulnerabilityScore}</strong>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-3">
                      {incident.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/60 pt-2.5">
                      <div className="flex flex-wrap items-center gap-3 text-slate-400">
                        <span>
                          Affected:{' '}
                          <strong className="text-slate-200 font-mono">
                            {incident.peopleAffected !== null ? incident.peopleAffected : 'Unknown'}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Pregnant: <strong className="text-rose-300 font-mono">{incident.vulnerable.pregnantCount}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Med/Mobility:{' '}
                          <strong className="text-cyan-300 font-mono">
                            {(incident.vulnerable.medicalConditionCount || 0) + (incident.vulnerable.mobilityAidCount || 0)}
                          </strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectIncidentForTriage(incident)}
                        className="px-2.5 py-1 text-[11px] font-medium text-teal-300 bg-teal-500/10 border border-teal-500/30 rounded hover:bg-teal-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <Cpu className="w-3 h-3 text-teal-400" />
                        <span>{incident.aiTriageResult ? 'View AI Triage' : 'Run AI Triage'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Hazard Breakdown & Quick AQI Cities */}
        <div className="space-y-6">
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Reported Hazard Breakdown</h3>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">{totalIncidents} total</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Floods &amp; Flash Floods</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-200">{floodIncidents} ({pct(floodIncidents)}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${pct(floodIncidents)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    <span>Cyclone / Coastal Surge</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-200">{cycloneIncidents} ({pct(cycloneIncidents)}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct(cycloneIncidents)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Embankment / Landslide</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-200">
                    {embankmentIncidents + landslideIncidents} ({pct(embankmentIncidents + landslideIncidents)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct(embankmentIncidents + landslideIncidents)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Severe Heatwave</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-200">{heatwaveIncidents} ({pct(heatwaveIncidents)}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct(heatwaveIncidents)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Odisha AQI Quick Panel */}
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Odisha AQI Snapshot ({aqiOverview?.cpcbOfficialConnected ? 'Official CPCB' : 'Modeled / Secondary'})
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('aqi')}
                className="text-xs text-teal-400 hover:text-teal-300"
              >
                Full AQI view →
              </button>
            </div>
            {sampleAqiCities.length === 0 ? (
              <div className="text-xs text-slate-400">Loading Odisha air-quality hubs...</div>
            ) : (
              <div className="space-y-2">
                {sampleAqiCities.map((st) => (
                  <button
                    key={st.stationId}
                    type="button"
                    onClick={() => onNavigate('aqi')}
                    className="w-full text-left p-2.5 rounded-lg bg-[#121B30] hover:bg-[#16223D] border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-white flex items-center gap-1.5">
                        <span>{st.city}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                          {st.sourceKind === 'cpcb_ground_station'
                            ? 'CPCB'
                            : st.sourceKind === 'openaq_ground_station'
                            ? 'OpenAQ'
                            : st.sourceKind === 'secondary_provider_station'
                            ? 'WAQI'
                            : st.sourceKind === 'open_meteo_model_estimate'
                            ? 'MODEL EST.'
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        PM2.5: {st.pollutants.pm25 ?? '—'} · PM10: {st.pollutants.pm10 ?? '—'} µg/m³
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-teal-300 font-bold">{st.cpcbAqi ?? st.usAqi ?? 'N/A'}</div>
                      <div className="text-[10px] text-slate-400">
                        {st.cpcbAqi !== null ? st.cpcbCategory : st.usAqi !== null ? 'US AQI' : 'Unavailable'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
