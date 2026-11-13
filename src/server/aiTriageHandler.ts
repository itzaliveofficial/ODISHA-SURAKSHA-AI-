/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { AITriageResult, IncidentUrgency, VulnerableDemographics } from '../types/disaster.ts';
import { isPlaceholderOrMissingEnv } from './dataSourceManager.ts';

export const GEMINI_TRIAGE_MODEL = 'gemini-4-hydrogen';

interface AnalyzeRequestBody {
  districtName?: string;
  blockOrLocation?: string;
  landmark?: string;
  hazardType?: string;
  urgency?: IncidentUrgency;
  peopleAffected?: number | null;
  injuredCount?: number | null;
  missingCount?: number | null;
  availableResources?: string;
  vulnerable?: Partial<VulnerableDemographics>;
  description?: string;
}

interface NormalizedAnalyzeBody {
  districtName: string;
  blockOrLocation: string;
  landmark: string;
  hazardType: string;
  urgency: IncidentUrgency;
  peopleAffected: number | null;
  injuredCount: number | null;
  missingCount: number | null;
  availableResources: string;
  vulnerable: VulnerableDemographics;
  description: string;
}

function toOptionalCount(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function toNonNegInt(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function normalizeBody(raw: AnalyzeRequestBody): NormalizedAnalyzeBody {
  const vuln = raw?.vulnerable || {};
  return {
    districtName: raw?.districtName?.trim() || 'Odisha District',
    blockOrLocation: raw?.blockOrLocation?.trim() || 'Location unspecified',
    landmark: raw?.landmark?.trim() || '',
    hazardType: raw?.hazardType?.trim() || 'flood',
    urgency: raw?.urgency || 'P2_HIGH',
    peopleAffected: toOptionalCount(raw?.peopleAffected),
    injuredCount: toOptionalCount(raw?.injuredCount),
    missingCount: toOptionalCount(raw?.missingCount),
    availableResources: raw?.availableResources?.trim() || '',
    vulnerable: {
      pregnantCount: toNonNegInt(vuln.pregnantCount),
      childrenCount: toNonNegInt(vuln.childrenCount),
      disabledCount: toNonNegInt(vuln.disabledCount),
      elderlyCount: toNonNegInt(vuln.elderlyCount),
      medicalConditionCount: toNonNegInt(vuln.medicalConditionCount),
      mobilityAidCount: toNonNegInt(vuln.mobilityAidCount),
      livestockCount: toNonNegInt(vuln.livestockCount),
    },
    description:
      raw?.description?.trim() ||
      'Field hazard event reported requiring tactical triage and safety review.',
  };
}

function extractGeminiErrorReason(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err || 'Unknown AI service error');
  if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate')) {
    return 'Gemini API rate limit or quota reached; displaying rule-based decision-support fallback.';
  }
  if (message.toLowerCase().includes('timeout')) {
    return 'Gemini API request timed out; displaying rule-based decision-support fallback.';
  }
  if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('api key')) {
    return 'Gemini API credentials rejected or missing permissions; displaying rule-based fallback.';
  }
  return 'Gemini AI service temporarily unavailable; displaying rule-based decision-support fallback.';
}

export async function analyzeIncidentWithGemini(rawBody: AnalyzeRequestBody): Promise<AITriageResult> {
  const body = normalizeBody(rawBody || {});
  const apiKey = process.env.GEMINI_API_KEY;

  if (isPlaceholderOrMissingEnv(apiKey)) {
    return generateHeuristicTriage(
      body,
      'GEMINI_API_KEY is not configured in server environment variables; using rule-based fallback.'
    );
  }

  const prompt = `You are a tactical emergency planning assistant for ODISHA SURAKSHA AI (an experimental decision-support prototype for Odisha, India — NOT an official government alert or live dispatch authority).

Analyze this incident report carefully and DO NOT fabricate verified shelter occupancies or live unit availability:

District: ${body.districtName}
Location: ${body.blockOrLocation}${body.landmark ? ` (Landmark: ${body.landmark})` : ''}
Disaster / Hazard Type: ${body.hazardType}
Reporter Initial Urgency Rating: ${body.urgency}
Estimated Affected People: ${body.peopleAffected !== null ? body.peopleAffected : 'Unknown'}
Injured People: ${body.injuredCount !== null ? body.injuredCount : 'Unknown'}
Missing Persons: ${body.missingCount !== null ? body.missingCount : 'Unknown'}
Available Local Resources: ${body.availableResources || 'Not specified'}
Vulnerable People Requiring Assistance:
- Elderly (65+): ${body.vulnerable.elderlyCount}
- Children (<10y): ${body.vulnerable.childrenCount}
- Pregnant Women: ${body.vulnerable.pregnantCount}
- Persons with Disabilities: ${body.vulnerable.disabledCount}
- Serious Medical Conditions: ${body.vulnerable.medicalConditionCount}
- Mobility Assistance Required: ${body.vulnerable.mobilityAidCount}
- Livestock: ${body.vulnerable.livestockCount}

Incident Description:
"${body.description}"

Return ONLY valid JSON matching this exact schema:
{
  "summary": "1-2 sentence concise incident summary based strictly on provided facts",
  "categorizedHazard": "Clear hazard classification",
  "urgencyLevel": "P1_CRITICAL" or "P2_HIGH" or "P3_STANDARD",
  "priorityRationale": "Clear reason for the urgency classification citing vulnerability, casualties, or unknown data gaps",
  "safetyChecklist": ["3-4 immediate safety recommendations for citizens and first responders"],
  "immediateActions": ["3-5 suggested response priorities (advisory planning steps, not claiming automatic dispatch)"],
  "vulnerabilityImpact": "Specific considerations for elderly, children, pregnant women, disabled, medical conditions, and mobility-assisted individuals",
  "missingInformation": ["2-4 concrete questions / critical details still required from the reporter to verify conditions"],
  "recommendedUnits": [
    {
      "unitName": "Capability type (e.g. Water Rescue Boat Support, Medical ALS Ambulance, Local Civil Administration)",
      "role": "Suggested support role",
      "equipment": ["Suggested equipment items"]
    }
  ],
  "evacuationAndShelterNotes": "Advisory shelter and evacuation considerations without inventing live shelter capacities or official alerts"
}`;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini request timeout after 15000ms')), 15000)
    );

    const response = await Promise.race([
      ai.models.generateContent({
        model: GEMINI_TRIAGE_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are an experimental disaster-triage decision-support assistant for Odisha. Always ground analysis in the provided fields, explicitly list missing information, never invent live government data, and output pure JSON only.',
          responseMimeType: 'application/json',
        },
      }),
      timeoutPromise,
    ]);

    const responseText = response.text;
    if (!responseText || !responseText.trim()) {
      return generateHeuristicTriage(
        body,
        'Gemini returned an empty response; displaying rule-based decision-support fallback.'
      );
    }

    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    const validUrgency: IncidentUrgency =
      parsed.urgencyLevel === 'P1_CRITICAL' ||
      parsed.urgencyLevel === 'P2_HIGH' ||
      parsed.urgencyLevel === 'P3_STANDARD'
        ? parsed.urgencyLevel
        : body.urgency;

    return {
      summary: parsed.summary || `Incident triage summary generated for ${body.districtName} (${body.blockOrLocation}).`,
      categorizedHazard: parsed.categorizedHazard || `${body.hazardType.toUpperCase()} Incident`,
      urgencyLevel: validUrgency,
      priorityRationale:
        parsed.priorityRationale ||
        'Evaluated from reported hazard severity, casualties, and vulnerable population counts.',
      safetyChecklist:
        Array.isArray(parsed.safetyChecklist) && parsed.safetyChecklist.length > 0
          ? parsed.safetyChecklist
          : [
              'Avoid crossing fast-flowing water or submerged roads on foot or by light vehicle',
              'De-energize flooded electrical circuits before rescue entry',
            ],
      immediateActions:
        Array.isArray(parsed.immediateActions) && parsed.immediateActions.length > 0
          ? parsed.immediateActions
          : [
              'Contact District Emergency Operations Centre (1077) or ERSS (112) to verify official response',
              'Prioritize assisted evacuation for mobility-restricted, medical, and maternal cases',
            ],
      vulnerabilityImpact:
        parsed.vulnerabilityImpact ||
        'Assess elderly, children, pregnant women, disabled, and medically fragile individuals for priority transit.',
      missingInformation:
        Array.isArray(parsed.missingInformation) && parsed.missingInformation.length > 0
          ? parsed.missingInformation
          : [
              'Confirm exact road passability and nearest accessible staging point',
              'Verify current communication availability (mobile signal / power backup)',
            ],
      recommendedUnits:
        Array.isArray(parsed.recommendedUnits) && parsed.recommendedUnits.length > 0
          ? parsed.recommendedUnits
          : [
              {
                unitName: 'Trained Water / Structural Rescue Capability',
                role: 'Assisted evacuation and reconnaissance',
                equipment: ['Flotation gear', 'Emergency lighting', 'VHF communications'],
              },
            ],
      evacuationAndShelterNotes:
        parsed.evacuationAndShelterNotes ||
        'Verify availability and structural safety of nearest elevated shelter through district authorities.',
      analyzedAt: new Date().toISOString(),
      isSimulatedAI: false,
      modelUsed: GEMINI_TRIAGE_MODEL,
    };
  } catch (err) {
    console.warn('Gemini AI analysis failed, returning rule-based fallback:', err);
    return generateHeuristicTriage(body, extractGeminiErrorReason(err));
  }
}

function generateHeuristicTriage(
  body: NormalizedAnalyzeBody,
  fallbackReason: string
): AITriageResult {
  const hasUrgentVulnerability =
    body.vulnerable.pregnantCount > 0 ||
    body.vulnerable.medicalConditionCount > 0 ||
    body.vulnerable.mobilityAidCount > 0 ||
    body.vulnerable.disabledCount > 2 ||
    body.vulnerable.childrenCount > 15 ||
    body.vulnerable.elderlyCount > 15;

  const hasCasualties = (body.injuredCount || 0) > 0 || (body.missingCount || 0) > 0;

  const calculatedUrgency: IncidentUrgency =
    hasUrgentVulnerability ||
    hasCasualties ||
    (body.peopleAffected !== null && body.peopleAffected > 200) ||
    body.urgency === 'P1_CRITICAL'
      ? 'P1_CRITICAL'
      : (body.peopleAffected !== null && body.peopleAffected > 40) || body.urgency === 'P2_HIGH'
      ? 'P2_HIGH'
      : 'P3_STANDARD';

  const hazardDescriptions: Record<string, string> = {
    cyclone: 'Coastal Cyclonic Storm & Wind/Surge Hazard',
    flood: 'Riverine / Flash Flood Inundation Hazard',
    embankment: 'Embankment Seepage / Structural Breach Risk',
    heatwave: 'Severe Heatwave & Thermal Stress Cluster',
    landslide: 'Slope Instability / Ghat Road Landslide Hazard',
  };

  const missingInformation: string[] = [];
  if (body.peopleAffected === null) {
    missingInformation.push('Confirm approximate total number of affected residents at the site.');
  }
  if (body.injuredCount === null || body.missingCount === null) {
    missingInformation.push('Verify whether any individuals are injured or unaccounted for.');
  }
  if (!body.landmark) {
    missingInformation.push('Obtain nearest clear landmark or GPS coordinates for safe route planning.');
  }
  if (!body.availableResources) {
    missingInformation.push('Confirm locally available shelter buildings, boats, drinking water, or first-aid supplies.');
  }
  if (missingInformation.length < 2) {
    missingInformation.push('Confirm current road accessibility and mobile/power availability at the location.');
  }

  const vulnHighlights: string[] = [];
  if (body.vulnerable.pregnantCount > 0) {
    vulnHighlights.push(`${body.vulnerable.pregnantCount} pregnant woman/women needing prioritized clinical transit`);
  }
  if (body.vulnerable.medicalConditionCount > 0) {
    vulnHighlights.push(`${body.vulnerable.medicalConditionCount} person(s) with serious medical conditions needing continuity of care`);
  }
  if (body.vulnerable.mobilityAidCount > 0) {
    vulnHighlights.push(`${body.vulnerable.mobilityAidCount} person(s) requiring mobility assistance / stretchers`);
  }
  if (body.vulnerable.disabledCount > 0) {
    vulnHighlights.push(`${body.vulnerable.disabledCount} person(s) with disabilities requiring accessible evacuation`);
  }
  if (body.vulnerable.childrenCount > 0) {
    vulnHighlights.push(`${body.vulnerable.childrenCount} child(ren) under 10 vulnerable to hypothermia or waterborne illness`);
  }
  if (body.vulnerable.elderlyCount > 0) {
    vulnHighlights.push(`${body.vulnerable.elderlyCount} elderly resident(s) requiring supported relocation`);
  }

  const vulnerabilityImpact =
    vulnHighlights.length > 0
      ? `Rule-based vulnerability assessment flags: ${vulnHighlights.join('; ')}.`
      : 'No specific vulnerable group counts reported yet; verify during follow-up call whether elderly, children, pregnant, disabled, or medically fragile residents are present.';

  const safetyChecklist: string[] = [
    'Use certified personal flotation devices around floodwaters and never enter fast currents exceeding ankle-to-knee depth.',
    'Confirm local electrical supply isolation before entering waterlogged structures or touching metal poles.',
    'Maintain safe distance from unstable river embankments, eroded road shoulders, or loose hillside debris.',
  ];

  const immediateActions: string[] = [
    `Escalate verified field details to ${body.districtName} District EOC / SEOC (1070) or ERSS (112) if immediate life-safety rescue is needed.`,
    'Prioritize assisted movement for expectant mothers, medically fragile individuals, mobility-restricted persons, children, and elderly residents.',
    'Stage clean drinking water, ORS packets, and basic first-aid supplies at the nearest dry, structurally sound community shelter.',
    `Cross-check local resources (${body.availableResources || 'none reported yet'}) and verify road passability with local block officials.`,
  ];

  const affectedLabel =
    body.peopleAffected !== null ? `${body.peopleAffected} estimated affected person(s)` : 'an unconfirmed number of people';

  return {
    summary: `[RULE-BASED FALLBACK] ${hazardDescriptions[body.hazardType] || body.hazardType} reported in ${body.districtName} (${body.blockOrLocation}) involving ${affectedLabel}.`,
    categorizedHazard: hazardDescriptions[body.hazardType] || `${body.hazardType.toUpperCase()} Incident`,
    urgencyLevel: calculatedUrgency,
    priorityRationale: `Assigned ${calculatedUrgency} by deterministic rules based on reported hazard (${body.hazardType}), ${
      hasCasualties ? 'reported injuries/missing persons, ' : ''
    }${vulnHighlights.length > 0 ? 'presence of high-priority vulnerable groups, ' : ''}and ${affectedLabel}.`,
    safetyChecklist,
    immediateActions,
    vulnerabilityImpact,
    missingInformation,
    recommendedUnits: [
      {
        unitName: 'Search & Evacuation Support (Advisory Capability)',
        role: 'Safe movement of stranded or mobility-assisted residents',
        equipment: ['Life jackets / throw lines', 'Folding stretchers', 'Waterproof lights'],
      },
      {
        unitName: 'Emergency Medical & Hydration Support (Advisory Capability)',
        role: 'Injury stabilization, maternal triage, and ORS / chronic care',
        equipment: ['First-aid trauma kits', 'ORS & clean water supplies', 'Basic oxygen & vitals kit'],
      },
    ],
    evacuationAndShelterNotes:
      'Official shelter availability is not connected in this prototype. Verify nearest safe high-ground shelter capacity through district authorities before directing evacuees.',
    analyzedAt: new Date().toISOString(),
    isSimulatedAI: true,
    modelUsed: 'rule-based-fallback',
    fallbackReason,
  };
}
