/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { AITriageResult, DistrictRisk, HazardType, Incident } from '../types/disaster';
import { requestAITriage } from '../services/aiService';
import {
  Cpu,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  AlertCircle,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';

interface AIIncidentAnalysisProps {
  incidents: Incident[];
  districts: DistrictRisk[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  onSaveTriageResult: (incidentId: string, result: AITriageResult) => void;
}

export const AIIncidentAnalysis: React.FC<AIIncidentAnalysisProps> = ({
  incidents,
  districts,
  selectedIncident,
  onSelectIncident,
  onSaveTriageResult,
}) => {
  const currentIncident = selectedIncident || incidents[0] || null;

  const [isCustomMode, setIsCustomMode] = useState(incidents.length === 0);
  const [customDistrict, setCustomDistrict] = useState('Puri');
  const [customLocation, setCustomLocation] = useState('');
  const [customHazardType, setCustomHazardType] = useState<HazardType>('flood');
  const [customAffected, setCustomAffected] = useState('');
  const [customInjured, setCustomInjured] = useState('');
  const [customMissing, setCustomMissing] = useState('');
  const [customElderly, setCustomElderly] = useState('0');
  const [customChildren, setCustomChildren] = useState('0');
  const [customPregnant, setCustomPregnant] = useState('0');
  const [customDisabled, setCustomDisabled] = useState('0');
  const [customMedical, setCustomMedical] = useState('0');
  const [customMobility, setCustomMobility] = useState('0');
  const [customResources, setCustomResources] = useState('');
  const [customText, setCustomText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const [activeResult, setActiveResult] = useState<AITriageResult | null>(
    currentIncident?.aiTriageResult || null
  );

  // Sync displayed dossier whenever external selectedIncident changes
  useEffect(() => {
    if (!isCustomMode) {
      setActiveResult(currentIncident?.aiTriageResult || null);
      setErrorMessage('');
    }
  }, [currentIncident?.id, currentIncident?.aiTriageResult, isCustomMode]);

  const handleIncidentChange = (incidentId: string) => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (inc) {
      onSelectIncident(inc);
      setActiveResult(inc.aiTriageResult || null);
      setErrorMessage('');
    }
  };

  const handleRunTriage = async () => {
    setErrorMessage('');

    let payload;
    if (isCustomMode) {
      if (!customLocation.trim() || customText.trim().length < 15) {
        setErrorMessage('Please enter both a location and an incident description (at least 15 characters).');
        return;
      }
      const optInt = (val: string) => {
        if (!val.trim()) return null;
        const n = Number(val);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
      };
      payload = {
        districtName: customDistrict,
        blockOrLocation: customLocation.trim(),
        hazardType: customHazardType,
        urgency: 'P2_HIGH' as const,
        peopleAffected: optInt(customAffected),
        injuredCount: optInt(customInjured),
        missingCount: optInt(customMissing),
        availableResources: customResources.trim() || undefined,
        vulnerable: {
          elderlyCount: Number(customElderly) || 0,
          childrenCount: Number(customChildren) || 0,
          pregnantCount: Number(customPregnant) || 0,
          disabledCount: Number(customDisabled) || 0,
          medicalConditionCount: Number(customMedical) || 0,
          mobilityAidCount: Number(customMobility) || 0,
          livestockCount: 0,
        },
        description: customText.trim(),
      };
    } else if (currentIncident) {
      payload = {
        districtName: currentIncident.districtName,
        blockOrLocation: currentIncident.blockOrLocation,
        landmark: currentIncident.landmark,
        hazardType: currentIncident.hazardType,
        urgency: currentIncident.urgency,
        peopleAffected: currentIncident.peopleAffected,
        injuredCount: currentIncident.injuredCount,
        missingCount: currentIncident.missingCount,
        availableResources: currentIncident.availableResources,
        vulnerable: currentIncident.vulnerable,
        description: currentIncident.description,
      };
    } else {
      setErrorMessage('No incident selected. Switch to Custom Analysis or submit an incident report first.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestAITriage(payload);
      setActiveResult(result);

      if (!isCustomMode && currentIncident) {
        onSaveTriageResult(currentIncident.id, result);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to complete incident analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const copySOP = async () => {
    if (!activeResult) return;
    const text = `ODISHA SURAKSHA AI — EXPERIMENTAL DECISION-SUPPORT TRIAGE (${
      activeResult.isSimulatedAI ? 'RULE-BASED FALLBACK' : `GEMINI (${activeResult.modelUsed})`
    })
Hazard: ${activeResult.categorizedHazard}
Suggested Urgency: ${activeResult.urgencyLevel}
Summary: ${activeResult.summary}
Urgency Rationale: ${activeResult.priorityRationale}
Vulnerable Considerations: ${activeResult.vulnerabilityImpact}

IMMEDIATE SAFETY RECOMMENDATIONS:
${activeResult.safetyChecklist.map((s) => `• ${s}`).join('\n')}

SUGGESTED RESPONSE PRIORITIES:
${activeResult.immediateActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

INFORMATION STILL REQUIRED FROM REPORTER:
${(activeResult.missingInformation || []).map((m) => `• ${m}`).join('\n')}
`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Clipboard copy blocked by browser permissions.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Experimental Decision Support Disclaimer */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-300">
            Experimental AI Decision Support — Not an Official Warning or Government Decision
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            Analyses generated here are experimental decision support using Gemini AI (or a deterministic rule-based
            fallback when Gemini is unavailable). Outputs are NOT verified IMD, OSDMA, or government dispatch directives.
            In real emergencies, contact district authorities and dial <strong>112</strong> or <strong>1070</strong>.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Selector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-teal-400" />
                <h2 className="text-sm font-semibold text-white">Incident Input</h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    !isCustomMode ? 'bg-teal-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Saved Incidents
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    setActiveResult(null);
                  }}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    isCustomMode ? 'bg-teal-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Input
                </button>
              </div>
            </div>

            {!isCustomMode ? (
              incidents.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#121B30] border border-slate-800 text-xs text-slate-400 space-y-2">
                  <div>No saved incidents available in the current mode.</div>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(true)}
                    className="text-teal-400 hover:underline font-medium"
                  >
                    Switch to Custom Input to analyze an incident directly →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    Select Reported Incident:
                  </label>
                  <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                    {incidents.map((inc) => {
                      const isSelected = currentIncident?.id === inc.id;
                      const isSim = inc.dataOrigin === 'simulated_demo';
                      return (
                        <button
                          key={inc.id}
                          type="button"
                          onClick={() => handleIncidentChange(inc.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                            isSelected
                              ? 'bg-teal-500/15 border-teal-500/50 text-white'
                              : 'bg-[#121B30] border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-teal-300 font-bold">{inc.incidentCode}</span>
                              <span className="text-[10px] text-slate-400">
                                {isSim ? 'SIMULATED' : 'USER REPORT (UNVERIFIED)'}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                inc.urgency === 'P1_CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {inc.urgency.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-100">
                            {inc.districtName} — {inc.blockOrLocation}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{inc.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="ai-district" className="block font-medium text-slate-300 mb-1">District</label>
                    <select
                      id="ai-district"
                      value={customDistrict}
                      onChange={(e) => setCustomDistrict(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      {districts.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ai-hazard" className="block font-medium text-slate-300 mb-1">Disaster Type</label>
                    <select
                      id="ai-hazard"
                      value={customHazardType}
                      onChange={(e) => setCustomHazardType(e.target.value as HazardType)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="flood">Flood / Flash Flood</option>
                      <option value="cyclone">Cyclone / Surge</option>
                      <option value="embankment">Embankment Risk</option>
                      <option value="heatwave">Heatwave</option>
                      <option value="landslide">Landslide</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="ai-loc" className="block font-medium text-slate-300 mb-1">Block / Location *</label>
                  <input
                    id="ai-loc"
                    type="text"
                    placeholder="e.g. Ward 14, Bhubaneswar"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="ai-aff" className="block text-[11px] text-slate-400 mb-1">Affected</label>
                    <input
                      id="ai-aff"
                      type="number"
                      min="0"
                      placeholder="Unknown"
                      value={customAffected}
                      onChange={(e) => setCustomAffected(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="ai-inj" className="block text-[11px] text-slate-400 mb-1">Injured</label>
                    <input
                      id="ai-inj"
                      type="number"
                      min="0"
                      placeholder="Unknown"
                      value={customInjured}
                      onChange={(e) => setCustomInjured(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="ai-mis" className="block text-[11px] text-slate-400 mb-1">Missing</label>
                    <input
                      id="ai-mis"
                      type="number"
                      min="0"
                      placeholder="Unknown"
                      value={customMissing}
                      onChange={(e) => setCustomMissing(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="ai-eld" className="block text-[11px] text-slate-400 mb-1">Elderly</label>
                    <input id="ai-eld" type="number" min="0" value={customElderly} onChange={(e) => setCustomElderly(e.target.value)} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" />
                  </div>
                  <div>
                    <label htmlFor="ai-chi" className="block text-[11px] text-slate-400 mb-1">Children</label>
                    <input id="ai-chi" type="number" min="0" value={customChildren} onChange={(e) => setCustomChildren(e.target.value)} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" />
                  </div>
                  <div>
                    <label htmlFor="ai-prg" className="block text-[11px] text-slate-400 mb-1">Pregnant</label>
                    <input id="ai-prg" type="number" min="0" value={customPregnant} onChange={(e) => setCustomPregnant(e.target.value)} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" />
                  </div>
                  <div>
                    <label htmlFor="ai-dis" className="block text-[11px] text-slate-400 mb-1">Disabled</label>
                    <input id="ai-dis" type="number" min="0" value={customDisabled} onChange={(e) => setCustomDisabled(e.target.value)} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" />
                  </div>
                  <div>
                    <label htmlFor="ai-med" className="block text-[11px] text-slate-400 mb-1">Medical</label>
                    <input id="ai-med" type="number" min="0" value={customMedical} onChange={(e) => setCustomMedical(e.target.value)} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" />
                  </div>
                  <div>
                    <label htmlFor="ai-mob" className="block text-[11px] text-slate-400 mb-1">Mobility</label>
                    <input id="ai-mob" type="number" min="0" value={customMobility} onChange={(e) => setCustomMobility(e.target.value)} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" />
                  </div>
                </div>

                <div>
                  <label htmlFor="ai-res" className="block font-medium text-slate-300 mb-1">Available Resources (Optional)</label>
                  <input
                    id="ai-res"
                    type="text"
                    placeholder="e.g. School hall, 1 boat, first aid kit"
                    value={customResources}
                    onChange={(e) => setCustomResources(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label htmlFor="ai-desc" className="block font-medium text-slate-300 mb-1">Incident Description *</label>
                  <textarea
                    id="ai-desc"
                    rows={3}
                    placeholder="Describe current conditions and assistance required..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleRunTriage}
              disabled={isLoading}
              className={`w-full py-3 px-4 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${
                isLoading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-500 text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-teal-200" />
              <span>{isLoading ? 'Running Incident Analysis...' : 'Analyze Incident'}</span>
            </button>

            {errorMessage && (
              <div role="alert" className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Model Info */}
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 text-xs space-y-1.5 text-slate-400">
            <div className="flex items-center justify-between text-slate-200 font-semibold">
              <span>Configured AI Model</span>
              <span className="font-mono text-teal-400 text-[11px]">gemini-4-hydrogen</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Calls the server-side Gemini endpoint (`/api/ai/analyze-incident`). If Gemini credentials are absent or the
              API fails, an explicit rule-based fallback is used and clearly labelled.
            </p>
          </div>
        </div>

        {/* Right Column: Structured Triage Dossier */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-slate-800 rounded-xl p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 text-center space-y-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
                <Cpu className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">Analyzing Incident Report...</div>
                <div className="text-xs text-slate-400">Generating urgency assessment, safety steps, and missing information checks</div>
              </div>
            </div>
          ) : activeResult ? (
            <div className="space-y-5">
              {/* Explicit Fallback vs Live AI Notice */}
              {activeResult.isSimulatedAI ? (
                <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-1">
                  <div className="font-bold text-amber-300">
                    Rule-Based Fallback Result (Not AI-Generated)
                  </div>
                  <p className="text-[11px] text-amber-200/90">
                    {activeResult.fallbackReason ||
                      'Live Gemini AI service was unavailable; deterministic triage rules were applied.'}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-200 text-xs flex items-center justify-between gap-2">
                  <span>
                    Generated by <strong>Gemini AI ({activeResult.modelUsed || 'gemini-4-hydrogen'})</strong> · Experimental decision support
                  </span>
                </div>
              )}

              {/* Dossier Header */}
              <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                        activeResult.urgencyLevel === 'P1_CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {activeResult.urgencyLevel.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Analyzed: {new Date(activeResult.analyzedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className={`text-xs font-mono ${activeResult.isSimulatedAI ? 'text-amber-300' : 'text-teal-400'}`}>
                      {activeResult.isSimulatedAI ? 'Rule-Based Fallback' : activeResult.modelUsed || 'gemini-4-hydrogen'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {activeResult.categorizedHazard}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={copySOP}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Briefing' : 'Copy Briefing'}</span>
                </button>
              </div>

              {/* 1. Incident Summary */}
              <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  1. Incident Summary
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">{activeResult.summary}</p>
              </div>

              {/* 2 & 3. Suggested Urgency & Rationale */}
              <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  2. Urgency Classification Reason ({activeResult.urgencyLevel.replace('_', ' ')})
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">{activeResult.priorityRationale}</p>
              </div>

              {/* 4. Immediate Safety Recommendations */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>3. Immediate Safety Recommendations</span>
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {activeResult.safetyChecklist.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-[#121B30]/60 p-2.5 rounded border border-slate-800/80">
                      <span className="text-amber-400 shrink-0 font-bold">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. Suggested Response Priorities */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  <span>4. Suggested Response Priorities</span>
                </span>
                <div className="space-y-2">
                  {activeResult.immediateActions.map((action, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#121B30] border border-slate-800 rounded-lg text-xs text-slate-200 flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded bg-teal-500/20 text-teal-300 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Vulnerable Population Considerations */}
              <div className="bg-[#121B30] border border-cyan-500/30 rounded-lg p-4 space-y-1">
                <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-cyan-400" />
                  <span>5. Vulnerable Population Considerations</span>
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">{activeResult.vulnerabilityImpact}</p>
              </div>

              {/* 7. Information Still Required from Reporter */}
              <div className="bg-[#121B30] border border-slate-700 rounded-lg p-4 space-y-2">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-sky-400" />
                  <span>6. Information Still Required from Reporter</span>
                </span>
                <ul className="space-y-1 text-xs text-slate-300">
                  {(activeResult.missingInformation && activeResult.missingInformation.length > 0
                    ? activeResult.missingInformation
                    : ['Confirm current road access and communication status.']
                  ).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-sky-400 font-bold">?</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <Cpu className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">No Analysis Generated Yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select an incident or enter custom field details on the left and click &quot;Analyze Incident&quot;.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
