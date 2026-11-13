/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Incident, EmergencyHelpline, VulnerableDemographics } from '../types/disaster.ts';

export function calculateVulnerabilityScore(
  peopleAffected: number | null,
  vulnerable: VulnerableDemographics,
  urgency: Incident['urgency'],
  injuredCount: number | null = null,
  missingCount: number | null = null
): number {
  const urgencyBonus = urgency === 'P1_CRITICAL' ? 100 : urgency === 'P2_HIGH' ? 50 : 15;
  const pregnantScore = (vulnerable.pregnantCount || 0) * 35;
  const medicalScore = (vulnerable.medicalConditionCount || 0) * 30;
  const mobilityScore = (vulnerable.mobilityAidCount || 0) * 28;
  const childrenScore = (vulnerable.childrenCount || 0) * 25;
  const disabledScore = (vulnerable.disabledCount || 0) * 25;
  const elderlyScore = (vulnerable.elderlyCount || 0) * 20;
  const casualtyScore = ((injuredCount || 0) * 18) + ((missingCount || 0) * 30);
  const generalScore = peopleAffected !== null ? Math.min(peopleAffected, 200) * 1.5 : 15;
  return Math.round(
    urgencyBonus +
      pregnantScore +
      medicalScore +
      mobilityScore +
      childrenScore +
      disabledScore +
      elderlyScore +
      casualtyScore +
      generalScore
  );
}

export const INITIAL_SIMULATED_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    incidentCode: 'SIM-2026-0814',
    timestamp: '2026-11-12T07:15:00.000Z',
    dataOrigin: 'simulated_demo',
    recordClassification: 'simulated_incident',
    verificationStatus: 'simulated',
    districtId: 'puri',
    districtName: 'Puri',
    blockOrLocation: 'Astaranga Block, Nuagarh GP (Simulated)',
    landmark: 'Near Devi River estuary canal sluice gate (Demo Scenario)',
    hazardType: 'cyclone',
    urgency: 'P1_CRITICAL',
    affectedKnown: true,
    peopleAffected: 320,
    injuredCount: 2,
    missingCount: 0,
    hasVulnerablePeople: true,
    vulnerable: {
      pregnantCount: 6,
      childrenCount: 78,
      disabledCount: 9,
      elderlyCount: 42,
      medicalConditionCount: 7,
      mobilityAidCount: 11,
      livestockCount: 160,
    },
    availableResources: 'Local school building on elevated ground; backup solar lantern kit (simulated)',
    description:
      '[SIMULATED TRAINING SCENARIO] Tidal surge water reported entering coastal wards of Nuagarh and Sahada during storm exercise. Approach road depth ~1.2m. 6 expectant mothers and 11 mobility-restricted residents require assisted evacuation.',
    reporterName: 'Simulated Panchayat Coordinator',
    status: 'response_in_progress',
    coordinationNote: 'Simulated drill: local block coordination logged; awaiting water-craft staging.',
    vulnerabilityScore: 0,
    aiTriageResult: {
      summary:
        '[SIMULATED EXAMPLE] High-tide coastal inundation scenario in Astaranga affecting ~320 residents, including 6 expectant mothers and 11 mobility-assisted citizens.',
      categorizedHazard: 'Coastal Cyclone Storm Surge & Inundation (Simulated)',
      urgencyLevel: 'P1_CRITICAL',
      priorityRationale:
        'Classified P1 Critical in simulation due to coastal surge depth (1.2m), 6 third-trimester expectant mothers, 78 children, and 11 mobility-restricted individuals.',
      safetyChecklist: [
        'Require flotation vests for all boat/raft passengers and responders',
        'Verify electrical feeder isolation before entering standing water',
        'Mark submerged road edges and open culverts with high-visibility markers',
      ],
      immediateActions: [
        'Prioritize assisted evacuation of expectant mothers and serious medical cases to elevated shelter',
        'Stage dry-roadhead medical transport for obstetric and chronic care continuity',
        'Distribute safe drinking water purification tablets and dry rations at shelter point',
      ],
      vulnerabilityImpact:
        'High clinical risk to 6 expectant mothers, 7 residents with chronic medical needs, and 78 children exposed to contaminated brackish water.',
      missingInformation: [
        'Exact structural condition of nearest designated shelter roof and generator fuel reserve',
        'Confirmation of whether VHF or mobile voice connectivity remains active at GP office',
      ],
      recommendedUnits: [
        {
          unitName: 'Water Rescue Boat Support (Planning Reference)',
          role: 'Waterborne evacuation of isolated wards',
          equipment: ['Inflatable boats', 'Personal flotation devices', 'Waterproof VHF radios'],
        },
        {
          unitName: 'Mobile Medical & Maternal Support (Planning Reference)',
          role: 'Obstetric triage and chronic illness stabilization',
          equipment: ['Obstetric emergency kits', 'ORS & IV fluids', 'Portable oxygen'],
        },
      ],
      evacuationAndShelterNotes:
        'Use elevated concrete school/shelter structures above local flood mark; stage dry rations and separate livestock tether area where feasible.',
      analyzedAt: '2026-11-12T07:18:22.000Z',
      isSimulatedAI: true,
      modelUsed: 'rule-based-fallback',
      fallbackReason: 'Pre-loaded demonstration scenario dossier (not a live emergency alert).',
    },
  },
  {
    id: 'inc-002',
    incidentCode: 'SIM-2026-0815',
    timestamp: '2026-11-12T07:45:00.000Z',
    dataOrigin: 'simulated_demo',
    recordClassification: 'simulated_incident',
    verificationStatus: 'simulated',
    districtId: 'cuttack',
    districtName: 'Cuttack',
    blockOrLocation: 'Banki Block, Subarnapur Village (Simulated)',
    landmark: 'Mahanadi right embankment Km 42.6 (Demo Scenario)',
    hazardType: 'embankment',
    urgency: 'P1_CRITICAL',
    affectedKnown: true,
    peopleAffected: 450,
    injuredCount: 0,
    missingCount: 0,
    hasVulnerablePeople: true,
    vulnerable: {
      pregnantCount: 3,
      childrenCount: 95,
      disabledCount: 14,
      elderlyCount: 68,
      medicalConditionCount: 12,
      mobilityAidCount: 16,
      livestockCount: 310,
    },
    availableResources: 'Village megaphone announcement team; 2 tractor trolleys staged (simulated)',
    description:
      '[SIMULATED TRAINING SCENARIO] Seepage and piping observed on toe of river embankment during high river stage drill. Pre-emptive evacuation advised for settlements within 300m of toe.',
    reporterName: 'Simulated Water Resources Observer',
    status: 'assistance_required',
    coordinationNote: 'Simulated drill: precautionary evacuation messaging initiated for Ward 1-4.',
    vulnerabilityScore: 0,
  },
  {
    id: 'inc-003',
    incidentCode: 'SIM-2026-0816',
    timestamp: '2026-11-12T08:05:00.000Z',
    dataOrigin: 'simulated_demo',
    recordClassification: 'simulated_incident',
    verificationStatus: 'simulated',
    districtId: 'balasore',
    districtName: 'Balasore',
    blockOrLocation: 'Jaleswar Block, Raibania GP (Simulated)',
    landmark: 'Subarnarekha River low causeway bridge (Demo Scenario)',
    hazardType: 'flood',
    urgency: 'P2_HIGH',
    affectedKnown: true,
    peopleAffected: 210,
    injuredCount: 1,
    missingCount: 0,
    hasVulnerablePeople: true,
    vulnerable: {
      pregnantCount: 2,
      childrenCount: 38,
      disabledCount: 4,
      elderlyCount: 29,
      medicalConditionCount: 4,
      mobilityAidCount: 5,
      livestockCount: 85,
    },
    description:
      '[SIMULATED TRAINING SCENARIO] River overtopping low causeway bridge cutting off road link to 4 panchayats. Villagers gathered on elevated primary school roof awaiting boat ferry.',
    reporterName: 'Simulated Civil Defence Volunteer',
    status: 'under_review',
    vulnerabilityScore: 0,
  },
  {
    id: 'inc-004',
    incidentCode: 'SIM-2026-0817',
    timestamp: '2026-11-12T08:20:00.000Z',
    dataOrigin: 'simulated_demo',
    recordClassification: 'simulated_incident',
    verificationStatus: 'simulated',
    districtId: 'malkangiri',
    districtName: 'Malkangiri',
    blockOrLocation: 'Kalimela Block, Manyamkonda Valley (Simulated)',
    landmark: 'Bridge over Potteru stream near MV-79 (Demo Scenario)',
    hazardType: 'flood',
    urgency: 'P1_CRITICAL',
    affectedKnown: true,
    peopleAffected: 180,
    injuredCount: 3,
    missingCount: 1,
    hasVulnerablePeople: true,
    vulnerable: {
      pregnantCount: 4,
      childrenCount: 52,
      disabledCount: 6,
      elderlyCount: 31,
      medicalConditionCount: 8,
      mobilityAidCount: 7,
      livestockCount: 140,
    },
    description:
      '[SIMULATED TRAINING SCENARIO] Flash flood submerged low bridge under 5 feet of fast-moving water. Settlement temporarily isolated; one resident reported missing near stream bank and two pediatric fever cases need medical support.',
    reporterName: 'Simulated Community Health Worker',
    status: 'reported',
    vulnerabilityScore: 0,
  },
  {
    id: 'inc-005',
    incidentCode: 'SIM-2026-0818',
    timestamp: '2026-11-12T08:35:00.000Z',
    dataOrigin: 'simulated_demo',
    recordClassification: 'simulated_incident',
    verificationStatus: 'simulated',
    districtId: 'ganjam',
    districtName: 'Ganjam',
    blockOrLocation: 'Gopalpur Coastal Belt, Aryapalli (Simulated)',
    landmark: 'Fishermen landing jetty near lighthouse (Demo Scenario)',
    hazardType: 'cyclone',
    urgency: 'P2_HIGH',
    affectedKnown: true,
    peopleAffected: 140,
    injuredCount: 0,
    missingCount: 0,
    hasVulnerablePeople: true,
    vulnerable: {
      pregnantCount: 1,
      childrenCount: 22,
      disabledCount: 3,
      elderlyCount: 25,
      medicalConditionCount: 3,
      mobilityAidCount: 4,
      livestockCount: 30,
    },
    description:
      '[SIMULATED TRAINING SCENARIO] High swell waves affecting beach access road. Fishing households relocated to community shelter and requesting clean drinking water and solar lighting.',
    reporterName: 'Simulated Coastal Volunteer',
    status: 'under_review',
    vulnerabilityScore: 0,
  },
  {
    id: 'inc-006',
    incidentCode: 'SIM-2026-0819',
    timestamp: '2026-11-12T08:42:00.000Z',
    dataOrigin: 'simulated_demo',
    recordClassification: 'simulated_incident',
    verificationStatus: 'simulated',
    districtId: 'bolangir',
    districtName: 'Bolangir',
    blockOrLocation: 'Titlagarh Sub-division, Muribahal GP (Simulated)',
    landmark: 'Weekly Haat ground and PHC access road (Demo Scenario)',
    hazardType: 'heatwave',
    urgency: 'P2_HIGH',
    affectedKnown: true,
    peopleAffected: 95,
    injuredCount: 7,
    missingCount: 0,
    hasVulnerablePeople: true,
    vulnerable: {
      pregnantCount: 2,
      childrenCount: 18,
      disabledCount: 5,
      elderlyCount: 38,
      medicalConditionCount: 9,
      mobilityAidCount: 6,
      livestockCount: 60,
    },
    description:
      '[SIMULATED TRAINING SCENARIO] Extreme daytime heat stress scenario with 7 heat-exhaustion cases among outdoor elderly labourers. Shaded ORS hydration kiosk and water tanker replenishment requested.',
    reporterName: 'Simulated PHC Coordinator',
    status: 'assistance_required',
    vulnerabilityScore: 0,
  },
];

// Initialize calculated vulnerability scores
INITIAL_SIMULATED_INCIDENTS.forEach((inc) => {
  inc.vulnerabilityScore = calculateVulnerabilityScore(
    inc.peopleAffected,
    inc.vulnerable,
    inc.urgency,
    inc.injuredCount,
    inc.missingCount
  );
});

export const OFFICIAL_ODISHA_HELPLINES: EmergencyHelpline[] = [
  {
    agency: 'State Emergency Operations Centre (SEOC) Odisha',
    number: '1070',
    coverage: 'Statewide 24x7 Toll-Free',
    description: 'Nodal crisis control room under Special Relief Commissioner (SRC), Government of Odisha.',
    badge: 'State Nodal',
  },
  {
    agency: 'Emergency Response Support System (ERSS)',
    number: '112',
    coverage: 'Statewide Unified Emergency (Police, Fire, Ambulance)',
    description: 'Single unified emergency helpline for police, fire & rescue, and ambulance dispatch across Odisha.',
    badge: 'Unified 112',
  },
  {
    agency: 'Odisha Disaster Rapid Action Force (ODRAF) HQ',
    number: '+91 671 2305451',
    coverage: 'Cuttack HQ / Statewide Battalions',
    description: 'Specialist state search, water rescue, and collapsed structure disaster response command.',
    badge: 'Specialist Rescue',
  },
  {
    agency: 'National Disaster Response Force (NDRF 3rd Bn, Mundali)',
    number: '+91 671 2879710',
    coverage: 'Mundali Base, Cuttack',
    description: '3rd Battalion NDRF for severe cyclones, chemical/radiological hazards, and flood operations.',
    badge: 'National NDRF',
  },
  {
    agency: 'Odisha State Disaster Management Authority (OSDMA)',
    number: '+91 674 2395398',
    coverage: 'Rajiv Bhawan, Bhubaneswar',
    description: 'Preparedness, early warning dissemination, and multipurpose cyclone shelter network management.',
    badge: 'Policy & Shelter',
  },
  {
    agency: 'Odisha Fire & Emergency Services Control',
    number: '101 / +91 674 2561280',
    coverage: 'All 314 Blocks of Odisha',
    description: 'First responders equipped with rescue boats, tree cutters, and emergency pumps.',
    badge: 'Block Level',
  },
  {
    agency: 'National Health Mission Emergency Ambulance',
    number: '108',
    coverage: 'Statewide Medical Response',
    description: 'Advanced and Basic Life Support fleet for rapid clinical transport and maternity evacuation.',
    badge: 'Medical ALS',
  },
  {
    agency: 'Women & Child Helpline Odisha',
    number: '181 / 1098',
    coverage: 'Statewide Care & Rescue',
    description: 'Dedicated support for distressed women, expectant mothers, and stranded children.',
    badge: 'Welfare',
  },
];
