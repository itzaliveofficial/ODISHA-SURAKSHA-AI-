/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AITriageResult,
  DataMode,
  Incident,
  IncidentStatus,
  VulnerableDemographics,
} from '../types/disaster';

export interface CreateIncidentPayload {
  districtId: string;
  blockOrLocation: string;
  landmark?: string;
  hazardType: string;
  urgency: string;
  affectedKnown: boolean;
  peopleAffected: number | null;
  injuredCount: number | null;
  missingCount: number | null;
  hasVulnerablePeople: boolean;
  vulnerable: VulnerableDemographics;
  availableResources?: string;
  description: string;
  supportingImageDataUrl?: string;
  reporterName?: string;
  reporterContact?: string;
  clientSubmissionId: string;
}

export async function fetchIncidents(mode: DataMode): Promise<{
  incidents: Incident[];
  storageType: string;
  lastUpdated: string;
}> {
  const response = await fetch(`/api/incidents?mode=${encodeURIComponent(mode)}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load incidents (HTTP ${response.status})`);
  }
  return response.json();
}

export async function submitIncidentReport(payload: CreateIncidentPayload): Promise<{
  incident: Incident;
  duplicate: boolean;
}> {
  const response = await fetch('/api/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to submit incident (HTTP ${response.status})`);
  }
  return response.json();
}

export async function patchIncident(
  id: string,
  patch: {
    status?: IncidentStatus;
    coordinationNote?: string;
    aiTriageResult?: AITriageResult;
  }
): Promise<Incident> {
  const response = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update incident (HTTP ${response.status})`);
  }
  const data = await response.json();
  return data.incident;
}
