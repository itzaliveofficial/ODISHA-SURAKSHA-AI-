/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { DistrictRisk, HazardType, Incident, IncidentUrgency } from '../types/disaster';
import { submitIncidentReport } from '../services/incidentService';
import type { ActiveTab } from './Header';
import {
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FileText,
  HeartHandshake,
  ImagePlus,
  Trash2,
} from 'lucide-react';

interface IncidentReportingProps {
  districts: DistrictRisk[];
  initialDistrictName?: string;
  onSubmitIncident: (incident: Incident, triggerAITriageImmediately: boolean) => void;
  onNavigateToTab: (tab: ActiveTab) => void;
}

function makeSubmissionId(): string {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const IncidentReporting: React.FC<IncidentReportingProps> = ({
  districts,
  initialDistrictName,
  onSubmitIncident,
  onNavigateToTab,
}) => {
  const [districtId, setDistrictId] = useState(
    initialDistrictName
      ? districts.find((d) => d.name.toLowerCase() === initialDistrictName.toLowerCase())?.id || 'puri'
      : 'puri'
  );
  const [blockOrLocation, setBlockOrLocation] = useState('');
  const [landmark, setLandmark] = useState('');
  const [hazardType, setHazardType] = useState<HazardType>('flood');
  const [urgency, setUrgency] = useState<IncidentUrgency>('P2_HIGH');

  const [affectedKnown, setAffectedKnown] = useState<boolean>(true);
  const [peopleAffected, setPeopleAffected] = useState<string>('45');
  const [injuredCount, setInjuredCount] = useState<string>('');
  const [missingCount, setMissingCount] = useState<string>('');

  const [hasVulnerablePeople, setHasVulnerablePeople] = useState<boolean>(true);
  const [elderlyCount, setElderlyCount] = useState<string>('6');
  const [childrenCount, setChildrenCount] = useState<string>('8');
  const [pregnantCount, setPregnantCount] = useState<string>('1');
  const [disabledCount, setDisabledCount] = useState<string>('2');
  const [medicalConditionCount, setMedicalConditionCount] = useState<string>('2');
  const [mobilityAidCount, setMobilityAidCount] = useState<string>('3');
  const [livestockCount, setLivestockCount] = useState<string>('0');

  const [availableResources, setAvailableResources] = useState('');
  const [description, setDescription] = useState('');
  const [supportingImageDataUrl, setSupportingImageDataUrl] = useState<string>('');
  const [supportingImageName, setSupportingImageName] = useState<string>('');

  // Optional reporter identity (data minimization)
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');

  const [clientSubmissionId, setClientSubmissionId] = useState<string>(makeSubmissionId);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState('');
  const [savedConfirmation, setSavedConfirmation] = useState<{
    incident: Incident;
    duplicate: boolean;
  } | null>(null);

  const loadTemplate = (type: 'puri' | 'cuttack' | 'balasore' | 'bolangir') => {
    setSavedConfirmation(null);
    setValidationError('');
    setClientSubmissionId(makeSubmissionId());
    setAffectedKnown(true);
    setHasVulnerablePeople(true);

    if (type === 'puri') {
      setDistrictId('puri');
      setBlockOrLocation('Brahmagiri Block, Krushnaprasad GP');
      setLandmark('Near Chilika lagoon ferry crossing');
      setHazardType('cyclone');
      setUrgency('P1_CRITICAL');
      setPeopleAffected('240');
      setInjuredCount('2');
      setMissingCount('0');
      setPregnantCount('4');
      setChildrenCount('52');
      setDisabledCount('6');
      setElderlyCount('30');
      setMedicalConditionCount('5');
      setMobilityAidCount('8');
      setLivestockCount('60');
      setAvailableResources('Elevated concrete primary school nearby; 2 solar lanterns');
      setDescription(
        'Test training report: Strong cyclonic winds and tidal backwater flooding access road in Krushnaprasad. Main ferry crossing submerged; 4 pregnant women and 8 residents needing mobility support require priority relocation.'
      );
    } else if (type === 'cuttack') {
      setDistrictId('cuttack');
      setBlockOrLocation('Athagarh Block, Narasinghpur');
      setLandmark('River embankment spur near Gopinathpur');
      setHazardType('embankment');
      setUrgency('P1_CRITICAL');
      setPeopleAffected('310');
      setInjuredCount('0');
      setMissingCount('0');
      setPregnantCount('2');
      setChildrenCount('60');
      setDisabledCount('8');
      setElderlyCount('44');
      setMedicalConditionCount('7');
      setMobilityAidCount('10');
      setLivestockCount('120');
      setAvailableResources('Village megaphone team and elevated temple platform');
      setDescription(
        'Test training report: River seepage observed along embankment toe during heavy monsoon discharge. Adjacent settlement road covered with ~0.6m water; elderly and medically fragile residents need early evacuation.'
      );
    } else if (type === 'balasore') {
      setDistrictId('balasore');
      setBlockOrLocation('Bhograi Block, Udaypur Belt');
      setLandmark('Near Subarnarekha coastal canal');
      setHazardType('flood');
      setUrgency('P2_HIGH');
      setPeopleAffected('140');
      setInjuredCount('1');
      setMissingCount('0');
      setPregnantCount('1');
      setChildrenCount('32');
      setDisabledCount('3');
      setElderlyCount('22');
      setMedicalConditionCount('4');
      setMobilityAidCount('4');
      setLivestockCount('45');
      setAvailableResources('Community cyclone shelter building 1.5 km east');
      setDescription(
        'Test training report: Intense rainfall and tidal backwater inundated low-lying homesteads. Handpumps submerged; residents need safe drinking water packets and medical check for elderly.'
      );
    } else {
      setDistrictId('bolangir');
      setBlockOrLocation('Titlagarh Block, Sindhekela GP');
      setLandmark('Weekly market square');
      setHazardType('heatwave');
      setUrgency('P2_HIGH');
      setPeopleAffected('75');
      setInjuredCount('5');
      setMissingCount('0');
      setPregnantCount('1');
      setChildrenCount('12');
      setDisabledCount('3');
      setElderlyCount('28');
      setMedicalConditionCount('9');
      setMobilityAidCount('3');
      setLivestockCount('20');
      setAvailableResources('Shaded Panchayat hall with ceiling fans; limited drinking water');
      setDescription(
        'Test training report: Severe afternoon heat stress affecting outdoor workers and elderly residents near market square. Five exhaustion cases reported; urgent ORS and drinking water tanker support needed.'
      );
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setValidationError('Supporting image must be a PNG, JPEG, or WEBP file.');
      e.target.value = '';
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setValidationError('Supporting image must be 1.5 MB or smaller.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSupportingImageDataUrl(reader.result);
        setSupportingImageName(file.name);
        setValidationError('');
      }
    };
    reader.onerror = () => {
      setValidationError('Unable to read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (triggerAI: boolean) => {
    if (isSubmitting) return;
    setValidationError('');
    setSavedConfirmation(null);

    if (!districtId) {
      setValidationError('Please select a district in Odisha.');
      return;
    }
    if (blockOrLocation.trim().length < 3) {
      setValidationError('Please enter a Block, Gram Panchayat, Ward, or Village (at least 3 characters).');
      return;
    }
    if (description.trim().length < 20) {
      setValidationError('Please provide a clear incident description (at least 20 characters).');
      return;
    }

    let parsedAffected: number | null = null;
    if (affectedKnown) {
      const n = Number(peopleAffected);
      if (!Number.isFinite(n) || n < 1) {
        setValidationError('Estimated affected people must be at least 1, or uncheck "Affected count known".');
        return;
      }
      parsedAffected = Math.floor(n);
    }

    const parseOptionalNum = (val: string): number | null => {
      if (!val.trim()) return null;
      const n = Number(val);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };

    const parsedInjured = parseOptionalNum(injuredCount);
    const parsedMissing = parseOptionalNum(missingCount);

    const vulnNum = (val: string) => {
      if (!hasVulnerablePeople) return 0;
      const n = Number(val);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };

    setIsSubmitting(true);
    try {
      const result = await submitIncidentReport({
        districtId,
        blockOrLocation: blockOrLocation.trim(),
        landmark: landmark.trim(),
        hazardType,
        urgency,
        affectedKnown,
        peopleAffected: parsedAffected,
        injuredCount: parsedInjured,
        missingCount: parsedMissing,
        hasVulnerablePeople,
        vulnerable: {
          elderlyCount: vulnNum(elderlyCount),
          childrenCount: vulnNum(childrenCount),
          pregnantCount: vulnNum(pregnantCount),
          disabledCount: vulnNum(disabledCount),
          medicalConditionCount: vulnNum(medicalConditionCount),
          mobilityAidCount: vulnNum(mobilityAidCount),
          livestockCount: Math.max(0, Math.floor(Number(livestockCount) || 0)),
        },
        availableResources: availableResources.trim() || undefined,
        description: description.trim(),
        supportingImageDataUrl: supportingImageDataUrl || undefined,
        reporterName: reporterName.trim() || undefined,
        reporterContact: reporterContact.trim() || undefined,
        clientSubmissionId,
      });

      setSavedConfirmation(result);
      setClientSubmissionId(makeSubmissionId());
      onSubmitIncident(result.incident, triggerAI);
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : 'Unable to save incident report. Please check your entries and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs text-teal-400 font-semibold uppercase tracking-wider">
          <FileText className="w-4 h-4 text-teal-400" />
          <span>Incident Reporting Intake</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Submit Disaster Incident Report
        </h1>
        <p className="text-xs text-slate-300">
          Reports are validated and saved to local development persistence (.data/incidents.json) with a unique
          reference number. This prototype does NOT trigger official emergency dispatch—dial <strong>112</strong> or{' '}
          <strong>1070</strong> in real emergencies.
        </p>
      </div>

      {/* Confirmation Banner */}
      {savedConfirmation && (
        <div className="bg-teal-500/10 border border-teal-500/40 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-teal-200 text-sm">
                {savedConfirmation.duplicate
                  ? `Duplicate submission prevented — showing saved report ${savedConfirmation.incident.incidentCode}`
                  : `Incident Saved — Reference ${savedConfirmation.incident.incidentCode}`}
              </div>
              <p className="text-slate-300">
                Recorded for <strong>{savedConfirmation.incident.districtName}</strong> (
                {savedConfirmation.incident.blockOrLocation}). You can now review it in the Response Centre,
                Vulnerable Support Queue, or run AI analysis.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-7">
            <button
              type="button"
              onClick={() => onNavigateToTab('response')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded border border-slate-700 font-medium"
            >
              Open Response Centre
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab('ai-triage')}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium"
            >
              Open AI Analysis
            </button>
          </div>
        </div>
      )}

      {/* Demo Templates Strip */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Demo Pre-Fill Templates (SIMULATED DATA)</span>
          </span>
          <span className="text-[11px] text-slate-400">Optional quick test inputs</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => loadTemplate('puri')}
            className="p-2 text-left bg-[#121B30] hover:bg-[#182440] border border-slate-800 rounded-lg text-xs transition-colors"
          >
            <div className="font-semibold text-rose-300">Puri Coastal Test</div>
            <div className="text-[10px] text-slate-400 truncate">Krushnaprasad · Cyclone</div>
          </button>
          <button
            type="button"
            onClick={() => loadTemplate('cuttack')}
            className="p-2 text-left bg-[#121B30] hover:bg-[#182440] border border-slate-800 rounded-lg text-xs transition-colors"
          >
            <div className="font-semibold text-rose-300">Cuttack Levee Test</div>
            <div className="text-[10px] text-slate-400 truncate">Athagarh · Embankment</div>
          </button>
          <button
            type="button"
            onClick={() => loadTemplate('balasore')}
            className="p-2 text-left bg-[#121B30] hover:bg-[#182440] border border-slate-800 rounded-lg text-xs transition-colors"
          >
            <div className="font-semibold text-amber-300">Balasore Flood Test</div>
            <div className="text-[10px] text-slate-400 truncate">Bhograi · River Flood</div>
          </button>
          <button
            type="button"
            onClick={() => loadTemplate('bolangir')}
            className="p-2 text-left bg-[#121B30] hover:bg-[#182440] border border-slate-800 rounded-lg text-xs transition-colors"
          >
            <div className="font-semibold text-amber-300">Bolangir Heat Test</div>
            <div className="text-[10px] text-slate-400 truncate">Titlagarh · Heatwave</div>
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
        className="bg-[#0D1527] border border-slate-800 rounded-xl p-6 space-y-5"
      >
        {validationError && (
          <div role="alert" className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* District & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="inc-district" className="block text-xs font-medium text-slate-300 mb-1.5">
              Odisha District <span className="text-rose-400">*</span>
            </label>
            <select
              id="inc-district"
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.odiaName}) — {d.zone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inc-location" className="block text-xs font-medium text-slate-300 mb-1.5">
              Block / Gram Panchayat / Ward / Village <span className="text-rose-400">*</span>
            </label>
            <input
              id="inc-location"
              type="text"
              required
              placeholder="e.g. Astaranga Block, Nuagarh GP"
              value={blockOrLocation}
              onChange={(e) => setBlockOrLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Landmark & Disaster Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="inc-landmark" className="block text-xs font-medium text-slate-300 mb-1.5">
              Specific Landmark or Access Note (Optional)
            </label>
            <input
              id="inc-landmark"
              type="text"
              placeholder="e.g. Near Devi River sluice gate or Ward 14 primary school"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="inc-hazard" className="block text-xs font-medium text-slate-300 mb-1.5">
              Disaster Type <span className="text-rose-400">*</span>
            </label>
            <select
              id="inc-hazard"
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value as HazardType)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
            >
              <option value="cyclone">Cyclone / Storm Surge</option>
              <option value="flood">Riverine / Flash Flood</option>
              <option value="embankment">Embankment Seepage / Breach</option>
              <option value="heatwave">Severe Heatwave</option>
              <option value="landslide">Landslide / Road Washout</option>
            </select>
          </div>
        </div>

        {/* Urgency & People Affected / Injured / Missing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="block text-xs font-medium text-slate-300 mb-1.5">
              Reporter Urgency Assessment <span className="text-rose-400">*</span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'P1_CRITICAL', label: 'P1 Critical', active: 'bg-rose-500/20 text-rose-300 border-rose-500' },
                  { id: 'P2_HIGH', label: 'P2 High', active: 'bg-amber-500/20 text-amber-300 border-amber-500' },
                  { id: 'P3_STANDARD', label: 'P3 Standard', active: 'bg-teal-500/20 text-teal-300 border-teal-500' },
                ] as const
              ).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUrgency(u.id)}
                  className={`py-2 px-2 text-xs font-bold rounded-lg border transition-colors ${
                    urgency === u.id ? u.active : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="inc-affected" className="text-xs font-medium text-slate-300">
                  Affected
                </label>
                <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affectedKnown}
                    onChange={(e) => setAffectedKnown(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-teal-500"
                  />
                  <span>Known</span>
                </label>
              </div>
              <input
                id="inc-affected"
                type="number"
                min="1"
                disabled={!affectedKnown}
                placeholder={affectedKnown ? 'Count' : 'Unknown'}
                value={affectedKnown ? peopleAffected : ''}
                onChange={(e) => setPeopleAffected(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 disabled:opacity-50 rounded-lg text-white font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label htmlFor="inc-injured" className="block text-xs font-medium text-slate-300 mb-1">
                Injured (Optional)
              </label>
              <input
                id="inc-injured"
                type="number"
                min="0"
                placeholder="Unknown"
                value={injuredCount}
                onChange={(e) => setInjuredCount(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label htmlFor="inc-missing" className="block text-xs font-medium text-slate-300 mb-1">
                Missing (Optional)
              </label>
              <input
                id="inc-missing"
                type="number"
                min="0"
                placeholder="Unknown"
                value={missingCount}
                onChange={(e) => setMissingCount(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Vulnerable Population Breakdown */}
        <div className="bg-[#121B30] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-cyan-400" />
              <span>Vulnerable Population Assistance</span>
            </span>
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={hasVulnerablePeople}
                onChange={(e) => setHasVulnerablePeople(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-teal-500"
              />
              <span>Vulnerable individuals affected / requiring assistance</span>
            </label>
          </div>

          {hasVulnerablePeople && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              <div>
                <label htmlFor="v-elderly" className="block text-[11px] text-slate-300 mb-1">Elderly (65+)</label>
                <input
                  id="v-elderly"
                  type="number"
                  min="0"
                  value={elderlyCount}
                  onChange={(e) => setElderlyCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>
              <div>
                <label htmlFor="v-children" className="block text-[11px] text-slate-300 mb-1">Children (&lt;10y)</label>
                <input
                  id="v-children"
                  type="number"
                  min="0"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-amber-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="v-pregnant" className="block text-[11px] text-slate-300 mb-1">Pregnant Women</label>
                <input
                  id="v-pregnant"
                  type="number"
                  min="0"
                  value={pregnantCount}
                  onChange={(e) => setPregnantCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-rose-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="v-disabled" className="block text-[11px] text-slate-300 mb-1">Disabled</label>
                <input
                  id="v-disabled"
                  type="number"
                  min="0"
                  value={disabledCount}
                  onChange={(e) => setDisabledCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="v-medical" className="block text-[11px] text-slate-300 mb-1">Medical Cond.</label>
                <input
                  id="v-medical"
                  type="number"
                  min="0"
                  value={medicalConditionCount}
                  onChange={(e) => setMedicalConditionCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-rose-200 font-mono"
                />
              </div>
              <div>
                <label htmlFor="v-mobility" className="block text-[11px] text-slate-300 mb-1">Mobility Aid</label>
                <input
                  id="v-mobility"
                  type="number"
                  min="0"
                  value={mobilityAidCount}
                  onChange={(e) => setMobilityAidCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-teal-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="v-livestock" className="block text-[11px] text-slate-300 mb-1">Livestock</label>
                <input
                  id="v-livestock"
                  type="number"
                  min="0"
                  value={livestockCount}
                  onChange={(e) => setLivestockCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Field Description & Available Resources */}
        <div className="space-y-4">
          <div>
            <label htmlFor="inc-desc" className="block text-xs font-medium text-slate-300 mb-1.5">
              Incident Description & Field Conditions <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="inc-desc"
              rows={4}
              required
              placeholder="Describe water depth, road access, power/cell connectivity, immediate hazards, and specific assistance needed (minimum 20 characters)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed"
            />
          </div>

          <div>
            <label htmlFor="inc-resources" className="block text-xs font-medium text-slate-300 mb-1.5">
              Available Local Resources on Site (Optional)
            </label>
            <input
              id="inc-resources"
              type="text"
              placeholder="e.g. Elevated concrete school building, 1 wooden boat, first-aid box"
              value={availableResources}
              onChange={(e) => setAvailableResources(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Optional Supporting Image */}
        <div className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="inc-image" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <ImagePlus className="w-4 h-4 text-teal-400" />
              <span>Optional Supporting Image (PNG / JPEG / WEBP, max 1.5 MB)</span>
            </label>
            {supportingImageDataUrl && (
              <button
                type="button"
                onClick={() => {
                  setSupportingImageDataUrl('');
                  setSupportingImageName('');
                }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove ({supportingImageName})</span>
              </button>
            )}
          </div>
          <input
            id="inc-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-700"
          />
          {supportingImageDataUrl && (
            <img
              src={supportingImageDataUrl}
              alt="Uploaded incident site preview"
              className="mt-2 max-h-40 rounded-lg border border-slate-700 object-contain"
            />
          )}
        </div>

        {/* Optional Reporter Info (Data Minimization) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label htmlFor="inc-reporter" className="block text-xs font-medium text-slate-400 mb-1">
              Reporter Name or Role (Optional)
            </label>
            <input
              id="inc-reporter"
              type="text"
              placeholder="Optional — leave blank for anonymous report"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label htmlFor="inc-contact" className="block text-xs font-medium text-slate-400 mb-1">
              Contact Phone / Callsign (Optional — Masked in Dashboard)
            </label>
            <input
              id="inc-contact"
              type="text"
              placeholder="Optional — masked automatically in summary views"
              value={reporterContact}
              onChange={(e) => setReporterContact(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 text-slate-400" />
            <span>{isSubmitting ? 'Saving Report...' : 'Save Incident Report'}</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-teal-200" />
            <span>{isSubmitting ? 'Saving & Analyzing...' : 'Submit & Run AI Analysis'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
