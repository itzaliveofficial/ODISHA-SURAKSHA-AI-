/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { DataMode, DistrictRisk, Incident } from '../types/disaster';
import { ODISHA_DISTRICTS } from '../data/odishaDistricts';
import { Droplets, Wind, Home, Waves, Cpu, X } from 'lucide-react';

interface OdishaMapProps {
  selectedDistrictId: string;
  onSelectDistrict: (district: DistrictRisk) => void;
  incidents: Incident[];
  dataMode: DataMode;
  hazardFilter?: 'all' | 'cyclone' | 'flood' | 'heatwave';
  onSelectIncidentForTriage: (incident: Incident) => void;
}

export const OdishaMap: React.FC<OdishaMapProps> = ({
  selectedDistrictId,
  onSelectDistrict,
  incidents,
  dataMode,
  hazardFilter = 'all',
  onSelectIncidentForTriage,
}) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictRisk | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const getDistrictFillColor = (district: DistrictRisk, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) {
      return '#0284C7';
    }

    if (dataMode === 'verified') {
      const hasSubmitted = incidents.some(
        (i) => i.districtId === district.id && i.dataOrigin === 'user_submitted'
      );
      if (hasSubmitted) {
        return isHovered ? '#0EA5E9' : '#0369A1';
      }
      return isHovered ? '#334155' : '#1E293B';
    }

    const sim = district.simulatedScenario;
    if (hazardFilter === 'cyclone') {
      if (district.zone === 'coastal') {
        return sim.riskLevel === 'critical' ? '#EF4444' : '#F97316';
      }
      return '#1E293B';
    }

    if (hazardFilter === 'flood') {
      if (sim.riverStatus === 'critical') return '#DC2626';
      if (sim.riverStatus === 'danger') return '#EA580C';
      if (sim.riverStatus === 'rising') return '#D97706';
      return '#1E293B';
    }

    if (hazardFilter === 'heatwave') {
      if (sim.heatIndexCelsius >= 44) return '#EF4444';
      if (sim.heatIndexCelsius >= 41) return '#F97316';
      if (sim.heatIndexCelsius >= 38) return '#F59E0B';
      return '#1E293B';
    }

    switch (sim.riskLevel) {
      case 'critical':
        return isHovered ? '#F87171' : '#DC2626';
      case 'high':
        return isHovered ? '#FB923C' : '#EA580C';
      case 'moderate':
        return isHovered ? '#FBBF24' : '#D97706';
      case 'advisory':
        return isHovered ? '#2DD4BF' : '#0D9488';
      default:
        return isHovered ? '#475569' : '#1E293B';
    }
  };

  const perDistrictSlot = new Map<string, number>();

  return (
    <div className="relative bg-[#0B1120] border border-slate-800 rounded-xl p-4 overflow-hidden">
      {/* Map Header Controls & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Odisha Custom Vector Map
          </span>
          <span className="text-[11px] text-slate-400">
            · 30 Districts · {incidents.length} Incident Marker(s)
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          {dataMode === 'demonstration' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
                <span>Critical (Sim)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#EA580C]" />
                <span>High (Sim)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706]" />
                <span>Moderate (Sim)</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0369A1]" />
              <span>District w/ Unverified User Report</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
            <span>Incident Marker</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative aspect-[4/3] w-full max-h-[580px] flex items-center justify-center">
        <svg
          viewBox="80 70 560 620"
          className="w-full h-full select-none"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
        >
          <defs>
            <pattern id="tactical-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="700" height="700" fill="url(#tactical-grid)" />

          {/* Bay of Bengal Coastline Backdrop */}
          <path
            d="M 620,170 Q 640,300 620,380 T 560,490 T 490,560 T 420,630 L 700,700 L 700,70 Z"
            fill="#061826"
            fillOpacity="0.6"
            stroke="#0284C7"
            strokeWidth="0.8"
            strokeDasharray="4 2"
          />
          <text
            x="590"
            y="470"
            fill="#0284C7"
            fillOpacity="0.4"
            fontSize="16"
            fontWeight="bold"
            letterSpacing="3"
            transform="rotate(65 590 470)"
          >
            BAY OF BENGAL
          </text>

          {/* Major River Reference Paths */}
          <path
            d="M 285,260 Q 340,320 440,340 T 490,360 T 545,410 T 590,420"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeOpacity="0.5"
          />
          <path
            d="M 350,160 Q 420,240 475,280 T 530,315 T 585,320"
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="1.8"
            strokeOpacity="0.45"
          />

          {/* District Polygons */}
          {ODISHA_DISTRICTS.map((district) => {
            const isSelected = district.id === selectedDistrictId;
            const isHovered = hoveredDistrict?.id === district.id;
            const fillColor = getDistrictFillColor(district, isSelected, isHovered);

            return (
              <g
                key={district.id}
                onClick={() => {
                  setSelectedIncident(null);
                  onSelectDistrict(district);
                }}
                onMouseEnter={() => setHoveredDistrict(district)}
                onMouseLeave={() => setHoveredDistrict(null)}
                className="cursor-pointer transition-all duration-150"
              >
                <path
                  d={district.svgPath}
                  fill={fillColor}
                  stroke={isSelected ? '#FFFFFF' : isHovered ? '#94A3B8' : '#0B1120'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 1.8 : 1.2}
                  className="transition-colors duration-150 hover:brightness-110"
                />
                <circle
                  cx={district.centroid[0]}
                  cy={district.centroid[1]}
                  r={isSelected ? 3.5 : 2}
                  fill={isSelected ? '#FFFFFF' : '#E2E8F0'}
                  opacity={isSelected ? 1 : 0.65}
                />
                <text
                  x={district.centroid[0]}
                  y={district.centroid[1] - 6}
                  textAnchor="middle"
                  fill={isSelected ? '#FFFFFF' : '#CBD5E1'}
                  fontSize={isSelected ? '9.5' : '8'}
                  fontWeight={isSelected ? '700' : '500'}
                  className="pointer-events-none drop-shadow"
                >
                  {district.name}
                </text>
              </g>
            );
          })}

          {/* Incident Markers Anchored at District Centroids */}
          {incidents.map((incident) => {
            const district = ODISHA_DISTRICTS.find((d) => d.id === incident.districtId);
            if (!district) return null;
            const slot = perDistrictSlot.get(district.id) || 0;
            perDistrictSlot.set(district.id, slot + 1);
            const angle = (slot * 75 * Math.PI) / 180;
            const radiusOffset = 10 + Math.floor(slot / 5) * 8;
            const cx = district.centroid[0] + Math.cos(angle) * radiusOffset;
            const cy = district.centroid[1] + Math.sin(angle) * radiusOffset;
            const isSim = incident.dataOrigin === 'simulated_demo';
            const fill =
              incident.urgency === 'P1_CRITICAL'
                ? '#F43F5E'
                : incident.urgency === 'P2_HIGH'
                ? '#F59E0B'
                : '#14B8A6';

            return (
              <g
                key={incident.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIncident(incident);
                  onSelectDistrict(district);
                }}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={7}
                  fill={fill}
                  stroke={isSim ? '#FDE68A' : '#FFFFFF'}
                  strokeWidth={isSim ? 1.2 : 2}
                  strokeDasharray={isSim ? '2 1.5' : undefined}
                />
                <text
                  x={cx}
                  y={cy + 2.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="7"
                  fontWeight="700"
                  className="pointer-events-none"
                >
                  {incident.hazardType.slice(0, 1).toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Incident Marker Detail Drawer */}
        {selectedIncident && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-lg p-3.5 shadow-2xl backdrop-blur-md z-30 max-w-xs space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-teal-300">{selectedIncident.incidentCode}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    selectedIncident.dataOrigin === 'simulated_demo'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  {selectedIncident.dataOrigin === 'simulated_demo' ? 'SIMULATED' : 'USER REPORT (UNVERIFIED)'}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close incident marker popup"
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-semibold text-white">
              {selectedIncident.districtName} — {selectedIncident.blockOrLocation}
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-3">{selectedIncident.description}</p>
            <button
              type="button"
              onClick={() => onSelectIncidentForTriage(selectedIncident)}
              className="w-full py-1.5 px-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5"
            >
              <Cpu className="w-3 h-3" />
              <span>Open AI Triage</span>
            </button>
          </div>
        )}

        {/* Floating District Telemetry Tooltip when hovered */}
        {hoveredDistrict && !selectedIncident && (
          <div className="absolute bottom-4 left-4 bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 shadow-xl backdrop-blur-md pointer-events-none z-20 max-w-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-2">
              <div>
                <span className="text-sm font-bold text-white">{hoveredDistrict.name}</span>
                <span className="text-xs text-teal-400 ml-1.5 font-medium">{hoveredDistrict.odiaName}</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-800 text-slate-200">
                {dataMode === 'demonstration' ? `${hoveredDistrict.simulatedScenario.riskLevel} (SIM)` : 'HQ Ref'}
              </span>
            </div>

            {dataMode === 'demonstration' ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Droplets className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Rain (Sim): {hoveredDistrict.simulatedScenario.rainfall24h}mm</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Wind className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Wind (Sim): {hoveredDistrict.simulatedScenario.windSpeedKmph} km/h</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Waves className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>River (Sim): {hoveredDistrict.simulatedScenario.riverWaterLevelPercent}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Shelters (Sim): {hoveredDistrict.simulatedScenario.activeSheltersCount}</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-300">
                Click to load live weather and unverified community incident reports.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Footer Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
        <span>Click any district polygon or incident marker to inspect details.</span>
        <span className="text-teal-400 font-mono">
          {dataMode === 'demonstration' ? 'SIMULATED DISTRICT LAYER' : 'LIVE OFFICIAL / USER-REPORT MODE'} · Schematic Vector Map
        </span>
      </div>
    </div>
  );
};
