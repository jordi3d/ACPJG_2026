import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { mergeDatasets, normalizeGoogleSheetUrl, SeasonConfig, SeasonDataset } from './src/lib/golfData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const CONFIG_FILE = path.join(DATA_DIR, 'season-config.json');
const DEFAULT_RESULTS_FILE = path.resolve(__dirname, 'public/assets/aistudio/Resultats2026_440a6ed3');
const DEFAULT_OM_FILE = path.resolve(__dirname, 'public/assets/aistudio/Ordre_de_M_rit_2026_dbed36cd');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialConfig(): SeasonConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        season: String(parsed.season || '2026'),
        sourceMode: parsed.sourceMode === 'live-sheets' ? 'live-sheets' : 'default-2026',
        resultsSheetUrl: String(parsed.resultsSheetUrl || ''),
        omSheetUrl: String(parsed.omSheetUrl || ''),
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      };
    } catch {
      // Fallback below
    }
  }

  const envResults = process.env.RESULTS_SHEET_URL || '';
  const envOm = process.env.OM_SHEET_URL || '';
  const envSeason = process.env.SEASON_YEAR || '2026';

  return {
    season: envSeason,
    sourceMode: envResults && envOm ? 'live-sheets' : 'default-2026',
    resultsSheetUrl: envResults,
    omSheetUrl: envOm,
    updatedAt: new Date().toISOString(),
  };
}

function saveConfig(config: SeasonConfig) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

async function fetchSheetCsv(url: string): Promise<string> {
  const csvUrl = normalizeGoogleSheetUrl(url);
  if (!csvUrl) {
    throw new Error('URL de Google Sheets buida.');
  }
  const response = await fetch(csvUrl, {
    headers: {
      'User-Agent': 'ACPJG-PeriodistesGolf/1.0',
      Accept: 'text/csv,text/plain,*/*',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`No s’ha pogut accedir al full de Google (${response.status}). Assegura’t que l’enllaç és públic ("Qualsevol usuari amb l’enllaç").`);
  }

  const text = await response.text();
  if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
    throw new Error('L’enllaç retorna una pàgina HTML en lloc de CSV. Publica el full al web o comparteix-lo com a públic.');
  }
  return text;
}

async function loadDataset(config: SeasonConfig): Promise<SeasonDataset> {
  if (config.sourceMode === 'live-sheets' && config.resultsSheetUrl && config.omSheetUrl) {
    const [resultsCsv, omCsv] = await Promise.all([
      fetchSheetCsv(config.resultsSheetUrl),
      fetchSheetCsv(config.omSheetUrl),
    ]);
    return mergeDatasets(resultsCsv, omCsv, config.season, 'live-sheets');
  }

  const resultsCsv = fs.readFileSync(DEFAULT_RESULTS_FILE, 'utf8');
  const omCsv = fs.readFileSync(DEFAULT_OM_FILE, 'utf8');
  return mergeDatasets(resultsCsv, omCsv, config.season || '2026', 'default-2026');
}

let cachedDataset: { key: string; timestamp: number; data: SeasonDataset } | null = null;
const CACHE_TTL_MS = 15_000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Serve public assets explicitly in both dev and prod
  app.use('/assets', express.static(path.resolve(__dirname, 'public/assets')));

  app.get('/api/config', (_req, res) => {
    res.json(getInitialConfig());
  });

  app.get('/api/data', async (req, res) => {
    try {
      const config = getInitialConfig();
      const forceRefresh = req.query.refresh === '1';
      const cacheKey = `${config.sourceMode}|${config.season}|${config.resultsSheetUrl}|${config.omSheetUrl}`;

      if (!forceRefresh && cachedDataset && cachedDataset.key === cacheKey && Date.now() - cachedDataset.timestamp < CACHE_TTL_MS) {
        return res.json(cachedDataset.data);
      }

      const dataset = await loadDataset(config);
      cachedDataset = { key: cacheKey, timestamp: Date.now(), data: dataset };
      res.json(dataset);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconegut carregant les dades';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/config', async (req, res) => {
    try {
      const { season, sourceMode, resultsSheetUrl, omSheetUrl } = req.body || {};
      const nextConfig: SeasonConfig = {
        season: String(season || '2026').trim() || '2026',
        sourceMode: sourceMode === 'live-sheets' ? 'live-sheets' : 'default-2026',
        resultsSheetUrl: String(resultsSheetUrl || '').trim(),
        omSheetUrl: String(omSheetUrl || '').trim(),
        updatedAt: new Date().toISOString(),
      };

      if (nextConfig.sourceMode === 'live-sheets') {
        if (!nextConfig.resultsSheetUrl || !nextConfig.omSheetUrl) {
          return res.status(400).json({ error: 'Cal introduir tots dos enllaços públics de Google Sheets (Resultats i Ordre de Mèrit).' });
        }
        // Validate live sheets before saving
        const dataset = await loadDataset(nextConfig);
        if (dataset.players.length === 0) {
          return res.status(400).json({ error: 'Els fulls de Google Sheets no contenen cap jugador vàlid.' });
        }
        cachedDataset = {
          key: `${nextConfig.sourceMode}|${nextConfig.season}|${nextConfig.resultsSheetUrl}|${nextConfig.omSheetUrl}`,
          timestamp: Date.now(),
          data: dataset,
        };
      } else {
        cachedDataset = null;
      }

      saveConfig(nextConfig);
      res.json({ config: nextConfig, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error validant els enllaços';
      res.status(400).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`ACPJG PeriodistesGolf server running on http://localhost:${port}`);
  });
}

startServer();
