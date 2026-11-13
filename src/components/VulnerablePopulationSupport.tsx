/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { DataMode, Incident, IncidentStatus } from '../types/disaster';
import {
  HeartHandshake,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import type { ActiveTab } from './Header';

interface VulnerablePopulationSupportProps {
  incidents: Incident[];
  dataMode: DataMode;
  onNavigateToTab: (tab: ActiveTab) => void;
  onSelectIncidentForTriage: (incident: Incident) => void;
  onUpdateIncidentStatus: (
    incidentId: string,
    newStatus: IncidentStatus,
    coordinationNote?: string
  ) => void;
}

type VulnerabilityFilter =
  | 'all'
  | 'pregnant'
  | 'children'
  | 'disabled'
  | 'elderly'
  | 'medical'
  | 'mobility';

const STATUS_LABELS: Record<IncidentStatus, string> = {
  reported: 'Reported',
  under_review: 'Under Review',
  assistance_required: 'Assistance Required',
  response_in_progress: 'Response in Progress',
  resolved: 'Resolved',
};

export const VulnerablePopulationSupport: React.FC<VulnerablePopulationSupportProps> = ({
  incidents,
  dataMode,
  onNavigateToTab,
  onSelectIncidentForTriage,
  onUpdateIncidentStatus,
}) => {
  const [filterType, setFilterType] = useState<VulnerabilityFilter>('all');

  const sortedIncidents = [...incidents].sort(
    (a, b) => b.vulnerabilityScore - a.vulnerabilityScore
  );

  const filteredIncidents = sortedIncidents.filter((inc) => {
    if (filterType === 'pregnant') return inc.vulnerable.pregnantCount > 0;
    if (filterType === 'children') return inc.vulnerable.childrenCount > 0;
    if (filterType === 'disabled') return inc.vulnerable.disabledCount > 0;
    if (filterType === 'elderly') return inc.vulnerable.elderlyCount > 0;
    if (filterType === 'medical') return (inc.vulnerable.medicalConditionCount || 0) > 0;
    if (filterType === 'mobility') return (inc.vulnerable.mobilityAidCount || 0) > 0;
    return true;
  });

  const totalPregnant = incidents.reduce((sum, i) => sum + i.vulnerable.pregnantCount, 0);
  const totalChildren = incidents.reduce((sum, i) => sum + i.vulnerable.childrenCount, 0);
  const totalDisabled = incidents.reduce((sum, i) => sum + i.vulnerable.disabledCount, 0);
  const totalElderly = incidents.reduce((sum, i) => sum + i.vulnerable.elderlyCount, 0);
  const totalMedical = incidents.reduce(
    (sum, i) => sum + (i.vulnerable.medicalConditionCount || 0),
    0
  );
  const totalMobility = incidents.reduce(
    (sum, i) => sum + (i.vulnerable.mobilityAidCount || 0),
    0
  );

  const toggleFilter = (target: Exclude<VulnerabilityFilter, 'all'>) => {
    setFilterType((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-teal-400 font-semibold uppercase tracking-wider">
            <HeartHandshake className="w-4 h-4 text-teal-400" />
            <span>Vulnerable Population Prioritisation Queue</span>
          </div>
          <span
            className={`text-[11px] font-mono px-2.5 py-0.5 rounded border ${
              dataMode === 'demonstration'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
            }`}
          >
            {dataMode === 'demonstration'
              ? 'SIMULATED DEMO + USER REPORTS'
              : 'LIVE MODE · USER REPORTS ONLY (UNVERIFIED)'}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Vulnerable Population Support & Evacuation Priority
        </h1>
        <p className="text-xs text-slate-300">
          Multi-factor prioritization across all six high-risk categories (expectant mothers, children,
          persons with disabilities, senior citizens, serious medical needs, and mobility-aid users).
          Personal reporter contact details are masked for privacy &amp; data minimization.
        </p>
      </div>

      {/* Demographic Triage Weights & Rationale Cards (All 6 Categories) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Expectant Mothers */}
        <button
          type="button"
          onClick={() => toggleFilter('pregnant')}
          className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all ${
            filterType === 'pregnant'
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-rose-300">Pregnant Women</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
              Weight +35
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalPregnant} Tracked
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            <strong className="text-slate-300">Why prioritized:</strong> Elevated obstetric risk of
            preterm labour or haemorrhage if cut off by floodwaters; requires priority medical evacuation.
          </p>
        </button>

        {/* 2. Serious Medical Conditions */}
        <button
          type="button"
          onClick={() => toggleFilter('medical')}
          className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all ${
            filterType === 'medical'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-purple-300">Serious Medical Conditions</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
              Weight +25
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalMedical} Tracked
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            <strong className="text-slate-300">Why prioritized:</strong> Dependence on insulin,
            dialysis, oxygen, or continuous power/cold-chain supply disrupted by cyclone outages.
          </p>
        </button>

        {/* 3. Persons with Disabilities */}
        <button
          type="button"
          onClick={() => toggleFilter('disabled')}
          className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all ${
            filterType === 'disabled'
              ? 'border-cyan-500 bg-cyan-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-cyan-300">Persons with Disabilities</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              Weight +25
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalDisabled} Tracked
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            <strong className="text-slate-300">Why prioritized:</strong> Auditory, visual, cognitive, or
            physical barriers prevent unaided early evacuation along flooded embankments.
          </p>
        </button>

        {/* 4. Children & Infants (<10y) */}
        <button
          type="button"
          onClick={() => toggleFilter('children')}
          className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all ${
            filterType === 'children'
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-amber-300">Children &amp; Infants (&lt;10y)</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
              Weight +25
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalChildren} Tracked
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            <strong className="text-slate-300">Why prioritized:</strong> Rapid hypothermia onset,
            higher drowning susceptibility, and acute dehydration/waterborne illness risk.
          </p>
        </button>

        {/* 5. Mobility Assistance Required */}
        <button
          type="button"
          onClick={() => toggleFilter('mobility')}
          className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all ${
            filterType === 'mobility'
              ? 'border-sky-500 bg-sky-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-sky-300">Mobility Aid / Stretcher Need</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
              Weight +20
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalMobility} Tracked
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            <strong className="text-slate-300">Why prioritized:</strong> Cannot wade through waist-deep
            water or climb shelter stairs without trained stretcher teams and accessible transport.
          </p>
        </button>

        {/* 6. Elderly Citizens (65+) */}
        <button
          type="button"
          onClick={() => toggleFilter('elderly')}
          className={`text-left bg-[#0D1527] border rounded-xl p-4 transition-all ${
            filterType === 'elderly'
              ? 'border-teal-500 bg-teal-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-teal-300">Elderly Citizens (65+)</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
              Weight +20
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalElderly} Tracked
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            <strong className="text-slate-300">Why prioritized:</strong> Heightened mortality from
            heatstroke, exhaustion, sensory impairment, and chronic medication interruption.
          </p>
        </button>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1527] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Filter Queue:</span>
          {(
            [
              { id: 'all', label: `All Incidents (${sortedIncidents.length})`, activeClass: 'bg-teal-600 text-white' },
              { id: 'pregnant', label: 'Pregnant', activeClass: 'bg-rose-600 text-white' },
              { id: 'medical', label: 'Medical Needs', activeClass: 'bg-purple-600 text-white' },
              { id: 'disabled', label: 'Disabilities', activeClass: 'bg-cyan-600 text-white' },
              { id: 'children', label: 'Children (<10y)', activeClass: 'bg-amber-600 text-white' },
              { id: 'mobility', label: 'Mobility Aid', activeClass: 'bg-sky-600 text-white' },
              { id: 'elderly', label: 'Elderly (65+)', activeClass: 'bg-teal-600 text-white' },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterType(btn.id)}
              className={`px-3 py-1 rounded transition-colors ${
                filterType === btn.id
                  ? `${btn.activeClass} font-medium`
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          VPI = (Preg×35)+(Med×25)+(Dis×25)+(Child×25)+(Mob×20)+(Eld×20)+Severity
        </div>
      </div>

      {/* Empty State */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-white">
            {incidents.length === 0
              ? 'No user-submitted reports recorded yet in Live Mode'
              : 'No incidents match this vulnerability category filter'}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {incidents.length === 0
              ? 'Simulated demo records are hidden in Live Mode. User-submitted reports are unverified community entries; submit an incident report with vulnerable group details or switch to Demonstration Mode.'
              : 'Select "All Incidents" to view every reported case ranked by vulnerability priority score.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            {filterType !== 'all' && (
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Show All Incidents
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateToTab('report')}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg"
            >
              Report Incident
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident, rankIndex) => {
            const isP1 = incident.urgency === 'P1_CRITICAL';
            const isTopPriority = rankIndex === 0;
            const medicalCount = incident.vulnerable.medicalConditionCount || 0;
            const mobilityCount = incident.vulnerable.mobilityAidCount || 0;
            const isSimulated = incident.dataOrigin === 'simulated_demo';

            const reasons: string[] = [];
            if (incident.vulnerable.pregnantCount > 0) {
              reasons.push(
                `${incident.vulnerable.pregnantCount} expectant mother(s) at obstetric/isolation risk`
              );
            }
            if (medicalCount > 0) {
              reasons.push(
                `${medicalCount} person(s) with serious medical conditions needing continuous care/power`
              );
            }
            if (incident.vulnerable.disabledCount > 0) {
              reasons.push(
                `${incident.vulnerable.disabledCount} person(s) with disabilities requiring assisted evacuation`
              );
            }
            if (incident.vulnerable.childrenCount > 0) {
              reasons.push(
                `${incident.vulnerable.childrenCount} child(ren) (<10y) vulnerable to hypothermia/waterborne risk`
              );
            }
            if (mobilityCount > 0) {
              reasons.push(
                `${mobilityCount} person(s) requiring mobility aids or stretcher evacuation`
              );
            }
            if (incident.vulnerable.elderlyCount > 0) {
              reasons.push(
                `${incident.vulnerable.elderlyCount} senior citizen(s) (65+) vulnerable to exhaustion/heat`
              );
            }
            if ((incident.injuredCount || 0) > 0 || (incident.missingCount || 0) > 0) {
              reasons.push(
                `${incident.injuredCount || 0} injured and ${incident.missingCount || 0} missing reported`
              );
            }

            return (
              <div
                key={incident.id}
                className={`bg-[#0D1527] border rounded-xl p-5 transition-all ${
                  isTopPriority
                    ? 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.08)]'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                        isTopPriority
                          ? 'bg-rose-500 text-white shadow-lg'
                          : rankIndex < 3
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{rankIndex + 1}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {incident.districtName} — {incident.blockOrLocation}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {incident.incidentCode}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            isSimulated
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                          }`}
                        >
                          {isSimulated ? 'SIMULATED DATA' : 'USER REPORT (UNVERIFIED)'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Landmark:{' '}
                        <span className="text-slate-300">{incident.landmark || 'Not specified'}</span>
                        {' · '}Affected:{' '}
                        <span className="text-slate-200 font-mono">
                          {incident.peopleAffected !== null ? incident.peopleAffected : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Vulnerability Score</div>
                      <div className="text-lg font-bold font-mono tabular-nums text-teal-300">
                        {incident.vulnerabilityScore} pts
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded font-mono ${
                        isP1
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : incident.urgency === 'P2_HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      }`}
                    >
                      {incident.urgency.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 my-3 leading-relaxed">
                  {incident.description}
                </p>

                {/* All 6 Demographic Counters + Livestock */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 bg-[#121B30] p-3 rounded-lg border border-slate-800 text-xs mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-rose-400 font-bold font-mono">{incident.vulnerable.pregnantCount}</span>
                    <span className="text-slate-300">Pregnant</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold font-mono">{medicalCount}</span>
                    <span className="text-slate-300">Medical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold font-mono">{incident.vulnerable.disabledCount}</span>
                    <span className="text-slate-300">Disabled</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold font-mono">{incident.vulnerable.childrenCount}</span>
                    <span className="text-slate-300">Children</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sky-400 font-bold font-mono">{mobilityCount}</span>
                    <span className="text-slate-300">Mobility Aid</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-teal-300 font-bold font-mono">{incident.vulnerable.elderlyCount}</span>
                    <span className="text-slate-300">Elderly (65+)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold font-mono">{incident.vulnerable.livestockCount}</span>
                    <span className="text-slate-400">Livestock</span>
                  </div>
                </div>

                {/* Clinical Prioritisation Rationale Box */}
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 mb-4 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-semibold text-teal-300">
                      Why This Incident Holds Queue Rank #{rankIndex + 1}:
                    </div>
                    <p className="text-[11px] text-teal-200/90 leading-relaxed">
                      {reasons.length > 0
                        ? `${reasons.join('; ')}. `
                        : 'No specialized vulnerable sub-group counts specified; ranked by hazard urgency and affected count. '}
                      Affected count:{' '}
                      {incident.peopleAffected !== null ? `${incident.peopleAffected} person(s)` : 'Unknown'}{' '}
                      in {incident.districtName}.
                    </p>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/60 pt-3">
                  <div className="flex flex-wrap items-center gap-2 text-slate-400">
                    <span>Workflow Status:</span>
                    <span className="font-bold text-slate-200">
                      {STATUS_LABELS[incident.status] || incident.status}
                    </span>
                    {incident.coordinationNote && (
                      <span className="text-teal-300 font-mono text-[11px] truncate max-w-xs">
                        · Note: {incident.coordinationNote}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectIncidentForTriage(incident);
                        onNavigateToTab('ai-triage');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-teal-300 bg-teal-500/15 border border-teal-500/30 rounded-lg hover:bg-teal-500/25 transition-colors flex items-center gap-1.5"
                    >
                      <span>View AI Triage Guidance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {(incident.status === 'reported' || incident.status === 'under_review') && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateIncidentStatus(
                            incident.id,
                            'assistance_required',
                            'Flagged via Vulnerable Population Queue — priority assisted evacuation & medical support needed (prototype status only; not official dispatch).'
                          )
                        }
                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Flag Assistance Required</span>
                      </button>
                    )}

                    {incident.status === 'assistance_required' && (
                      <span className="px-2.5 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Flagged for Priority Assistance</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
