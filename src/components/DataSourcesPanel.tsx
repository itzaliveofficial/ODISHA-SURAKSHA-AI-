/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { DataSourceStatusEntry, ProviderHealthStatus } from '../types/disaster';
import { fetchDataSourceStatuses } from '../services/liveDataService';
import {
  Database,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  KeyRound,
} from 'lucide-react';

function getStatusBadge(status: ProviderHealthStatus): {
  cls: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'CONNECTED':
      return {
        cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      };
    case 'STALE DATA':
      return {
        cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
        icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      };
    case 'NOT CONFIGURED':
      return {
        cls: 'bg-slate-800 text-slate-300 border-slate-700',
        icon: <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
      };
    case 'INVALID RESPONSE':
      return {
        cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />,
      };
    case 'TEMPORARILY UNAVAILABLE':
    default:
      return {
        cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      };
  }
}

export const DataSourcesPanel: React.FC = () => {
  const [sources, setSources] = useState<DataSourceStatusEntry[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const loadStatuses = useCallback(async (probe = false) => {
    if (probe) {
      setIsProbing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg('');
    try {
      const data = await fetchDataSourceStatuses(probe);
      setSources(data.sources);
      setCheckedAt(data.checkedAt);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to fetch provider connectivity status.'
      );
    } finally {
      setIsLoading(false);
      setIsProbing(false);
    }
  }, []);

  useEffect(() => {
    // Trigger initial live probe once so statuses reflect real requests, not idle assumptions
    loadStatuses(true);
  }, [loadStatuses]);

  const connectedCount = sources.filter((s) => s.status === 'CONNECTED').length;
  const notConfiguredCount = sources.filter((s) => s.status === 'NOT CONFIGURED').length;
  const unavailableCount = sources.filter(
    (s) => s.status === 'TEMPORARILY UNAVAILABLE' || s.status === 'INVALID RESPONSE'
  ).length;
  const staleCount = sources.filter((s) => s.status === 'STALE DATA').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-teal-400 font-semibold uppercase tracking-wider">
            <Database className="w-4 h-4 text-teal-400" />
            <span>External Data Provenance &amp; Integration Registry</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Data Sources &amp; Live Connectivity Audit
          </h1>
          <p className="text-xs text-slate-300">
            Every external API provider is tested cleanly on the server. Providers only display{' '}
            <strong className="text-emerald-300">CONNECTED</strong> after completing a validated
            real request; missing credentials or blocked official feeds are never disguised.
          </p>
          {checkedAt && (
            <div className="text-[11px] font-mono text-slate-400">
              Last live probe:{' '}
              {new Date(checkedAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}{' '}
              IST
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => loadStatuses(true)}
          disabled={isLoading || isProbing}
          className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shrink-0 self-start md:self-center whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
          <span>{isProbing ? 'Probing Providers...' : 'Test All Connections'}</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Connected &amp; Verified</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-300 mt-1">
            {connectedCount}
          </div>
        </div>
        <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Not Configured / Restricted</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-200 mt-1">
            {notConfiguredCount}
          </div>
        </div>
        <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Stale Cached Fallback</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1">
            {staleCount}
          </div>
        </div>
        <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Unavailable / Invalid</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-300 mt-1">
            {unavailableCount}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Providers Table */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl overflow-hidden">
        {isLoading && sources.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 animate-pulse">
            Running live diagnostics across disaster, weather, and AQI providers...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Provider &amp; Notes</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Classification</th>
                  <th className="py-3 px-4 font-semibold">Connection Status</th>
                  <th className="py-3 px-4 font-semibold">API Key / Config</th>
                  <th className="py-3 px-4 font-semibold">Last Retrieval / Error</th>
                  <th className="py-3 px-4 font-semibold text-right">Source Site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sources.map((src) => {
                  const badge = getStatusBadge(src.status);
                  return (
                    <tr key={src.id} className="hover:bg-slate-800/30 align-top">
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-white">{src.name}</div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {src.notes}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{src.categoryLabel}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                            src.classification === 'official'
                              ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                              : src.classification === 'secondary'
                              ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {src.classification.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded border whitespace-nowrap ${badge.cls}`}
                        >
                          {badge.icon}
                          <span>{src.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px]">
                        {src.apiKeyRequired ? (
                          <div>
                            <div className="font-mono text-slate-300">
                              {src.envVarName || 'API Key'}
                            </div>
                            <div
                              className={
                                src.apiKeyConfigured ? 'text-emerald-300' : 'text-amber-300'
                              }
                            >
                              {src.apiKeyConfigured ? 'Configured on server' : 'Not set in env'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Open public endpoint (No key)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] max-w-xs">
                        {src.lastSuccessfulRetrieval && (
                          <div className="font-mono text-slate-300">
                            OK:{' '}
                            {new Date(src.lastSuccessfulRetrieval).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            IST
                          </div>
                        )}
                        {src.lastError && (
                          <div className="text-rose-300 mt-0.5 break-words">{src.lastError}</div>
                        )}
                        {!src.lastSuccessfulRetrieval && !src.lastError && (
                          <span className="text-slate-500">Not probed yet</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {src.websiteUrl !== 'about:blank' ? (
                          <a
                            href={src.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium"
                          >
                            <span>Portal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-500">Local Dev</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
