/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  AITriageResult,
  DataMode,
  HazardType,
  Incident,
  IncidentStatus,
  IncidentUrgency,
  VulnerableDemographics,
} from '../types/disaster.ts';
import { ODISHA_DISTRICTS } from '../data/odishaDistricts.ts';
import { INITIAL_SIMULATED_INCIDENTS, calculateVulnerabilityScore } from '../data/sampleIncidents.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');

const ALLOWED_HAZARDS: HazardType[] = ['cyclone', 'flood', 'heatwave', 'embankment', 'landslide'];
const ALLOWED_URGENCIES: IncidentUrgency[] = ['P1_CRITICAL', 'P2_HIGH', 'P3_STANDARD'];
const ALLOWED_STATUSES: IncidentStatus[] = [
  'reported',
  'under_review',
  'assistance_required',
  'response_in_progress',
  'resolved',
];

const ALLOWED_IMAGE_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
];
const MAX_IMAGE_DATA_URL_LENGTH = 2_200_000; // ~1.5 MB decoded image

let writeLock: Promise<void> = Promise.resolve();

function withStoreLock<T>(task: () => Promise<T>): Promise<T> {
  const next = writeLock.then(task, task);
  writeLock = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function maskContactForMinimisation(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 4) return 'Provided';
  return `${trimmed.slice(0, Math.min(4, trimmed.length))}••••${trimmed.slice(-2)}`;
}

function normalizeStatus(raw: string | undefined): IncidentStatus {
  if (!raw) return 'reported';
  if (raw === 'triaged') return 'under_review';
  if (raw === 'dispatched' || raw === 'on_scene') return 'response_in_progress';
  if (ALLOWED_STATUSES.includes(raw as IncidentStatus)) return raw as IncidentStatus;
  return 'reported';
}

function normalizeVulnerable(raw?: Partial<VulnerableDemographics>): VulnerableDemographics {
  const clamp = (val: unknown) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 50000) : 0;
  };
  return {
    elderlyCount: clamp(raw?.elderlyCount),
    childrenCount: clamp(raw?.childrenCount),
    disabledCount: clamp(raw?.disabledCount),
    pregnantCount: clamp(raw?.pregnantCount),
    medicalConditionCount: clamp(raw?.medicalConditionCount),
    mobilityAidCount: clamp(raw?.mobilityAidCount),
    livestockCount: clamp(raw?.livestockCount),
  };
}

function normalizeIncidentClassification(inc: Incident): Incident {
  const isUserSubmitted = inc.dataOrigin === 'user_submitted';
  return {
    ...inc,
    recordClassification: isUserSubmitted ? 'user_submitted_report' : 'simulated_incident',
    verificationStatus: isUserSubmitted ? 'unverified_user_report' : 'simulated',
    status: normalizeStatus(inc.status),
    vulnerable: normalizeVulnerable(inc.vulnerable),
  };
}

async function readStore(): Promise<Incident[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(INCIDENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((inc) => normalizeIncidentClassification(inc as Incident));
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.warn('Re-initializing malformed incidents store:', err);
    }
  }

  const seeded = INITIAL_SIMULATED_INCIDENTS.map((inc) => normalizeIncidentClassification({ ...inc }));
  await writeStoreAtomic(seeded);
  return seeded;
}

async function writeStoreAtomic(incidents: Incident[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${INCIDENTS_FILE}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(incidents, null, 2), 'utf8');
  await fs.rename(tempPath, INCIDENTS_FILE);
}

export async function listIncidents(mode: DataMode = 'demonstration'): Promise<{
  incidents: Incident[];
  storageType: string;
  modeNote: string;
  lastUpdated: string;
}> {
  const all = await withStoreLock(() => readStore());
  const filtered =
    mode === 'verified'
      ? all.filter((inc) => inc.dataOrigin === 'user_submitted')
      : all;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    incidents: sorted,
    storageType: 'Local JSON File Persistence (.data/incidents.json) — Development Storage',
    modeNote:
      mode === 'verified'
        ? 'Displays community/user-submitted field reports only (classified as UNVERIFIED USER REPORTS — never equated with official government alerts).'
        : 'Demonstration mode includes simulated training scenarios alongside any user-submitted field reports.',
    lastUpdated: new Date().toISOString(),
  };
}

export interface CreateIncidentInput {
  districtId?: string;
  blockOrLocation?: string;
  landmark?: string;
  hazardType?: string;
  urgency?: string;
  affectedKnown?: boolean;
  peopleAffected?: number | null;
  injuredCount?: number | null;
  missingCount?: number | null;
  hasVulnerablePeople?: boolean;
  vulnerable?: Partial<VulnerableDemographics>;
  availableResources?: string;
  description?: string;
  supportingImageDataUrl?: string;
  reporterName?: string;
  reporterContact?: string;
  clientSubmissionId?: string;
}

export class IncidentValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function createIncidentRecord(input: CreateIncidentInput): Promise<{
  incident: Incident;
  duplicate: boolean;
}> {
  const district = ODISHA_DISTRICTS.find(
    (d) => d.id === input.districtId || d.name.toLowerCase() === String(input.districtId || '').toLowerCase()
  );
  if (!district) {
    throw new IncidentValidationError('Please select a valid Odisha district.');
  }

  const blockOrLocation = typeof input.blockOrLocation === 'string' ? input.blockOrLocation.trim() : '';
  if (blockOrLocation.length < 3 || blockOrLocation.length > 160) {
    throw new IncidentValidationError('Location / Block / GP must be between 3 and 160 characters.');
  }

  const hazardType = ALLOWED_HAZARDS.includes(input.hazardType as HazardType)
    ? (input.hazardType as HazardType)
    : null;
  if (!hazardType) {
    throw new IncidentValidationError('Please select a valid disaster / hazard type.');
  }

  const urgency: IncidentUrgency = ALLOWED_URGENCIES.includes(input.urgency as IncidentUrgency)
    ? (input.urgency as IncidentUrgency)
    : 'P2_HIGH';

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 20 || description.length > 2500) {
    throw new IncidentValidationError('Incident description must be between 20 and 2,500 characters.');
  }

  const affectedKnown = Boolean(input.affectedKnown);
  let peopleAffected: number | null = null;
  if (affectedKnown) {
    const parsedAffected = Number(input.peopleAffected);
    if (!Number.isFinite(parsedAffected) || parsedAffected < 1 || parsedAffected > 500000) {
      throw new IncidentValidationError('Estimated affected people must be at least 1 when marked as known.');
    }
    peopleAffected = Math.floor(parsedAffected);
  }

  const parseOptionalNonNegative = (v: unknown, label: string): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      throw new IncidentValidationError(`${label} must be a non-negative number.`);
    }
    return Math.floor(n);
  };

  const injuredCount = parseOptionalNonNegative(input.injuredCount, 'Injured count');
  const missingCount = parseOptionalNonNegative(input.missingCount, 'Missing persons count');

  const vulnerable = normalizeVulnerable(input.vulnerable);
  const vulnTotal =
    vulnerable.elderlyCount +
    vulnerable.childrenCount +
    vulnerable.disabledCount +
    vulnerable.pregnantCount +
    vulnerable.medicalConditionCount +
    vulnerable.mobilityAidCount;
  const hasVulnerablePeople = Boolean(input.hasVulnerablePeople) || vulnTotal > 0;

  let supportingImageDataUrl: string | undefined;
  if (typeof input.supportingImageDataUrl === 'string' && input.supportingImageDataUrl.trim() !== '') {
    const trimmedImg = input.supportingImageDataUrl.trim();
    const validPrefix = ALLOWED_IMAGE_PREFIXES.some((prefix) => trimmedImg.startsWith(prefix));
    if (!validPrefix) {
      throw new IncidentValidationError('Supporting image must be a valid PNG, JPEG, or WEBP image.');
    }
    if (trimmedImg.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new IncidentValidationError('Supporting image exceeds maximum size of 1.5 MB.');
    }
    supportingImageDataUrl = trimmedImg;
  }

  const clientSubmissionId =
    typeof input.clientSubmissionId === 'string' ? input.clientSubmissionId.trim().slice(0, 80) : undefined;

  return withStoreLock(async () => {
    const incidents = await readStore();

    if (clientSubmissionId) {
      const existingByToken = incidents.find((i) => i.clientSubmissionId === clientSubmissionId);
      if (existingByToken) {
        return { incident: existingByToken, duplicate: true };
      }
    }

    const sixtySecondsAgo = Date.now() - 60_000;
    const nearDuplicate = incidents.find(
      (i) =>
        i.dataOrigin === 'user_submitted' &&
        i.districtId === district.id &&
        i.blockOrLocation.toLowerCase() === blockOrLocation.toLowerCase() &&
        i.description.toLowerCase() === description.toLowerCase() &&
        new Date(i.timestamp).getTime() >= sixtySecondsAgo
    );
    if (nearDuplicate) {
      return { incident: nearDuplicate, duplicate: true };
    }

    const existingCodes = new Set(incidents.map((i) => i.incidentCode));
    let incidentCode = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `ODI-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!existingCodes.has(candidate)) {
        incidentCode = candidate;
        break;
      }
    }
    if (!incidentCode) {
      incidentCode = `ODI-2026-${String(Date.now()).slice(-6)}`;
    }

    const now = new Date().toISOString();
    const cleanReporterName =
      typeof input.reporterName === 'string' && input.reporterName.trim()
        ? input.reporterName.trim().slice(0, 80)
        : undefined;

    const newIncident: Incident = {
      id: `inc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      incidentCode,
      timestamp: now,
      updatedAt: now,
      dataOrigin: 'user_submitted',
      recordClassification: 'user_submitted_report',
      verificationStatus: 'unverified_user_report',
      districtId: district.id,
      districtName: district.name,
      blockOrLocation,
      landmark: typeof input.landmark === 'string' ? input.landmark.trim().slice(0, 180) : '',
      hazardType,
      urgency,
      affectedKnown,
      peopleAffected,
      injuredCount,
      missingCount,
      hasVulnerablePeople,
      vulnerable,
      availableResources:
        typeof input.availableResources === 'string' && input.availableResources.trim()
          ? input.availableResources.trim().slice(0, 300)
          : undefined,
      description,
      supportingImageDataUrl,
      reporterName: cleanReporterName,
      reporterContact: maskContactForMinimisation(input.reporterContact),
      status: 'reported',
      vulnerabilityScore: calculateVulnerabilityScore(
        peopleAffected,
        vulnerable,
        urgency,
        injuredCount,
        missingCount
      ),
      clientSubmissionId,
    };

    const updated = [newIncident, ...incidents];
    await writeStoreAtomic(updated);
    return { incident: newIncident, duplicate: false };
  });
}

export async function updateIncidentRecord(
  id: string,
  patch: {
    status?: string;
    coordinationNote?: string;
    aiTriageResult?: AITriageResult;
  }
): Promise<Incident | null> {
  return withStoreLock(async () => {
    const incidents = await readStore();
    const index = incidents.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const existing = incidents[index];
    const nextStatus = patch.status ? normalizeStatus(patch.status) : existing.status;
    if (patch.status && !ALLOWED_STATUSES.includes(nextStatus)) {
      throw new IncidentValidationError('Invalid coordination status stage.');
    }

    const updated: Incident = {
      ...existing,
      status: nextStatus,
      coordinationNote:
        patch.coordinationNote !== undefined
          ? String(patch.coordinationNote).trim().slice(0, 400)
          : existing.coordinationNote,
      aiTriageResult: patch.aiTriageResult || existing.aiTriageResult,
      updatedAt: new Date().toISOString(),
    };

    incidents[index] = updated;
    await writeStoreAtomic(incidents);
    return updated;
  });
}
