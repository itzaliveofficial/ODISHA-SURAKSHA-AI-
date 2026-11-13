/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataSourceStatusEntry,
  DisasterAlertsResponse,
  OdishaAqiResponse,
} from '../types/disaster';

export async function fetchDataSourceStatuses(probe = false): Promise<{
  checkedAt: string;
  sources: DataSourceStatusEntry[];
}> {
  const url = probe ? '/api/data-sources/status?probe=true' : '/api/data-sources/status';
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load source statuses (${res.status})`);
  }
  return (await res.json()) as { checkedAt: string; sources: DataSourceStatusEntry[] };
}

export async function fetchLiveDisasterAlerts(refresh = false): Promise<DisasterAlertsResponse> {
  const url = refresh ? '/api/disaster/alerts?refresh=true' : '/api/disaster/alerts';
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load live disaster alerts (${res.status})`);
  }
  return (await res.json()) as DisasterAlertsResponse;
}

export async function summarizeVerifiedAlerts(): Promise<{
  summary: string;
  usedGemini: boolean;
  reason?: string;
  alertsSnapshotAt: string;
}> {
  const res = await fetch('/api/disaster/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to summarize verified alerts (${res.status})`);
  }
  return (await res.json()) as {
    summary: string;
    usedGemini: boolean;
    reason?: string;
    alertsSnapshotAt: string;
  };
}

export async function fetchOdishaAqi(refresh = false): Promise<OdishaAqiResponse> {
  const url = refresh ? '/api/aqi/odisha?refresh=true' : '/api/aqi/odisha';
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load Odisha AQI (${res.status})`);
  }
  return (await res.json()) as OdishaAqiResponse;
}

export async function explainAqiStation(stationId: string): Promise<{
  stationId: string;
  explanation: string;
  usedGemini: boolean;
  reason?: string;
}> {
  const res = await fetch('/api/aqi/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to generate AQI explanation (${res.status})`);
  }
  return (await res.json()) as {
    stationId: string;
    explanation: string;
    usedGemini: boolean;
    reason?: string;
  };
}
