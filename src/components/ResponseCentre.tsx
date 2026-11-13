/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { DataMode, Incident, IncidentStatus, IncidentUrgency } from '../types/disaster';
import {
  Search,
  Download,
  Eye,
  Cpu,
  Building,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import type { ActiveTab } from './Header';

interface ResponseCentreProps {
  incidents: Incident[];
  dataMode: DataMode;
  isLoading: boolean;
  storageType: string;
  onNavigateToTab: (tab: ActiveTab) => void;
  onSelectIncidentForTriage: (incident: Incident) => void;
  onUpdateStatus: (
    incidentId: string,
    newStatus: IncidentStatus,
    coordinationNote?: string
  ) => void;
}

const STATUS_META: Record<IncidentStatus, { label: string; badgeClass: string }> = {
  reported: {
    label: 'Reported',
    badgeClass: 'bg-slate-700 text-slate-200 border border-slate-600',
  },
  under_review: {
    label: 'Under Review',
    badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  },
  assistance_required: {
    label: 'Assistance Required',
    badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  },
  response_in_progress: {
    label: 'Response in Progress',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  },
};

function sanitizeCsvCell(val: string | number | null | undefined): string {
  const raw = val === null || val === undefined ? '' : String(val);
  // Prevent CSV formula injection in spreadsheet tools
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const ResponseCentre: React.FC<ResponseCentreProps> = ({
  incidents,
  dataMode,
  isLoading,
  storageType,
  onNavigateToTab,
  onSelectIncidentForTriage,
  onUpdateStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [statusDraft, setStatusDraft] = useState<IncidentStatus>('reported');

  const selectedIncidentDetail = selectedIncidentId
    ? incidents.find((i) => i.id === selectedIncidentId) || null
    : null;

  useEffect(() => {
    if (selectedIncidentDetail) {
      setNoteDraft(selectedIncidentDetail.coordinationNote || '');
      setStatusDraft(selectedIncidentDetail.status);
    }
  }, [selectedIncidentDetail]);

  const filteredIncidents = incidents.filter((inc) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inc.incidentCode.toLowerCase().includes(q) ||
      inc.districtName.toLowerCase().includes(q) ||
      inc.blockOrLocation.toLowerCase().includes(q) ||
      inc.description.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'all' || inc.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const getUrgencyBadge = (urgency: IncidentUrgency) => {
    switch (urgency) {
      case 'P1_CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold';
      case 'P2_HIGH':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold';
      case 'P3_STANDARD':
      default:
        return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
    }
  };

  const exportCSV = () => {
    const headers = [
      'Incident Code',
      'Origin',
      'Reported Timestamp',
      'District',
      'Block / Location',
      'Hazard',
      'Urgency',
      'Affected',
      'Injured',
      'Missing',
      'Pregnant',
      'Children',
      'Disabled',
      'Elderly',
      'Medical Condition',
      'Mobility Aid',
      'Status',
      'Coordination Note',
    ];
    // Reporter personal contact details are intentionally excluded from CSV exports (data minimization)
    const rows = incidents.map((i) => [
      sanitizeCsvCell(i.incidentCode),
      sanitizeCsvCell(i.dataOrigin === 'simulated_demo' ? 'SIMULATED' : 'USER_REPORT_UNVERIFIED'),
      sanitizeCsvCell(i.timestamp),
      sanitizeCsvCell(i.districtName),
      sanitizeCsvCell(i.blockOrLocation),
      sanitizeCsvCell(i.hazardType),
      sanitizeCsvCell(i.urgency),
      sanitizeCsvCell(i.peopleAffected !== null ? i.peopleAffected : 'Unknown'),
      sanitizeCsvCell(i.injuredCount !== null ? i.injuredCount : 'Unknown'),
      sanitizeCsvCell(i.missingCount !== null ? i.missingCount : 'Unknown'),
      sanitizeCsvCell(i.vulnerable.pregnantCount),
      sanitizeCsvCell(i.vulnerable.childrenCount),
      sanitizeCsvCell(i.vulnerable.disabledCount),
      sanitizeCsvCell(i.vulnerable.elderlyCount),
      sanitizeCsvCell(i.vulnerable.medicalConditionCount || 0),
      sanitizeCsvCell(i.vulnerable.mobilityAidCount || 0),
      sanitizeCsvCell(STATUS_META[i.status]?.label || i.status),
      sanitizeCsvCell(i.coordinationNote || ''),
    ]);

    const csvText = [headers.map(sanitizeCsvCell).join(','), ...rows.map((r) => r.join(','))].join(
      '\n'
    );
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `odisha_suraksha_incidents_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveDossierCoordination = () => {
    if (!selectedIncidentDetail) return;
    onUpdateStatus(selectedIncidentDetail.id, statusDraft, noteDraft.trim());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-xl p-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-teal-400 font-semibold uppercase tracking-wider">
            <Building className="w-4 h-4 text-teal-400" />
            <span>Response Coordination Desk</span>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                dataMode === 'demonstration'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
              }`}
            >
              {dataMode === 'demonstration'
                ? 'SIMULATED + USER REPORTS'
                : 'USER REPORTS ONLY (UNVERIFIED)'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Operational Response &amp; Incident Tracking Centre
          </h1>
          <p className="text-xs text-slate-300">
            Track incident workflow statuses, review vulnerable needs, inspect uploaded field images,
            and record coordination notes ({storageType}).
          </p>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          disabled={incidents.length === 0}
          className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Incident Log (CSV)</span>
        </button>
      </div>

      {/* Non-Dispatch Operational Boundary Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong>Coordination Workflow Notice:</strong> Updating status stages or saving
          coordination notes updates prototype persistence records only. This interface does{' '}
          <strong>not</strong> automatically dispatch NDRF, ODRAF, ambulances, or confirm real
          shelter capacities. For live emergencies in Odisha, contact 112 or SEOC 1070.
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search reference code, district, block, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <label htmlFor="rc-status-filter" className="text-slate-400">
              Status:
            </label>
            <select
              id="rc-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-white"
            >
              <option value="all">All Statuses ({incidents.length})</option>
              <option value="reported">Reported</option>
              <option value="under_review">Under Review</option>
              <option value="assistance_required">Assistance Required</option>
              <option value="response_in_progress">Response in Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="rc-urgency-filter" className="text-slate-400">
              Urgency:
            </label>
            <select
              id="rc-urgency-filter"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-white"
            >
              <option value="all">All Urgencies</option>
              <option value="P1_CRITICAL">P1 Critical</option>
              <option value="P2_HIGH">P2 High</option>
              <option value="P3_STANDARD">P3 Standard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Operational Table */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Loading persisted incident records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference &amp; Time</th>
                  <th className="py-3 px-4 font-semibold">District &amp; Block</th>
                  <th className="py-3 px-4 font-semibold">Hazard</th>
                  <th className="py-3 px-4 font-semibold">Urgency</th>
                  <th className="py-3 px-4 font-semibold text-right">Affected</th>
                  <th className="py-3 px-4 font-semibold">Vulnerable Needs</th>
                  <th className="py-3 px-4 font-semibold">Coordination Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                      <FileText className="w-6 h-6 text-slate-600 mx-auto" />
                      <div className="text-sm font-medium text-slate-300">
                        {incidents.length === 0
                          ? 'No user-submitted reports in Live Mode yet'
                          : 'No matching incidents found'}
                      </div>
                      {incidents.length === 0 && (
                        <button
                          type="button"
                          onClick={() => onNavigateToTab('report')}
                          className="mt-2 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg"
                        >
                          Submit an Incident Report
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((incident) => {
                    const vulnTotal =
                      incident.vulnerable.pregnantCount +
                      incident.vulnerable.childrenCount +
                      incident.vulnerable.disabledCount +
                      incident.vulnerable.elderlyCount +
                      (incident.vulnerable.medicalConditionCount || 0) +
                      (incident.vulnerable.mobilityAidCount || 0);

                    const isSimulated = incident.dataOrigin === 'simulated_demo';
                    const meta = STATUS_META[incident.status] || STATUS_META.reported;

                    return (
                      <tr key={incident.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-teal-300">
                              {incident.incidentCode}
                            </span>
                            {incident.supportingImageDataUrl && (
                              <ImageIcon
                                className="w-3.5 h-3.5 text-sky-400"
                                aria-label="Has supporting image"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                isSimulated
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-teal-500/15 text-teal-300'
                              }`}
                            >
                              {isSimulated ? 'SIMULATED' : 'USER REPORT (UNVERIFIED)'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(incident.timestamp).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{incident.districtName}</div>
                          <div className="text-[11px] text-slate-400">{incident.blockOrLocation}</div>
                        </td>

                        <td className="py-3 px-4 capitalize text-slate-300">
                          {incident.hazardType}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${getUrgencyBadge(
                              incident.urgency
                            )}`}
                          >
                            {incident.urgency.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                          {incident.peopleAffected !== null ? incident.peopleAffected : 'Unknown'}
                          {((incident.injuredCount || 0) > 0 || (incident.missingCount || 0) > 0) && (
                            <div className="text-[10px] text-rose-300 font-normal">
                              {incident.injuredCount || 0} inj · {incident.missingCount || 0} miss
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-cyan-300">
                            {vulnTotal > 0 ? `${vulnTotal} flagged` : 'None specified'}
                          </span>
                          {vulnTotal > 0 && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {[
                                incident.vulnerable.pregnantCount > 0
                                  ? `${incident.vulnerable.pregnantCount} preg`
                                  : '',
                                (incident.vulnerable.medicalConditionCount || 0) > 0
                                  ? `${incident.vulnerable.medicalConditionCount} med`
                                  : '',
                                incident.vulnerable.disabledCount > 0
                                  ? `${incident.vulnerable.disabledCount} dis`
                                  : '',
                                incident.vulnerable.childrenCount > 0
                                  ? `${incident.vulnerable.childrenCount} child`
                                  : '',
                                (incident.vulnerable.mobilityAidCount || 0) > 0
                                  ? `${incident.vulnerable.mobilityAidCount} mob`
                                  : '',
                                incident.vulnerable.elderlyCount > 0
                                  ? `${incident.vulnerable.elderlyCount} eld`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>

                        {/* Status Dropdown & Coordination Note */}
                        <td className="py-3 px-4 space-y-1">
                          <select
                            aria-label={`Update status for ${incident.incidentCode}`}
                            value={incident.status}
                            onChange={(e) =>
                              onUpdateStatus(
                                incident.id,
                                e.target.value as IncidentStatus,
                                incident.coordinationNote
                              )
                            }
                            className={`text-[11px] font-semibold px-2 py-1 rounded font-mono cursor-pointer ${meta.badgeClass}`}
                          >
                            <option value="reported">Reported</option>
                            <option value="under_review">Under Review</option>
                            <option value="assistance_required">Assistance Required</option>
                            <option value="response_in_progress">Response in Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>

                          {incident.coordinationNote ? (
                            <div
                              className="text-[10px] text-slate-400 truncate max-w-[200px]"
                              title={incident.coordinationNote}
                            >
                              Note: {incident.coordinationNote}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedIncidentId(incident.id)}
                              className="block text-[10px] text-teal-400 hover:text-teal-300 underline"
                            >
                              + Add Coordination Note
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedIncidentId(incident.id)}
                            className="p-1.5 text-slate-300 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                            title="View Full Incident Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectIncidentForTriage(incident);
                              onNavigateToTab('ai-triage');
                            }}
                            className="p-1.5 text-teal-400 hover:text-teal-300 rounded bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 transition-colors"
                            title="Open AI Incident Analysis"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Dossier Modal */}
      {selectedIncidentDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Incident Dossier ${selectedIncidentDetail.incidentCode}`}
        >
          <div className="bg-[#0D1527] border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold font-mono text-teal-400">
                    {selectedIncidentDetail.incidentCode}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono ${getUrgencyBadge(
                      selectedIncidentDetail.urgency
                    )}`}
                  >
                    {selectedIncidentDetail.urgency.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      selectedIncidentDetail.dataOrigin === 'simulated_demo'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    }`}
                  >
                    {selectedIncidentDetail.dataOrigin === 'simulated_demo'
                      ? 'SIMULATED DEMO'
                      : 'USER REPORT (UNVERIFIED)'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  {selectedIncidentDetail.districtName} — {selectedIncidentDetail.blockOrLocation}
                </h3>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Reported:{' '}
                  {new Date(selectedIncidentDetail.timestamp).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}{' '}
                  IST
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncidentId(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
                aria-label="Close dossier"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#121B30] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Landmark / Spot Info:</span>
                  <div className="text-slate-200 mt-0.5">
                    {selectedIncidentDetail.landmark || 'Not specified'}
                  </div>
                </div>
                <div className="bg-[#121B30] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Available Local Resources:</span>
                  <div className="text-slate-200 mt-0.5">
                    {selectedIncidentDetail.availableResources || 'None reported'}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-400">Incident Description:</span>
                <p className="text-slate-200 mt-1 leading-relaxed bg-[#121B30] p-3 rounded-lg border border-slate-800">
                  {selectedIncidentDetail.description}
                </p>
              </div>

              {/* Casualties & Affected */}
              <div className="grid grid-cols-3 gap-2 bg-[#121B30] p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400">Affected People</span>
                  <div className="text-base font-bold text-white font-mono">
                    {selectedIncidentDetail.peopleAffected !== null
                      ? selectedIncidentDetail.peopleAffected
                      : 'Unknown'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Injured</span>
                  <div className="text-base font-bold text-amber-300 font-mono">
                    {selectedIncidentDetail.injuredCount !== null
                      ? selectedIncidentDetail.injuredCount
                      : 'Unknown'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Missing</span>
                  <div className="text-base font-bold text-rose-300 font-mono">
                    {selectedIncidentDetail.missingCount !== null
                      ? selectedIncidentDetail.missingCount
                      : 'Unknown'}
                  </div>
                </div>
              </div>

              {/* All 6 Vulnerable Groups + Livestock */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#121B30] p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-rose-400">Pregnant</span>
                  <div className="text-sm font-bold text-rose-300 font-mono">
                    {selectedIncidentDetail.vulnerable.pregnantCount}
                  </div>
                </div>
                <div>
                  <span className="text-purple-400">Medical Needs</span>
                  <div className="text-sm font-bold text-purple-300 font-mono">
                    {selectedIncidentDetail.vulnerable.medicalConditionCount || 0}
                  </div>
                </div>
                <div>
                  <span className="text-cyan-400">Disabilities</span>
                  <div className="text-sm font-bold text-cyan-300 font-mono">
                    {selectedIncidentDetail.vulnerable.disabledCount}
                  </div>
                </div>
                <div>
                  <span className="text-amber-400">Children (&lt;10y)</span>
                  <div className="text-sm font-bold text-amber-300 font-mono">
                    {selectedIncidentDetail.vulnerable.childrenCount}
                  </div>
                </div>
                <div>
                  <span className="text-sky-400">Mobility Aid</span>
                  <div className="text-sm font-bold text-sky-300 font-mono">
                    {selectedIncidentDetail.vulnerable.mobilityAidCount || 0}
                  </div>
                </div>
                <div>
                  <span className="text-teal-400">Elderly (65+)</span>
                  <div className="text-sm font-bold text-teal-300 font-mono">
                    {selectedIncidentDetail.vulnerable.elderlyCount}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Livestock</span>
                  <div className="text-sm font-bold text-slate-300 font-mono">
                    {selectedIncidentDetail.vulnerable.livestockCount}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Reporter Contact</span>
                  <div className="text-[11px] font-mono text-slate-300">
                    {selectedIncidentDetail.reporterContact || 'Omitted (Minimized)'}
                  </div>
                </div>
              </div>

              {/* Optional Uploaded Image Preview */}
              {selectedIncidentDetail.supportingImageDataUrl && (
                <div className="space-y-1.5">
                  <span className="text-slate-400">Supporting Field Image:</span>
                  <img
                    src={selectedIncidentDetail.supportingImageDataUrl}
                    alt={`Supporting attachment for ${selectedIncidentDetail.incidentCode}`}
                    className="max-h-56 rounded-lg border border-slate-700 object-contain bg-slate-950"
                  />
                </div>
              )}

              {/* Coordination Status & Note Editor */}
              <div className="bg-[#121B30] border border-slate-800 rounded-lg p-3.5 space-y-3">
                <div className="font-semibold text-teal-300">
                  Coordination Workflow Status &amp; Note (Prototype Log)
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      'reported',
                      'under_review',
                      'assistance_required',
                      'response_in_progress',
                      'resolved',
                    ] as IncidentStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusDraft(st)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                        statusDraft === st
                          ? 'bg-teal-600 text-white border-teal-400 font-semibold'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {STATUS_META[st].label}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="coordination-note-input" className="block text-slate-400 mb-1">
                    Coordination / Follow-Up Note (persisted to incident store):
                  </label>
                  <textarea
                    id="coordination-note-input"
                    rows={2}
                    maxLength={400}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Record verification call outcome, volunteer check-in, or staging note (do not enter sensitive PII)..."
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveDossierCoordination}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Status &amp; Note</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedIncidentId(null)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white"
              >
                Close Dossier
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectIncidentForTriage(selectedIncidentDetail);
                  setSelectedIncidentId(null);
                  onNavigateToTab('ai-triage');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Open AI Incident Analysis</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
