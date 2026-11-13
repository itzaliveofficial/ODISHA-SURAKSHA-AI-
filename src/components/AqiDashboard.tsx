/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { AqiStationRecord, IndianAqiCategory, OdishaAqiResponse } from '../types/disaster';
import { explainAqiStation, fetchOdishaAqi } from '../services/liveDataService';
import { ODISHA_DISTRICTS } from '../data/odishaDistricts';
import {
  Wind,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Cpu,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';

function getCpcbStyles(category: IndianAqiCategory): {
  badge: string;
  text: string;
  dot: string;
  border: string;
} {
  switch (category) {
    case 'Good':
      return {
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        text: 'text-emerald-300',
        dot: '#10b981',
        border: 'border-emerald-500/40',
      };
    case 'Satisfactory':
      return {
        badge: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
        text: 'text-lime-300',
        dot: '#84cc16',
        border: 'border-lime-500/40',
      };
    case 'Moderate':
      return {
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        text: 'text-amber-300',
        dot: '#f59e0b',
        border: 'border-amber-500/40',
      };
    case 'Poor':
      return {
        badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        text: 'text-orange-300',
        dot: '#f97316',
        border: 'border-orange-500/40',
      };
    case 'Very Poor':
      return {
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        text: 'text-rose-300',
        dot: '#f43f5e',
        border: 'border-rose-500/40',
      };
    case 'Severe':
      return {
        badge: 'bg-red-600/30 text-red-200 border-red-500/50',
        text: 'text-red-300',
        dot: '#dc2626',
        border: 'border-red-500/50',
      };
    default:
      return {
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        text: 'text-slate-400',
        dot: '#64748b',
        border: 'border-slate-700',
      };
  }
}

function formatIst(iso: string | null | undefined): string {
  if (!iso) return 'Unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })} IST`;
}

function getSourceBadgeMeta(sourceKind: AqiStationRecord['sourceKind']): {
  label: string;
  badgeClass: string;
} {
  switch (sourceKind) {
    case 'cpcb_ground_station':
      return {
        label: 'OFFICIAL CPCB CAAQMS STATION',
        badgeClass: 'bg-teal-500/15 border-teal-500/40 text-teal-300',
      };
    case 'openaq_ground_station':
      return {
        label: 'OPENAQ PHYSICAL SENSOR STATION',
        badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
      };
    case 'secondary_provider_station':
      return {
        label: 'WAQI SECONDARY STATION (US-EPA ONLY)',
        badgeClass: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
      };
    case 'open_meteo_model_estimate':
      return {
        label: 'OPEN-METEO CAMS MODEL ESTIMATE (NO PHYSICAL STATION)',
        badgeClass: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
      };
    case 'unavailable':
    default:
      return {
        label: 'NO MONITORING STATION / UNAVAILABLE',
        badgeClass: 'bg-slate-800 border-slate-700 text-slate-300',
      };
  }
}

function getScaleBoxLabel(st: AqiStationRecord): string {
  switch (st.scaleMethod) {
    case 'cpcb_calculated_from_official_pollutants':
      return 'CPCB National AQI';
    case 'indian_scale_calculated_from_secondary_sensors':
      return 'Indian-Scale (Secondary Sensor)';
    case 'indian_scale_calculated_from_model_estimates':
      return 'Indian-Scale (Model Estimate)';
    case 'us_epa_secondary_only':
      return 'US-EPA AQI Only';
    default:
      return 'Unavailable';
  }
}

export const AqiDashboard: React.FC = () => {
  const [aqiData, setAqiData] = useState<OdishaAqiResponse | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>('bbsr-khordha');
  const [stationFilter, setStationFilter] = useState<'all' | 'physical' | 'model' | 'unmonitored'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [aiExplanation, setAiExplanation] = useState<{
    stationId: string;
    explanation: string;
    usedGemini: boolean;
  } | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);

  const loadAqi = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');
    try {
      const data = await fetchOdishaAqi(forceRefresh);
      setAqiData(data);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to fetch Odisha AQI monitoring feed.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAqi(false);
  }, [loadAqi]);

  const monitored = aqiData?.monitoredStations || [];
  const unmonitored = aqiData?.unmonitoredLocations || [];
  const allStations = [...monitored, ...unmonitored];

  const physicalCount =
    aqiData?.verifiedPhysicalStationCount ??
    monitored.filter((s) => s.hasPhysicalStation && s.stationMetadataVerified).length;
  const modelCount =
    aqiData?.modelEstimateCount ??
    monitored.filter((s) => s.sourceKind === 'open_meteo_model_estimate').length;
  const unavailableCount = aqiData?.unavailableLocationCount ?? unmonitored.length;

  const visibleStations =
    stationFilter === 'physical'
      ? allStations.filter((s) => s.hasPhysicalStation && s.stationMetadataVerified)
      : stationFilter === 'model'
      ? allStations.filter((s) => s.sourceKind === 'open_meteo_model_estimate')
      : stationFilter === 'unmonitored'
      ? unmonitored
      : allStations;

  const selectedStation: AqiStationRecord | null =
    allStations.find((s) => s.stationId === selectedStationId) || monitored[0] || null;

  const handleExplainStation = async (stationId: string) => {
    setIsExplaining(true);
    try {
      const res = await explainAqiStation(stationId);
      setAiExplanation({
        stationId: res.stationId,
        explanation: res.explanation,
        usedGemini: res.usedGemini,
      });
    } catch (err: unknown) {
      setAiExplanation({
        stationId,
        explanation:
          err instanceof Error ? err.message : 'Unable to generate explanation right now.',
        usedGemini: false,
      });
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal-400 font-semibold uppercase tracking-wider">
              <Wind className="w-4 h-4 text-teal-400" />
              <span>Odisha Air Quality Index (AQI) Monitor</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span
                className={
                  aqiData?.cpcbOfficialConnected
                    ? 'text-emerald-300'
                    : physicalCount > 0
                    ? 'text-sky-300'
                    : 'text-cyan-300'
                }
              >
                {aqiData?.cpcbOfficialConnected
                  ? 'OFFICIAL CPCB CONNECTED'
                  : physicalCount > 0
                  ? 'SECONDARY SENSOR STATIONS'
                  : 'MODELED ATMOSPHERIC BASELINE (NO VERIFIED GROUND SENSORS)'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Odisha Ambient Air Quality &amp; Pollutant Telemetry
            </h1>
            <p className="text-xs text-slate-300">
              Active source:{' '}
              <strong className="text-teal-300">
                {aqiData?.activePrimarySource || 'Loading provider status...'}
              </strong>
              {aqiData?.fetchedAt && (
                <span className="text-slate-400 font-mono ml-2">
                  · Retrieved {formatIst(aqiData.fetchedAt)}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadAqi(true)}
            disabled={isLoading || isRefreshing}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shrink-0 self-start md:self-center whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing AQI...' : 'Refresh Live AQI'}</span>
          </button>
        </div>

        {/* Scale Transparency Banner */}
        <div className="bg-[#121B30] border border-slate-800 rounded-lg px-3.5 py-2.5 text-[11px] text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <strong>Indian CPCB Scale Discipline:</strong>{' '}
            {aqiData?.scaleDisclaimer ||
              'Indian CPCB National AQI (0–500) and US/European AQI are distinct scales and are never mixed. Cities without ground monitoring stations display Unavailable rather than fabricated estimates.'}
          </div>
        </div>

        {/* CPCB 6-Tier Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
          {[
            { label: 'Good', range: '0–50', cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' },
            { label: 'Satisfactory', range: '51–100', cls: 'bg-lime-500/15 border-lime-500/30 text-lime-300' },
            { label: 'Moderate', range: '101–200', cls: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
            { label: 'Poor', range: '201–300', cls: 'bg-orange-500/15 border-orange-500/30 text-orange-300' },
            { label: 'Very Poor', range: '301–400', cls: 'bg-rose-500/15 border-rose-500/30 text-rose-300' },
            { label: 'Severe', range: '401–500', cls: 'bg-red-600/20 border-red-500/40 text-red-200' },
          ].map((band) => (
            <div
              key={band.label}
              className={`border rounded-md px-2.5 py-1.5 flex items-center justify-between ${band.cls}`}
            >
              <span className="font-semibold">{band.label}</span>
              <span className="font-mono tabular-nums">{band.range}</span>
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => loadAqi(true)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Map + Station Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Odisha AQI Station Map */}
        <div className="lg:col-span-5 bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Odisha Monitoring Coverage Map</h2>
              <p className="text-[11px] text-slate-400">
                Click any city pin to inspect pollutant readings or verify unmonitored coverage
              </p>
            </div>
            <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
          </div>

          <div className="relative bg-[#080C15] border border-slate-800 rounded-lg overflow-hidden">
            <svg viewBox="100 100 620 620" className="w-full h-[340px]">
              {/* District outlines background */}
              {ODISHA_DISTRICTS.map((d) => (
                <path
                  key={d.id}
                  d={d.svgPath}
                  fill="#0F172A"
                  stroke="#1E293B"
                  strokeWidth="1.4"
                />
              ))}

              {/* Station pins plotted from matching district centroid */}
              {allStations.map((st) => {
                const dist = ODISHA_DISTRICTS.find((d) => d.id === st.districtId);
                if (!dist) return null;
                const [cx, cy] = dist.centroid;
                const isSelected = selectedStation?.stationId === st.stationId;
                const style = getCpcbStyles(st.cpcbCategory);

                return (
                  <g
                    key={st.stationId}
                    onClick={() => setSelectedStationId(st.stationId)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={18}
                        fill="none"
                        stroke="#2dd4bf"
                        strokeWidth="2"
                        strokeDasharray="3 2"
                      />
                    )}
                    {st.hasPhysicalStation && st.stationMetadataVerified && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={13}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={
                        st.hasPhysicalStation && st.stationMetadataVerified
                          ? 10
                          : st.sourceKind === 'open_meteo_model_estimate'
                          ? 7.5
                          : 6
                      }
                      fill={st.dataAvailable ? style.dot : '#475569'}
                      stroke={
                        isSelected
                          ? '#ffffff'
                          : st.sourceKind === 'open_meteo_model_estimate'
                          ? '#22d3ee'
                          : '#080C15'
                      }
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray={
                        st.sourceKind === 'open_meteo_model_estimate' ? '2 1.5' : undefined
                      }
                    />
                    <text
                      x={cx}
                      y={cy - 14}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '500'}
                      fill={isSelected ? '#ffffff' : '#cbd5e1'}
                    >
                      {st.city}
                    </text>
                    {st.dataAvailable && (st.cpcbAqi !== null || st.usAqi !== null) && (
                      <text
                        x={cx}
                        y={cy + 3.5}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="700"
                        fill="#080C15"
                      >
                        {st.cpcbAqi ?? st.usAqi}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Solid + Green Ring: Physical stations ({physicalCount})</span>
            <span>Dashed Cyan Rim: Modeled CAMS grid ({modelCount})</span>
            <span>Slate pins: Unavailable ({unavailableCount})</span>
          </div>
        </div>

        {/* Right: Selected Station Detailed Telemetry Panel */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-slate-800 rounded-xl p-6 space-y-5">
          {isLoading && !aqiData ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Retrieving real-time air-quality observations across Odisha hubs...
            </div>
          ) : selectedStation ? (
            <>
              {/* Station Identity */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold ${
                        selectedStation.freshness === 'LIVE'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : selectedStation.freshness === 'STALE'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {selectedStation.freshness}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        getSourceBadgeMeta(selectedStation.sourceKind).badgeClass
                      }`}
                    >
                      {getSourceBadgeMeta(selectedStation.sourceKind).label}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedStation.stationName}</h2>
                  <p className="text-xs text-slate-400">
                    City: <strong className="text-slate-200">{selectedStation.city}</strong> · District:{' '}
                    <strong className="text-slate-200">{selectedStation.districtName}</strong> ·
                    Coordinates:{' '}
                    <span className="font-mono">
                      {selectedStation.lat.toFixed(3)}°N, {selectedStation.lng.toFixed(3)}°E
                    </span>
                    {selectedStation.providerStationId && (
                      <>
                        {' · '}Station ID:{' '}
                        <span className="font-mono text-slate-200">
                          {selectedStation.providerStationId}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Primary AQI Score Box */}
                {selectedStation.dataAvailable ? (
                  <div
                    className={`border rounded-xl px-4 py-2.5 text-right shrink-0 ${
                      getCpcbStyles(selectedStation.cpcbCategory).badge
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold">
                      {getScaleBoxLabel(selectedStation)}
                    </div>
                    <div className="text-3xl font-bold font-mono tabular-nums">
                      {selectedStation.cpcbAqi !== null
                        ? selectedStation.cpcbAqi
                        : selectedStation.usAqi !== null
                        ? selectedStation.usAqi
                        : 'N/A'}
                    </div>
                    <div className="text-xs font-semibold">
                      {selectedStation.cpcbAqi !== null
                        ? selectedStation.cpcbCategory
                        : selectedStation.usAqi !== null
                        ? 'US-EPA Scale'
                        : 'Unavailable'}
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-700 bg-slate-900 rounded-xl px-4 py-2.5 text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Availability Status
                    </div>
                    <div className="text-sm font-bold text-amber-300 mt-1">UNAVAILABLE</div>
                  </div>
                )}
              </div>

              {!selectedStation.dataAvailable ? (
                <div className="bg-[#121B30] border border-amber-500/30 rounded-lg p-5 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Monitoring Data Unavailable</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedStation.unavailableReason ||
                      selectedStation.cpcbAqiMethodologyNote}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Policy compliance: ODISHA SURAKSHA AI never invents or extrapolates synthetic
                    station values for districts lacking verified air-quality monitoring coverage.
                  </p>
                </div>
              ) : (
                <>
                  {/* Separate Scale Notice & Non-Official Clarification */}
                  <div className="bg-[#121B30] border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-1.5">
                    <div>
                      <strong className="text-teal-300">Methodology:</strong>{' '}
                      {selectedStation.cpcbAqiMethodologyNote}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-slate-400 pt-1">
                      <span>
                        Prominent Pollutant:{' '}
                        <strong className="text-white font-mono">
                          {selectedStation.prominentPollutant || 'N/A'}
                        </strong>
                      </span>
                      {selectedStation.usAqi !== null && (
                        <span>
                          Separate US-EPA AQI Scale:{' '}
                          <strong className="text-sky-300 font-mono tabular-nums">
                            {selectedStation.usAqi} US AQI
                          </strong>
                        </span>
                      )}
                      {selectedStation.europeanAqi !== null && (
                        <span>
                          Separate European AQI Scale:{' '}
                          <strong className="text-cyan-300 font-mono tabular-nums">
                            {selectedStation.europeanAqi} EAQI
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 6 Pollutant Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'PM2.5', value: selectedStation.pollutants.pm25, unit: 'µg/m³' },
                      { label: 'PM10', value: selectedStation.pollutants.pm10, unit: 'µg/m³' },
                      { label: 'NO2', value: selectedStation.pollutants.no2, unit: 'µg/m³' },
                      { label: 'SO2', value: selectedStation.pollutants.so2, unit: 'µg/m³' },
                      { label: 'CO', value: selectedStation.pollutants.coMgM3, unit: 'mg/m³' },
                      { label: 'O3 (Ozone)', value: selectedStation.pollutants.o3, unit: 'µg/m³' },
                    ].map((pol) => (
                      <div
                        key={pol.label}
                        className="bg-[#121B30] border border-slate-800 rounded-lg p-3"
                      >
                        <div className="text-slate-400 text-[11px]">{pol.label}</div>
                        <div className="text-base font-bold font-mono tabular-nums text-white mt-0.5">
                          {pol.value !== null ? `${pol.value} ${pol.unit}` : 'Unavailable'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Gemini Grounded Health Summary Action */}
                  <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>AI Environmental Health Advisory (Strictly Grounded in Above Data)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExplainStation(selectedStation.stationId)}
                        disabled={isExplaining}
                        className="px-3 py-1 text-[11px] font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-md"
                      >
                        {isExplaining ? 'Analyzing...' : 'Explain Station Reading'}
                      </button>
                    </div>
                    {aiExplanation && aiExplanation.stationId === selectedStation.stationId && (
                      <div className="text-xs text-slate-200 leading-relaxed border-t border-slate-800 pt-2.5 space-y-1">
                        <div className="text-[10px] font-mono text-slate-400">
                          {aiExplanation.usedGemini
                            ? 'Generated by Gemini (gemini-4-hydrogen) from retrieved measurements above'
                            : 'Deterministic Telemetry Summary'}
                        </div>
                        <p>{aiExplanation.explanation}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Source & Timestamp Provenance Strip */}
              <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Observed: <strong className="text-slate-200">{formatIst(selectedStation.provenance.observedAt)}</strong>
                  </span>
                  <span>
                    Retrieved: <strong className="text-slate-200">{formatIst(selectedStation.provenance.retrievedAt)}</strong>
                  </span>
                </div>
                <a
                  href={selectedStation.provenance.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium"
                >
                  <span>Source: {selectedStation.provenance.sourceName}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Filter Bar for All Cities / Locations */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1527] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Coverage View:</span>
          {(
            [
              { id: 'all', label: `All Tracked Locations (${allStations.length})` },
              { id: 'physical', label: `Verified Ground Stations (${physicalCount})` },
              { id: 'model', label: `Modeled Atmospheric Estimates (${modelCount})` },
              { id: 'unmonitored', label: `Unavailable / No Station (${unavailableCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStationFilter(tab.id)}
              className={`px-3 py-1 rounded transition-colors ${
                stationFilter === tab.id
                  ? 'bg-teal-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-400">
          Select any city card to open station pollutants &amp; source details above
        </div>
      </div>

      {/* Odisha City Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleStations.map((st) => {
          const style = getCpcbStyles(st.cpcbCategory);
          const isSelected = selectedStation?.stationId === st.stationId;
          return (
            <button
              key={st.stationId}
              type="button"
              onClick={() => {
                setSelectedStationId(st.stationId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all space-y-2.5 ${
                isSelected
                  ? 'border-teal-500 ring-1 ring-teal-500/40'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white">{st.city}</div>
                  <div className="text-[11px] text-slate-400">{st.districtName} District</div>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    st.dataAvailable ? style.badge : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {st.dataAvailable ? st.cpcbCategory : 'Unavailable'}
                </span>
              </div>

              {st.dataAvailable ? (
                <>
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className={`text-2xl font-bold font-mono tabular-nums ${style.text}`}>
                        {st.cpcbAqi !== null ? st.cpcbAqi : st.usAqi ?? 'N/A'}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5">
                        {st.scaleMethod === 'cpcb_calculated_from_official_pollutants'
                          ? 'CPCB AQI'
                          : st.scaleMethod === 'indian_scale_calculated_from_secondary_sensors'
                          ? 'Indep. Indian-Scale'
                          : st.scaleMethod === 'indian_scale_calculated_from_model_estimates'
                          ? 'Model Est. (Indian-Scale)'
                          : 'US-EPA AQI'}
                      </span>
                    </div>
                    {st.usAqi !== null && st.cpcbAqi !== null && (
                      <span className="text-[11px] font-mono text-sky-300">
                        {st.usAqi} US AQI
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-400">PM2.5: </span>
                      <strong className="font-mono text-slate-200">
                        {st.pollutants.pm25 !== null ? `${st.pollutants.pm25}` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">PM10: </span>
                      <strong className="font-mono text-slate-200">
                        {st.pollutants.pm10 !== null ? `${st.pollutants.pm10}` : 'N/A'}
                      </strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>No physical CAAQMS station verified</span>
                </div>
              )}

              <div className="text-[10px] text-slate-500 truncate">
                {st.provenance.sourceName} · {st.freshness}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
