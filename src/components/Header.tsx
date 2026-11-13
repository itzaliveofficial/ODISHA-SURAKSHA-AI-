/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, PhoneCall } from 'lucide-react';
import type { DataMode } from '../types/disaster';

export type ActiveTab =
  | 'overview'
  | 'districts'
  | 'aqi'
  | 'report'
  | 'ai-triage'
  | 'vulnerable'
  | 'response'
  | 'sources';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenHelplineModal: () => void;
  criticalIncidentCount: number;
  dataMode: DataMode;
  onDataModeChange: (mode: DataMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenHelplineModal,
  criticalIncidentCount,
  dataMode,
  onDataModeChange,
}) => {
  const navItems: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'districts', label: 'District Risk' },
    { id: 'aqi', label: 'AQI Monitor' },
    { id: 'report', label: 'Report Incident' },
    { id: 'ai-triage', label: 'AI Analysis' },
    { id: 'vulnerable', label: 'Vulnerable Support' },
    { id: 'response', label: 'Response Centre', badge: criticalIncidentCount },
    { id: 'sources', label: 'Data Sources' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#080C15]/95 backdrop-blur border-b border-slate-800">
      {/* Operational Context & Data Mode Bar */}
      <div className="bg-slate-900/95 border-b border-slate-800/80 px-4 py-1.5 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded border ${
                dataMode === 'demonstration'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-teal-500/15 text-teal-300 border-teal-500/40'
              }`}
            >
              {dataMode === 'demonstration' ? 'DEMONSTRATION MODE (SIMULATED DATA)' : 'LIVE OFFICIAL / VERIFIED MODE'}
            </span>
            <span className="text-[11px] text-slate-400">
              {dataMode === 'demonstration'
                ? 'Simulated disaster exercises + separately labelled real contextual weather & AQI · Not official dispatch'
                : 'Official NDMA CAP alerts + secondary regional feeds + weather/AQI telemetry + unverified user reports'}
            </span>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-[#080C15] border border-slate-700 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => onDataModeChange('demonstration')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                dataMode === 'demonstration'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Demonstration Mode
            </button>
            <button
              type="button"
              onClick={() => onDataModeChange('verified')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                dataMode === 'verified'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live Official / Verified Mode
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          className="flex items-center gap-2.5 shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg p-1"
          onClick={() => onTabChange('overview')}
        >
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
              ODISHA SURAKSHA AI
            </span>
            <span className="text-[10px] text-teal-400/90 font-medium tracking-wide whitespace-nowrap">
              ଓଡ଼ିଶା ସୁରକ୍ଷା · Live Intelligence
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden xl:flex items-center gap-1 shrink-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-0.5 text-[10px] px-1.5 rounded font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Helplines */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenHelplineModal}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-lg hover:bg-rose-500/25 transition-colors whitespace-nowrap shrink-0"
          >
            <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
            <span>112 · 1070</span>
          </button>
        </div>
      </div>

      {/* Tablet / Mobile Horizontal Sub-Navigation */}
      <nav aria-label="Mobile navigation" className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-slate-800/60 no-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              activeTab === item.id
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
