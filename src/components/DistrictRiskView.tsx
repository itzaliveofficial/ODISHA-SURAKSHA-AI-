/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type {
  DataMode,
  DisasterAlertsResponse,
  DistrictRisk,
  Incident,
  LiveHubWeather,
  OdishaAqiResponse,
} from '../types/disaster';
import { OdishaMap } from './OdishaMap';
import { OdishaGoogleMap } from './OdishaGoogleMap';
import {
  Droplets,
  Wind,
  AlertTriangle,
  Waves,
  Search,
  MapPin,
  Layers,
  Thermometer,
  RefreshCw,
  Cpu,
  ExternalLink,
} from 'lucide-react';
import type { ActiveTab } from './Header';

interface DistrictRiskViewProps {
  districts: DistrictRisk[];
  incidents: Incident[];
  dataMode: DataMode;
  selectedDistrict: DistrictRisk;
  liveAlerts: DisasterAlertsResponse | null;
  aqiOverview: OdishaAqiResponse | null;
  onSelectDistrict: (district: DistrictRisk) => void;
  onNavigateToReport: (districtName: string) => void;
  onSelectIncidentForTriage: (incident: Incident) => void;
  onNavigateToTab: (tab: ActiveTab) => void;
  mapsApiKey: string;
  quotaExceeded: boolean;
}

export const DistrictRiskView: React.FC<DistrictRiskViewProps> = ({
  districts,
  incidents,
  dataMode,
  selectedDistrict,
  liveAlerts,
  aqiOverview,
  onSelectDistrict,
  onNavigateToReport,
  onSelectIncidentForTriage,
  onNavigateToTab,
  mapsApiKey,
  quotaExceeded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hazardFilter, setHazardFilter] = useState<'all' | 'cyclone' | 'flood' | 'heatwave'>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [mapMode, setMapMode] = useState<'google' | 'vector'>(
    !mapsApiKey || quotaExceeded ? 'vector' : 'google'
  );

  // Live weather state for the selected district HQ
  const [districtWeather, setDistrictWeather] = useState<LiveHubWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string>('');

  const loadDistrictWeather = async (districtId: string, forceRefresh = false) => {
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const url = forceRefresh
        ? `/api/weather/district/${encodeURIComponent(districtId)}?refresh=true`
        : `/api/weather/district/${encodeURIComponent(districtId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Weather service returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as LiveHubWeather;
      setDistrictWeather(data);
    } catch (err: unknown) {
      setDistrictWeather(null);
      setWeatherError(err instanceof Error ? err.message : 'Live weather unavailable for this district.');
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    loadDistrictWeather(selectedDistrict.id, false);
  }, [selectedDistrict.id]);

  const isDemoMode = dataMode === 'demonstration';
  const districtIncidents = incidents.filter((i) => i.districtId === selectedDistrict.id);

  // Match official CAP alerts targeting this district
  const matchingOfficialAlerts = (liveAlerts?.odishaAlerts || []).filter(
    (a) =>
      a.districtIdsMatched.includes(selectedDistrict.id) ||
      a.areaDescription.toLowerCase().includes(selectedDistrict.name.toLowerCase())
  );

  // Match AQI station (either monitored city OR explicitly unmonitored district record)
  const matchingAqiStation =
    aqiOverview?.monitoredStations.find((s) => s.districtId === selectedDistrict.id) ||
    aqiOverview?.unmonitoredLocations.find((s) => s.districtId === selectedDistrict.id) ||
    null;

  const filteredDistricts = districts.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.odiaName.includes(searchQuery) ||
      d.headquarters.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = zoneFilter === 'all' || d.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  const getRiskBadge = (level: DistrictRisk['simulatedScenario']['riskLevel']) => {
    switch (level) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      case 'moderate':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      default:
        return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
    }
  };

  const getRiverStatusBadge = (status: DistrictRisk['simulatedScenario']['riverStatus']) => {
    switch (status) {
      case 'critical':
        return 'text-rose-400 font-bold';
      case 'danger':
        return 'text-orange-400 font-bold';
      case 'rising':
        return 'text-amber-400 font-medium';
      default:
        return 'text-teal-400 font-normal';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-teal-400 font-semibold uppercase tracking-wider mb-1">
            <Waves className="w-4 h-4 text-teal-400" />
            <span>30-District Monitoring &amp; Geospatial Layer</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className={isDemoMode ? 'text-amber-300' : 'text-teal-300'}>
              {isDemoMode ? 'DEMONSTRATION MODE' : 'LIVE OFFICIAL / VERIFIED MODE'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Odisha District Risk, Weather &amp; AQI Monitor
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Static district geography is strictly separated from live provider observations (weather, AQI, NDMA alerts). Missing official feeds show unavailable rather than fallback values.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setMapMode('google')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                mapMode === 'google' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </button>
            <button
              type="button"
              onClick={() => setMapMode('vector')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                mapMode === 'vector' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Custom Vector Map</span>
            </button>
          </div>

          {isDemoMode && (
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              {(['all', 'cyclone', 'flood', 'heatwave'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHazardFilter(mode)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap capitalize ${
                    hazardFilter === mode ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'all' ? 'All Hazards' : mode}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick District Selectors Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <span className="text-slate-400 shrink-0 font-medium">Quick Select:</span>
        {['puri', 'cuttack', 'khordha', 'balasore', 'angul', 'sundargarh', 'sambalpur', 'ganjam', 'malkangiri', 'kandhamal'].map((dId) => {
          const d = districts.find((item) => item.id === dId);
          if (!d) return null;
          const isSelected = selectedDistrict.id === d.id;
          const count = incidents.filter((i) => i.districtId === d.id).length;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDistrict(d)}
              className={`px-3 py-1 rounded-md shrink-0 transition-colors ${
                isSelected
                  ? 'bg-teal-500/25 text-teal-200 border border-teal-500/50 font-semibold'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {d.name} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Two Column Layout: Interactive Map + District Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          {mapMode === 'google' ? (
            <OdishaGoogleMap
              apiKey={mapsApiKey}
              selectedDistrictId={selectedDistrict.id}
              onSelectDistrict={onSelectDistrict}
              incidents={incidents}
              dataMode={dataMode}
              hazardFilter={hazardFilter}
              quotaExceeded={quotaExceeded}
              onFallbackToVector={() => setMapMode('vector')}
              onSelectIncidentForTriage={onSelectIncidentForTriage}
            />
          ) : (
            <OdishaMap
              selectedDistrictId={selectedDistrict.id}
              onSelectDistrict={onSelectDistrict}
              incidents={incidents}
              dataMode={dataMode}
              hazardFilter={hazardFilter}
              onSelectIncidentForTriage={onSelectIncidentForTriage}
            />
          )}

          {/* District Search & Quick Filter Table */}
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Filter Odisha districts"
                  placeholder="Search all 30 districts by name, HQ, or Odia..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                {['all', 'coastal', 'central', 'northern', 'southern'].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoneFilter(z)}
                    className={`px-2 py-1 rounded capitalize ${
                      zoneFilter === z
                        ? 'bg-slate-700 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto no-scrollbar border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 sticky top-0 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">District (Static Geography)</th>
                    <th className="py-2 px-3">Zone</th>
                    <th className="py-2 px-3 text-right">Reports</th>
                    <th className="py-2 px-3">{isDemoMode ? 'Sim Risk' : 'Official CAP'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDistricts.map((d) => {
                    const count = incidents.filter((i) => i.districtId === d.id).length;
                    const alertHit = (liveAlerts?.odishaAlerts || []).some(
                      (a) =>
                        a.districtIdsMatched.includes(d.id) ||
                        a.areaDescription.toLowerCase().includes(d.name.toLowerCase())
                    );
                    return (
                      <tr
                        key={d.id}
                        onClick={() => onSelectDistrict(d)}
                        className={`cursor-pointer transition-colors ${
                          selectedDistrict.id === d.id
                            ? 'bg-teal-500/15 text-white'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-3 font-medium">
                          {d.name} <span className="text-slate-400 font-normal">({d.odiaName})</span>
                        </td>
                        <td className="py-2 px-3 capitalize text-slate-400">{d.zone}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{count}</td>
                        <td className="py-2 px-3">
                          {isDemoMode ? (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${getRiskBadge(d.simulatedScenario.riskLevel)}`}>
                              {d.simulatedScenario.riskLevel} (Sim)
                            </span>
                          ) : alertHit ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                              CAP ALERT
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">0 CAP Alerts</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Selected District Panel */}
        <div className="lg:col-span-5 bg-[#0D1527] border border-slate-800 rounded-xl p-6 space-y-5">
          {/* Static Geographic Identity Header */}
          <div className="border-b border-slate-800/80 pb-4">
            <div className="flex items-center justify-between gap-2">
              {isDemoMode ? (
                <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono uppercase ${getRiskBadge(selectedDistrict.simulatedScenario.riskLevel)}`}>
                  {selectedDistrict.simulatedScenario.riskLevel} RISK (SIMULATED DATA)
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  LIVE OFFICIAL &amp; OBSERVED CONTEXT VIEW
                </span>
              )}
              <span className="text-xs text-slate-400 capitalize">
                Zone: <strong className="text-slate-300">{selectedDistrict.zone} Odisha</strong>
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">{selectedDistrict.name}</h2>
              <span className="text-lg font-medium text-teal-400">{selectedDistrict.odiaName}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              HQ: <strong className="text-slate-300">{selectedDistrict.headquarters}</strong> · Basin:{' '}
              <strong className="text-slate-300">{selectedDistrict.riverBasin}</strong> · Coords:{' '}
              <span className="font-mono">
                {selectedDistrict.lat.toFixed(2)}°N, {selectedDistrict.lng.toFixed(2)}°E
              </span>
            </div>
          </div>

          {/* 1. Real Live Surface Weather Observation */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-teal-300">
                Live Surface Weather ({selectedDistrict.name} HQ)
              </div>
              <button
                type="button"
                onClick={() => loadDistrictWeather(selectedDistrict.id, true)}
                disabled={weatherLoading}
                className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${weatherLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {weatherLoading && !districtWeather ? (
              <div className="text-xs text-slate-400 animate-pulse">Loading live meteorological observations...</div>
            ) : weatherError ? (
              <div className="text-xs text-amber-300">Live weather unavailable: {weatherError}</div>
            ) : districtWeather ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-amber-400" />
                      <span>Temp</span>
                    </div>
                    <div className="font-mono font-bold text-white text-sm">{districtWeather.temperatureC}°C</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-sky-400" />
                      <span>Humidity / Rain</span>
                    </div>
                    <div className="font-mono font-bold text-white text-sm">
                      {districtWeather.humidityPercent}% · {districtWeather.precipMm}mm
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Wind className="w-3 h-3 text-teal-400" />
                      <span>Wind</span>
                    </div>
                    <div className="font-mono font-bold text-white text-sm">
                      {districtWeather.windSpeedKmph} km/h {districtWeather.windDirection}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1">
                  <span>
                    Source: {districtWeather.source} {districtWeather.isStale ? '(STALE)' : ''} ·{' '}
                    {districtWeather.condition}
                  </span>
                  <span className="font-mono">
                    {new Date(districtWeather.observedAt).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    IST
                  </span>
                </div>
              </>
            ) : null}
          </div>

          {/* 2. Real District AQI Observation (Only where station/coverage exists!) */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-300">Air Quality Observation (District)</span>
              <button
                type="button"
                onClick={() => onNavigateToTab('aqi')}
                className="text-[11px] text-teal-400 hover:underline"
              >
                Open AQI Dashboard →
              </button>
            </div>
            {matchingAqiStation && matchingAqiStation.dataAvailable ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{matchingAqiStation.stationName}</span>
                  <span className="font-mono font-bold text-white shrink-0">
                    {matchingAqiStation.cpcbAqi !== null
                      ? `${matchingAqiStation.cpcbAqi} (${matchingAqiStation.cpcbCategory})`
                      : matchingAqiStation.usAqi !== null
                      ? `${matchingAqiStation.usAqi} US AQI`
                      : 'Unavailable'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  PM2.5: {matchingAqiStation.pollutants.pm25 ?? 'N/A'} µg/m³ · PM10:{' '}
                  {matchingAqiStation.pollutants.pm10 ?? 'N/A'} µg/m³ ·{' '}
                  {matchingAqiStation.sourceKind === 'cpcb_ground_station'
                    ? 'Official CPCB CAAQMS Station'
                    : matchingAqiStation.sourceKind === 'openaq_ground_station'
                    ? 'OpenAQ Physical Ground Station'
                    : matchingAqiStation.sourceKind === 'secondary_provider_station'
                    ? 'WAQI Secondary Station (US-EPA Scale)'
                    : 'Open-Meteo Model Estimate (Not Physical Station)'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Source: {matchingAqiStation.provenance.sourceName} · {matchingAqiStation.freshness}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">
                {matchingAqiStation?.unavailableReason ||
                  `No CPCB/ground air-quality monitoring station registered for ${selectedDistrict.name}.`}
              </div>
            )}
          </div>

          {/* 3. Official District CAP Alerts */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Official CAP Alerts ({selectedDistrict.name})</span>
              <a
                href="https://sachet.ndma.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-teal-400 hover:underline flex items-center gap-0.5"
              >
                NDMA SACHET <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            {matchingOfficialAlerts.length > 0 ? (
              matchingOfficialAlerts.map((a) => (
                <div key={a.id} className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200">
                  <strong>{a.title}:</strong> {a.message}
                </div>
              ))
            ) : (
              <div className="text-[11px] text-slate-400">
                0 active official CAP alerts for {selectedDistrict.name} on NDMA SACHET right now.
              </div>
            )}
          </div>

          {/* 4. District Incidents List */}
          <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">
                Incidents in {selectedDistrict.name} ({districtIncidents.length})
              </span>
              <span className="text-[11px] text-slate-400">
                {isDemoMode ? 'Simulated + User Reports' : 'User Reports (Unverified)'}
              </span>
            </div>

            {districtIncidents.length === 0 ? (
              <div className="text-xs text-slate-400 py-1">
                No {isDemoMode ? '' : 'user-submitted '}incident reports recorded for {selectedDistrict.name}.
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                {districtIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-2.5 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-teal-300 font-bold">{inc.incidentCode}</span>
                        <span className="text-[10px] uppercase text-slate-400">
                          {inc.dataOrigin === 'simulated_demo' ? 'SIMULATED' : 'USER REPORT (UNVERIFIED)'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">{inc.blockOrLocation}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectIncidentForTriage(inc)}
                      className="px-2 py-1 text-[11px] text-teal-300 bg-teal-500/10 border border-teal-500/30 rounded hover:bg-teal-500/20 shrink-0 flex items-center gap-1"
                    >
                      <Cpu className="w-3 h-3" />
                      <span>Triage</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Official IMD/CWC/Shelter Feed Status vs Simulated Telemetry */}
          {isDemoMode ? (
            <div className="space-y-3 border border-amber-500/25 bg-amber-500/5 rounded-lg p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300">
                  Simulated Preparedness Indicators ({selectedDistrict.simulatedScenario.dataLabel})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#121B30] border border-slate-800 rounded p-2.5">
                  <div className="text-slate-400 text-[11px]">Sim 24h Rain</div>
                  <div className="text-base font-bold text-white font-mono">
                    {selectedDistrict.simulatedScenario.rainfall24h} mm
                  </div>
                </div>
                <div className="bg-[#121B30] border border-slate-800 rounded p-2.5">
                  <div className="text-slate-400 text-[11px]">Sim River Level</div>
                  <div className={`text-base font-mono ${getRiverStatusBadge(selectedDistrict.simulatedScenario.riverStatus)}`}>
                    {selectedDistrict.simulatedScenario.riverWaterLevelPercent}%
                  </div>
                </div>
                <div className="bg-[#121B30] border border-slate-800 rounded p-2.5">
                  <div className="text-slate-400 text-[11px]">Sim Shelters</div>
                  <div className="text-base font-bold text-white font-mono">
                    {selectedDistrict.simulatedScenario.activeSheltersCount}
                  </div>
                </div>
                <div className="bg-[#121B30] border border-slate-800 rounded p-2.5">
                  <div className="text-slate-400 text-[11px]">Sim Occupancy</div>
                  <div className="text-base font-bold text-amber-300 font-mono">
                    {selectedDistrict.simulatedScenario.shelterCurrentOccupancy.toLocaleString()} /{' '}
                    {selectedDistrict.simulatedScenario.shelterCapacityTotal.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300 uppercase">
                  Sample Vulnerability Notes (Planning Reference · Simulated)
                </div>
                <ul className="space-y-1 text-[11px] text-slate-300">
                  {selectedDistrict.simulatedScenario.keyVulnerabilities.map((vuln, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>{vuln}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <div className="font-semibold text-amber-300">
                No verified live data available (IMD / CWC / Shelters)
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Official IMD district rainfall bulletins (HTTP 401 IP-restricted), CWC live river gauge telemetry, and OSDMA cyclone shelter occupancy feeds are not publicly accessible. Hardcoded demo values are strictly hidden in Live Verified Mode.
              </p>
            </div>
          )}

          {/* Direct Incident Action Button */}
          <button
            type="button"
            onClick={() => onNavigateToReport(selectedDistrict.name)}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>Report Incident in {selectedDistrict.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
