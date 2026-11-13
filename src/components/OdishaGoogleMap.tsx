/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  Circle,
  ColorScheme,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import type { DataMode, DistrictRisk, Incident } from '../types/disaster';
import { ODISHA_DISTRICTS } from '../data/odishaDistricts';
import { AlertTriangle, Droplets, Wind, Waves, Home, Layers, Cpu } from 'lucide-react';

interface OdishaGoogleMapProps {
  apiKey: string;
  selectedDistrictId: string;
  onSelectDistrict: (district: DistrictRisk) => void;
  incidents: Incident[];
  dataMode: DataMode;
  hazardFilter: 'all' | 'cyclone' | 'flood' | 'heatwave';
  quotaExceeded: boolean;
  onFallbackToVector: () => void;
  onSelectIncidentForTriage: (incident: Incident) => void;
}

const ODISHA_CENTER = { lat: 20.35, lng: 84.55 };

function getDistrictMarkerColors(
  district: DistrictRisk,
  isSelected: boolean,
  dataMode: DataMode,
  hazardFilter: 'all' | 'cyclone' | 'flood' | 'heatwave',
  hasSubmittedIncident: boolean
): { background: string; borderColor: string; glyphColor: string; radiusMeters: number; showCircle: boolean } {
  if (isSelected) {
    return {
      background: '#0284C7',
      borderColor: '#FFFFFF',
      glyphColor: '#FFFFFF',
      radiusMeters: 26000,
      showCircle: true,
    };
  }

  if (dataMode === 'verified') {
    if (hasSubmittedIncident) {
      return {
        background: '#0EA5E9',
        borderColor: '#BAE6FD',
        glyphColor: '#FFFFFF',
        radiusMeters: 20000,
        showCircle: true,
      };
    }
    return {
      background: '#334155',
      borderColor: '#64748B',
      glyphColor: '#CBD5E1',
      radiusMeters: 0,
      showCircle: false,
    };
  }

  const sim = district.simulatedScenario;
  if (hazardFilter === 'cyclone') {
    if (district.zone === 'coastal') {
      const isCrit = sim.riskLevel === 'critical';
      return {
        background: isCrit ? '#DC2626' : '#EA580C',
        borderColor: isCrit ? '#FCA5A5' : '#FDBA74',
        glyphColor: '#FFFFFF',
        radiusMeters: isCrit ? 30000 : 22000,
        showCircle: true,
      };
    }
    return {
      background: '#334155',
      borderColor: '#64748B',
      glyphColor: '#CBD5E1',
      radiusMeters: 0,
      showCircle: false,
    };
  }

  if (hazardFilter === 'flood') {
    if (sim.riverStatus === 'critical') {
      return { background: '#DC2626', borderColor: '#FCA5A5', glyphColor: '#FFFFFF', radiusMeters: 28000, showCircle: true };
    }
    if (sim.riverStatus === 'danger') {
      return { background: '#EA580C', borderColor: '#FDBA74', glyphColor: '#FFFFFF', radiusMeters: 22000, showCircle: true };
    }
    if (sim.riverStatus === 'rising') {
      return { background: '#D97706', borderColor: '#FDE68A', glyphColor: '#FFFFFF', radiusMeters: 16000, showCircle: true };
    }
    return { background: '#334155', borderColor: '#64748B', glyphColor: '#CBD5E1', radiusMeters: 0, showCircle: false };
  }

  if (hazardFilter === 'heatwave') {
    if (sim.heatIndexCelsius >= 44) {
      return { background: '#DC2626', borderColor: '#FCA5A5', glyphColor: '#FFFFFF', radiusMeters: 28000, showCircle: true };
    }
    if (sim.heatIndexCelsius >= 41) {
      return { background: '#EA580C', borderColor: '#FDBA74', glyphColor: '#FFFFFF', radiusMeters: 22000, showCircle: true };
    }
    if (sim.heatIndexCelsius >= 38) {
      return { background: '#D97706', borderColor: '#FDE68A', glyphColor: '#FFFFFF', radiusMeters: 16000, showCircle: true };
    }
    return { background: '#334155', borderColor: '#64748B', glyphColor: '#CBD5E1', radiusMeters: 0, showCircle: false };
  }

  switch (sim.riskLevel) {
    case 'critical':
      return { background: '#DC2626', borderColor: '#FCA5A5', glyphColor: '#FFFFFF', radiusMeters: 26000, showCircle: true };
    case 'high':
      return { background: '#EA580C', borderColor: '#FDBA74', glyphColor: '#FFFFFF', radiusMeters: 18000, showCircle: true };
    case 'moderate':
      return { background: '#D97706', borderColor: '#FDE68A', glyphColor: '#FFFFFF', radiusMeters: 0, showCircle: false };
    default:
      return { background: '#0D9488', borderColor: '#5EEAD4', glyphColor: '#FFFFFF', radiusMeters: 0, showCircle: false };
  }
}

const MapCameraController: React.FC<{ selectedDistrict: DistrictRisk | undefined }> = ({
  selectedDistrict,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedDistrict) return;
    map.panTo({ lat: selectedDistrict.lat, lng: selectedDistrict.lng });
  }, [map, selectedDistrict]);

  return null;
};

interface DistrictMarkerNodeProps {
  district: DistrictRisk;
  isSelected: boolean;
  infoWindowOpen: boolean;
  dataMode: DataMode;
  hazardFilter: 'all' | 'cyclone' | 'flood' | 'heatwave';
  districtIncidentsCount: number;
  hasSubmittedIncident: boolean;
  onSelect: (district: DistrictRisk) => void;
  onCloseInfoWindow: () => void;
}

const DistrictMarkerNode: React.FC<DistrictMarkerNodeProps> = ({
  district,
  isSelected,
  infoWindowOpen,
  dataMode,
  hazardFilter,
  districtIncidentsCount,
  hasSubmittedIncident,
  onSelect,
  onCloseInfoWindow,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const colors = getDistrictMarkerColors(
    district,
    isSelected,
    dataMode,
    hazardFilter,
    hasSubmittedIncident
  );

  return (
    <>
      {colors.showCircle && colors.radiusMeters > 0 && (
        <Circle
          center={{ lat: district.lat, lng: district.lng }}
          radius={colors.radiusMeters}
          strokeColor={colors.background}
          strokeOpacity={isSelected ? 0.85 : 0.4}
          strokeWeight={isSelected ? 2 : 1}
          fillColor={colors.background}
          fillOpacity={isSelected ? 0.18 : 0.1}
          clickable
          onClick={() => onSelect(district)}
        />
      )}

      <AdvancedMarker
        ref={markerRef}
        position={{ lat: district.lat, lng: district.lng }}
        title={`${district.name} (${district.odiaName})`}
        zIndex={isSelected ? 40 : 10}
        onClick={() => onSelect(district)}
      >
        <Pin
          background={colors.background}
          borderColor={colors.borderColor}
          glyphColor={colors.glyphColor}
          scale={isSelected ? 1.15 : 0.82}
        />
      </AdvancedMarker>

      {isSelected && infoWindowOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onCloseInfoWindow} maxWidth={270}>
          <div className="text-slate-900 p-1 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
              <div>
                <span className="font-bold text-sm text-slate-900">{district.name}</span>
                <span className="text-teal-700 font-medium ml-1.5">{district.odiaName}</span>
              </div>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white">
                {dataMode === 'demonstration' ? `${district.simulatedScenario.riskLevel} (SIM)` : 'HQ Ref'}
              </span>
            </div>

            {dataMode === 'demonstration' ? (
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                <div className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Rain (Sim): {district.simulatedScenario.rainfall24h}mm</span>
                </div>
                <div className="flex items-center gap-1">
                  <Waves className="w-3 h-3 text-cyan-700 shrink-0" />
                  <span>River (Sim): {district.simulatedScenario.riverWaterLevelPercent}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-teal-700 shrink-0" />
                  <span>Wind (Sim): {district.simulatedScenario.windSpeedKmph} km/h</span>
                </div>
                <div className="flex items-center gap-1">
                  <Home className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>MPCS (Sim): {district.simulatedScenario.activeSheltersCount}</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-700 space-y-1">
                <div>Official IMD/CWC/OSDMA risk feed: Unavailable</div>
                <div>Unverified user reports in district: <strong>{districtIncidentsCount}</strong></div>
              </div>
            )}

            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
              {dataMode === 'demonstration'
                ? `Simulated Preparedness Scenario · ${districtIncidentsCount} incident(s)`
                : `Live Mode · HQ Coordinates (${district.lat.toFixed(2)}, ${district.lng.toFixed(2)})`}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface IncidentMarkerNodeProps {
  incident: Incident;
  position: { lat: number; lng: number };
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onAnalyze: (incident: Incident) => void;
}

const IncidentMarkerNode: React.FC<IncidentMarkerNodeProps> = ({
  incident,
  position,
  isSelected,
  onSelect,
  onClose,
  onAnalyze,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isSim = incident.dataOrigin === 'simulated_demo';

  const urgencyBadgeColor =
    incident.urgency === 'P1_CRITICAL'
      ? 'bg-rose-600 border-rose-200'
      : incident.urgency === 'P2_HIGH'
      ? 'bg-amber-600 border-amber-200'
      : 'bg-teal-600 border-teal-200';

  const hazardInitial = incident.hazardType.slice(0, 1).toUpperCase();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={`${incident.incidentCode} · ${incident.hazardType.toUpperCase()} (${isSim ? 'SIMULATED' : 'UNVERIFIED USER REPORT'})`}
        zIndex={isSelected ? 90 : isSim ? 60 : 75}
        onClick={onSelect}
      >
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold text-white shadow-lg cursor-pointer ${urgencyBadgeColor} ${
            isSim ? 'border-dashed opacity-90' : 'ring-2 ring-cyan-300'
          }`}
        >
          <span>{hazardInitial}</span>
          <span>{isSim ? 'SIM' : 'USR'}</span>
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose} maxWidth={290}>
          <div className="text-slate-900 p-1 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
              <span className="font-mono font-bold text-slate-900">{incident.incidentCode}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  isSim ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'
                }`}
              >
                {isSim ? 'SIMULATED DATA' : 'USER REPORT (UNVERIFIED)'}
              </span>
            </div>

            <div>
              <div className="font-semibold text-slate-900">
                {incident.districtName} — {incident.blockOrLocation}
              </div>
              <div className="text-[11px] text-slate-600 capitalize">
                Hazard: {incident.hazardType} · Urgency: {incident.urgency.replace('_', ' ')}
              </div>
            </div>

            <p className="text-[11px] text-slate-700 line-clamp-3">{incident.description}</p>

            <div className="text-[10px] text-slate-500">
              Anchored at District HQ reference point (no exact street GPS supplied).
            </div>

            <button
              type="button"
              onClick={() => onAnalyze(incident)}
              className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5"
            >
              <Cpu className="w-3 h-3" />
              <span>Open AI Triage</span>
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const InnerGoogleMapCanvas: React.FC<{
  selectedDistrictId: string;
  onSelectDistrict: (district: DistrictRisk) => void;
  incidents: Incident[];
  dataMode: DataMode;
  hazardFilter: 'all' | 'cyclone' | 'flood' | 'heatwave';
  onFallbackToVector: () => void;
  onSelectIncidentForTriage: (incident: Incident) => void;
}> = ({
  selectedDistrictId,
  onSelectDistrict,
  incidents,
  dataMode,
  hazardFilter,
  onFallbackToVector,
  onSelectIncidentForTriage,
}) => {
  const status = useApiLoadingStatus();
  const [districtInfoOpen, setDistrictInfoOpen] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const selectedDistrict = ODISHA_DISTRICTS.find((d) => d.id === selectedDistrictId);

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-[520px] flex flex-col items-center justify-center bg-[#09101E] rounded-lg border border-slate-800 p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <div className="text-sm font-semibold text-white">
          Unable to load Google Maps Platform canvas
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          Please check your network connection or Google Maps API quota. Switch to the built-in Odisha Vector Map
          without losing district or incident visibility.
        </p>
        <button
          type="button"
          onClick={onFallbackToVector}
          className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors flex items-center gap-2"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Switch to Custom Vector Map</span>
        </button>
      </div>
    );
  }

  // Deterministic radial offset per district so multiple incidents anchored to a district HQ remain clickable
  const perDistrictSlot = new Map<string, number>();

  return (
    <div className="relative w-full h-[520px] rounded-lg overflow-hidden border border-slate-800 bg-[#09101E]">
      {status === APILoadingStatus.LOADING && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#09101E]/90 text-xs text-slate-300 space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <span>Initializing Google Maps Odisha Geospatial Layer...</span>
        </div>
      )}

      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={ODISHA_CENTER}
        defaultZoom={7}
        colorScheme={ColorScheme.DARK}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={true}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <MapCameraController selectedDistrict={selectedDistrict} />

        {ODISHA_DISTRICTS.map((district) => {
          const districtIncidents = incidents.filter((i) => i.districtId === district.id);
          const hasSubmitted = districtIncidents.some((i) => i.dataOrigin === 'user_submitted');
          return (
            <DistrictMarkerNode
              key={district.id}
              district={district}
              isSelected={district.id === selectedDistrictId}
              infoWindowOpen={districtInfoOpen && !selectedIncidentId}
              dataMode={dataMode}
              hazardFilter={hazardFilter}
              districtIncidentsCount={districtIncidents.length}
              hasSubmittedIncident={hasSubmitted}
              onSelect={(d) => {
                setSelectedIncidentId(null);
                setDistrictInfoOpen(true);
                onSelectDistrict(d);
              }}
              onCloseInfoWindow={() => setDistrictInfoOpen(false)}
            />
          );
        })}

        {incidents.map((incident) => {
          const district = ODISHA_DISTRICTS.find((d) => d.id === incident.districtId);
          if (!district) return null;
          const idx = perDistrictSlot.get(district.id) || 0;
          perDistrictSlot.set(district.id, idx + 1);
          const angle = (idx * 72 * Math.PI) / 180;
          const distOffset = 0.06 + Math.floor(idx / 5) * 0.04;
          const pos = {
            lat: district.lat + Math.sin(angle) * distOffset,
            lng: district.lng + Math.cos(angle) * distOffset,
          };

          return (
            <IncidentMarkerNode
              key={incident.id}
              incident={incident}
              position={pos}
              isSelected={selectedIncidentId === incident.id}
              onSelect={() => {
                setDistrictInfoOpen(false);
                setSelectedIncidentId(incident.id);
                onSelectDistrict(district);
              }}
              onClose={() => setSelectedIncidentId(null)}
              onAnalyze={onSelectIncidentForTriage}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
};

export const OdishaGoogleMap: React.FC<OdishaGoogleMapProps> = ({
  apiKey,
  selectedDistrictId,
  onSelectDistrict,
  incidents,
  dataMode,
  hazardFilter,
  quotaExceeded,
  onFallbackToVector,
  onSelectIncidentForTriage,
}) => {
  return (
    <div className="relative bg-[#0B1120] border border-slate-800 rounded-xl p-4 overflow-hidden">
      {/* Map Header Controls & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Google Maps Odisha Geospatial View
          </span>
          <span className="text-[11px] text-slate-400">
            · 30 District HQs · {incidents.length} Incident Marker(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 rounded bg-rose-600 border border-dashed border-rose-200 text-[9px] font-bold text-white">
              SIM
            </span>
            <span>Simulated Incident</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 rounded bg-sky-600 ring-1 ring-cyan-300 text-[9px] font-bold text-white">
              USR
            </span>
            <span>User Report (Unverified)</span>
          </div>
        </div>
      </div>

      {!apiKey || quotaExceeded ? (
        <div className="w-full h-[520px] flex flex-col items-center justify-center bg-[#09101E] rounded-lg border border-slate-800 p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="text-sm font-semibold text-white">
            {quotaExceeded
              ? 'Google Maps Platform Quota Reached'
              : 'Google Maps API Key Not Configured'}
          </div>
          <p className="text-xs text-slate-400 max-w-md">
            {quotaExceeded
              ? 'Live map tiles are paused due to quota limits. Use the built-in Custom Vector Map to inspect all 30 districts and incident markers.'
              : 'Google Maps credentials are unavailable in this environment. Switch to the Custom Vector Map fallback for full district and incident interaction.'}
          </p>
          <button
            type="button"
            onClick={onFallbackToVector}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors flex items-center gap-2"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Switch to Custom Vector Map</span>
          </button>
        </div>
      ) : (
        <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="IN">
          <InnerGoogleMapCanvas
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={onSelectDistrict}
            incidents={incidents}
            dataMode={dataMode}
            hazardFilter={hazardFilter}
            onFallbackToVector={onFallbackToVector}
            onSelectIncidentForTriage={onSelectIncidentForTriage}
          />
        </APIProvider>
      )}

      {/* Map Footer Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
        <span>
          Incident markers cluster around District HQ reference points when exact street GPS coordinates are unavailable.
        </span>
        <span className="text-teal-400 font-mono">
          {dataMode === 'demonstration' ? 'SIMULATED + USER REPORTS' : 'LIVE OFFICIAL / USER-REPORT MODE'} · Region: IN
        </span>
      </div>
    </div>
  );
};
