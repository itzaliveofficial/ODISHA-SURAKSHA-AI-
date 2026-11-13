/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AITriageResult, IncidentUrgency, VulnerableDemographics } from '../types/disaster';

export interface IncidentTriageRequest {
  districtName: string;
  blockOrLocation: string;
  landmark?: string;
  hazardType: string;
  urgency: IncidentUrgency;
  peopleAffected: number | null;
  injuredCount?: number | null;
  missingCount?: number | null;
  availableResources?: string;
  vulnerable: Partial<VulnerableDemographics>;
  description: string;
}

export async function requestAITriage(payload: IncidentTriageRequest): Promise<AITriageResult> {
  const response = await fetch('/api/ai/analyze-incident', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI analysis service returned HTTP ${response.status}`);
  }

  return response.json();
}
