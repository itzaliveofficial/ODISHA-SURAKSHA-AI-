/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { OverviewDashboard } from './components/OverviewDashboard';
import { DistrictRiskView } from './components/DistrictRiskView';
import { AqiDashboard } from './components/AqiDashboard';
import { IncidentReporting } from './components/IncidentReporting';
import { AIIncidentAnalysis } from './components/AIIncidentAnalysis';
import { VulnerablePopulationSupport } from './components/VulnerablePopulationSupport';
import { ResponseCentre } from './components/ResponseCentre';
import { DataSourcesPanel } from './components/DataSourcesPanel';
import { HelplineModal } from './components/HelplineModal';

import { ODISHA_DISTRICTS } from './data/odishaDistricts';
import { INITIAL_SIMULATED_INCIDENTS } from './data/sampleIncidents';
import type {
  AITriageResult,
  DataMode,
  DisasterAlertsResponse,
  DistrictRisk,
  Incident,
  IncidentStatus,
  OdishaAqiResponse,
} from './types/disaster';
import { fetchIncidents, patchIncident } from './services/incidentService';
import { fetchLiveDisasterAlerts, fetchOdishaAqi } from './services/liveDataService';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [dataMode, setDataMode] = useState<DataMode>('demonstration');
  const [districts] = useState<DistrictRisk[]>(ODISHA_DISTRICTS);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictRisk>(
    ODISHA_DISTRICTS.find((d) => d.id === 'puri') || ODISHA_DISTRICTS[0]
  );

  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_SIMULATED_INCIDENTS);
  const [storageType, setStorageType] = useState<string>('Local JSON File Persistence (Development)');
  const [incidentsLoading, setIncidentsLoading] = useState<boolean>(true);
  const [incidentsError, setIncidentsError] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    INITIAL_SIMULATED_INCIDENTS[0] || null
  );

  // Live Verified External Feeds State (Disaster Alerts + Odisha AQI)
  const [liveAlerts, setLiveAlerts] = useState<DisasterAlertsResponse | null>(null);
  const [liveAlertsLoading, setLiveAlertsLoading] = useState<boolean>(false);
  const [liveAlertsError, setLiveAlertsError] = useState<string>('');
  const [aqiOverview, setAqiOverview] = useState<OdishaAqiResponse | null>(null);

  const [isHelplineModalOpen, setIsHelplineModalOpen] = useState(false);
  const [reportPrefilledDistrict, setReportPrefilledDistrict] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const loadIncidentsFromServer = useCallback(async (mode: DataMode) => {
    setIncidentsLoading(true);
    setIncidentsError('');
    try {
      const data = await fetchIncidents(mode);
      setIncidents(data.incidents);
      setStorageType(data.storageType);
      setSelectedIncident((prev) => {
        if (prev) {
          const match = data.incidents.find((i) => i.id === prev.id);
          if (match) return match;
        }
        return data.incidents[0] || null;
      });
    } catch (err: unknown) {
      setIncidentsError(
        err instanceof Error ? err.message : 'Unable to load incidents from backend store.'
      );
      if (mode === 'verified') {
        setIncidents([]);
        setSelectedIncident(null);
      }
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  const loadLiveExternalFeeds = useCallback(async (forceRefresh = false) => {
    setLiveAlertsLoading(true);
    setLiveAlertsError('');
    try {
      const [alertsData, aqiData] = await Promise.all([
        fetchLiveDisasterAlerts(forceRefresh),
        fetchOdishaAqi(forceRefresh),
      ]);
      setLiveAlerts(alertsData);
      setAqiOverview(aqiData);
    } catch (err: unknown) {
      setLiveAlertsError(
        err instanceof Error ? err.message : 'Unable to retrieve live external disaster/AQI feeds.'
      );
    } finally {
      setLiveAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidentsFromServer(dataMode);
  }, [dataMode, loadIncidentsFromServer]);

  useEffect(() => {
    loadLiveExternalFeeds(false);
  }, [loadLiveExternalFeeds]);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);

    if (!mapsApiKey) {
      fetch('/api/maps-config')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.apiKey) {
            setMapsApiKey(data.apiKey);
          }
        })
        .catch(() => {
          // Graceful fallback to vector map if config endpoint is unavailable
        });
    }

    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, [mapsApiKey]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSelectDistrict = (district: DistrictRisk) => {
    setSelectedDistrict(district);
  };

  const handleNavigateToReportFromDistrict = (districtName: string) => {
    setReportPrefilledDistrict(districtName);
    setActiveTab('report');
  };

  const handleIncidentPersisted = (savedIncident: Incident, triggerAITriageImmediately: boolean) => {
    setIncidents((prev) => {
      const exists = prev.some((i) => i.id === savedIncident.id);
      return exists ? prev.map((i) => (i.id === savedIncident.id ? savedIncident : i)) : [savedIncident, ...prev];
    });
    setSelectedIncident(savedIncident);
    showToast(`Incident ${savedIncident.incidentCode} saved to persistence store`);

    if (triggerAITriageImmediately) {
      setActiveTab('ai-triage');
    }
  };

  const handleSelectIncidentForTriage = (incident: Incident) => {
    setSelectedIncident(incident);
    setActiveTab('ai-triage');
  };

  const handleSaveTriageResult = async (incidentId: string, result: AITriageResult) => {
    const target = incidents.find((i) => i.id === incidentId);
    const nextStatus: IncidentStatus =
      target && target.status === 'reported' ? 'under_review' : target?.status || 'under_review';

    try {
      const updated = await patchIncident(incidentId, {
        status: nextStatus,
        aiTriageResult: result,
      });
      setIncidents((prev) => prev.map((inc) => (inc.id === incidentId ? updated : inc)));
      setSelectedIncident((prev) => (prev?.id === incidentId ? updated : prev));
      showToast(`Analysis saved for ${updated.incidentCode}`);
    } catch {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === incidentId ? { ...inc, status: nextStatus, aiTriageResult: result } : inc
        )
      );
      showToast(`Analysis saved locally for ${target?.incidentCode || incidentId}`);
    }
  };

  const handleUpdateIncidentStatus = async (
    incidentId: string,
    newStatus: IncidentStatus,
    coordinationNote?: string
  ) => {
    const target = incidents.find((i) => i.id === incidentId);
    try {
      const updated = await patchIncident(incidentId, {
        status: newStatus,
        coordinationNote,
      });
      setIncidents((prev) => prev.map((inc) => (inc.id === incidentId ? updated : inc)));
      setSelectedIncident((prev) => (prev?.id === incidentId ? updated : prev));
      showToast(`Status updated: ${updated.incidentCode} → ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : `Failed to persist update for ${target?.incidentCode || incidentId}`);
    }
  };

  const criticalIncidentCount = incidents.filter(
    (i) => i.urgency === 'P1_CRITICAL' && i.status !== 'resolved'
  ).length;

  return (
    <div className="min-h-screen bg-[#080C15] text-slate-100 flex flex-col font-sans">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navigation & Data Mode Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenHelplineModal={() => setIsHelplineModalOpen(true)}
        criticalIncidentCount={criticalIncidentCount}
        dataMode={dataMode}
        onDataModeChange={setDataMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {incidentsError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Incident storage sync error: {incidentsError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadIncidentsFromServer(dataMode)}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {activeTab === 'overview' && (
          <OverviewDashboard
            districts={districts}
            incidents={incidents}
            dataMode={dataMode}
            storageType={storageType}
            liveAlerts={liveAlerts}
            liveAlertsLoading={liveAlertsLoading}
            liveAlertsError={liveAlertsError}
            aqiOverview={aqiOverview}
            onRefreshLiveFeeds={() => loadLiveExternalFeeds(true)}
            onNavigate={setActiveTab}
            onSelectDistrict={handleSelectDistrict}
            onSelectIncidentForTriage={handleSelectIncidentForTriage}
          />
        )}

        {activeTab === 'districts' && (
          <DistrictRiskView
            districts={districts}
            incidents={incidents}
            dataMode={dataMode}
            selectedDistrict={selectedDistrict}
            liveAlerts={liveAlerts}
            aqiOverview={aqiOverview}
            onSelectDistrict={handleSelectDistrict}
            onNavigateToReport={handleNavigateToReportFromDistrict}
            onSelectIncidentForTriage={handleSelectIncidentForTriage}
            onNavigateToTab={setActiveTab}
            mapsApiKey={mapsApiKey}
            quotaExceeded={quotaExceeded}
          />
        )}

        {activeTab === 'aqi' && <AqiDashboard />}

        {activeTab === 'report' && (
          <IncidentReporting
            districts={districts}
            initialDistrictName={reportPrefilledDistrict}
            onSubmitIncident={handleIncidentPersisted}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'ai-triage' && (
          <AIIncidentAnalysis
            incidents={incidents}
            districts={districts}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onSaveTriageResult={handleSaveTriageResult}
          />
        )}

        {activeTab === 'vulnerable' && (
          <VulnerablePopulationSupport
            incidents={incidents}
            dataMode={dataMode}
            onNavigateToTab={setActiveTab}
            onSelectIncidentForTriage={handleSelectIncidentForTriage}
            onUpdateIncidentStatus={handleUpdateIncidentStatus}
          />
        )}

        {activeTab === 'response' && (
          <ResponseCentre
            incidents={incidents}
            dataMode={dataMode}
            isLoading={incidentsLoading}
            storageType={storageType}
            onNavigateToTab={setActiveTab}
            onSelectIncidentForTriage={handleSelectIncidentForTriage}
            onUpdateStatus={handleUpdateIncidentStatus}
          />
        )}

        {activeTab === 'sources' && <DataSourcesPanel />}
      </main>

      {/* Official Directory Modal */}
      <HelplineModal
        isOpen={isHelplineModalOpen}
        onClose={() => setIsHelplineModalOpen(false)}
      />

      {/* Floating Operational Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-teal-950/95 border border-teal-500/50 text-teal-200 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 text-xs backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060910] py-6 px-4 sm:px-6 lg:px-8 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-200">ODISHA SURAKSHA AI</span>
              <span className="text-slate-400 ml-2">Environmental &amp; Disaster Intelligence Platform</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
            <span>
              {dataMode === 'demonstration'
                ? 'DEMONSTRATION MODE (SIMULATED)'
                : 'LIVE OFFICIAL / VERIFIED MODE'}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className="text-teal-400 hover:text-teal-300 underline"
            >
              Data Sources &amp; Attribution
            </button>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400 font-medium">Real Emergencies: Dial 112 / 1070</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
