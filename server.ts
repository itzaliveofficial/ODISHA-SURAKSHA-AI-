/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeIncidentWithGemini, GEMINI_TRIAGE_MODEL } from './src/server/aiTriageHandler.ts';
import { fetchOdishaHubsWeather, fetchWeatherForDistrictLocation } from './src/server/weatherHandler.ts';
import {
  listIncidents,
  createIncidentRecord,
  updateIncidentRecord,
  IncidentValidationError,
} from './src/server/incidentStore.ts';
import { getAllProviderStatuses, isPlaceholderOrMissingEnv } from './src/server/dataSourceManager.ts';
import {
  getLiveDisasterAlerts,
  summarizeVerifiedAlertsWithGemini,
} from './src/server/disasterDataService.ts';
import {
  getOdishaAqiOverview,
  getAqiStationById,
  explainAqiStationWithGemini,
} from './src/server/aqiService.ts';
import { ODISHA_DISTRICTS } from './src/data/odishaDistricts.ts';
import type { DataMode } from './src/types/disaster.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  // Dev server must run on port 3000; avoid colliding with container proxy PORT=8080 in dev.
  const PORT =
    isProd && process.env.PORT && process.env.PORT !== '8080'
      ? Number(process.env.PORT)
      : 3000;

  // Baseline security headers (preserving iframe preview compatibility)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '3mb' }));

  // Malformed JSON payload guard
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Malformed JSON request body.' });
      return;
    }
    next(err);
  });

  // Health & non-secret capability check endpoint
  app.get('/api/health', (_req, res) => {
    const aiConfigured = !isPlaceholderOrMissingEnv(process.env.GEMINI_API_KEY);
    res.json({
      status: 'ok',
      mode: isProd ? 'production' : 'development',
      aiConfigured,
      aiModel: GEMINI_TRIAGE_MODEL,
    });
  });

  // Expose browser-safe Google Maps Platform key from server environment
  app.get('/api/maps-config', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ apiKey });
  });

  // --- Data Sources Status & Live Disaster Feeds ---
  app.get('/api/data-sources/status', async (req, res) => {
    try {
      const probe = req.query.probe === 'true';
      if (probe) {
        await Promise.allSettled([
          fetchOdishaHubsWeather(true),
          getLiveDisasterAlerts(true),
          getOdishaAqiOverview(true),
        ]);
      }
      res.json({
        checkedAt: new Date().toISOString(),
        sources: getAllProviderStatuses(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to check data source statuses';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/disaster/alerts', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const payload = await getLiveDisasterAlerts(forceRefresh);
      res.json(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to retrieve disaster alert feeds';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/disaster/summarize', async (req, res) => {
    try {
      const forceRefresh = req.body?.refresh === true;
      const alertsPayload = await getLiveDisasterAlerts(forceRefresh);
      const result = await summarizeVerifiedAlertsWithGemini(alertsPayload);
      res.json({
        ...result,
        alertsSnapshotAt: alertsPayload.fetchedAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to summarize verified alerts';
      res.status(500).json({ error: message });
    }
  });

  // --- Real Air Quality Index (AQI) Endpoints ---
  app.get('/api/aqi/odisha', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const overview = await getOdishaAqiOverview(forceRefresh);
      res.json(overview);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to retrieve Odisha AQI telemetry';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/aqi/station/:stationId', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const station = await getAqiStationById(req.params.stationId, forceRefresh);
      if (!station) {
        res.status(404).json({ error: 'Monitoring station or city not found in Odisha registry.' });
        return;
      }
      res.json({ station });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve station AQI record';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/aqi/explain', async (req, res) => {
    try {
      const stationId = String(req.body?.stationId || '');
      if (!stationId) {
        res.status(400).json({ error: 'stationId is required.' });
        return;
      }
      const station = await getAqiStationById(stationId, false);
      if (!station) {
        res.status(404).json({ error: 'Monitoring station not found.' });
        return;
      }
      const explanation = await explainAqiStationWithGemini(station);
      res.json({
        stationId: station.stationId,
        ...explanation,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to explain AQI station telemetry';
      res.status(500).json({ error: message });
    }
  });

  // Live meteorological conditions for major Odisha hubs (free API, no key required)
  app.get('/api/weather/odisha-hubs', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await fetchOdishaHubsWeather(forceRefresh);
      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to retrieve live weather telemetry';
      res.status(502).json({ error: message, providerUnavailable: true });
    }
  });

  // Live surface weather for any selected Odisha district headquarters
  app.get('/api/weather/district/:districtId', async (req, res) => {
    try {
      const district = ODISHA_DISTRICTS.find((d) => d.id === req.params.districtId);
      if (!district) {
        res.status(404).json({ error: 'District not found.' });
        return;
      }
      const forceRefresh = req.query.refresh === 'true';
      const weather = await fetchWeatherForDistrictLocation({
        lat: district.lat,
        lng: district.lng,
        districtId: district.id,
        districtName: district.name,
        forceRefresh,
      });
      res.json(weather);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to retrieve live district weather';
      res.status(502).json({ error: message, providerUnavailable: true });
    }
  });

  // Incident persistence routes (Development JSON store)
  app.get('/api/incidents', async (req, res) => {
    try {
      const mode: DataMode = req.query.mode === 'verified' ? 'verified' : 'demonstration';
      const result = await listIncidents(mode);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load incidents';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/incidents', async (req, res) => {
    try {
      const result = await createIncidentRecord(req.body || {});
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (err: unknown) {
      if (err instanceof IncidentValidationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to save incident';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/incidents/:id', async (req, res) => {
    try {
      const updated = await updateIncidentRecord(req.params.id, req.body || {});
      if (!updated) {
        res.status(404).json({ error: 'Incident record not found.' });
        return;
      }
      res.json({ incident: updated });
    } catch (err: unknown) {
      if (err instanceof IncidentValidationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to update incident';
      res.status(500).json({ error: message });
    }
  });

  // API route for Gemini AI incident analysis
  app.post('/api/ai/analyze-incident', async (req, res) => {
    try {
      const result = await analyzeIncidentWithGemini(req.body || {});
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to triage incident';
      res.status(500).json({ error: message });
    }
  });

  // Unhandled /api 404 guard so API mistakes return JSON, not HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ODISHA SURAKSHA AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ODISHA SURAKSHA AI server:', err);
  process.exit(1);
});
