export interface HandicapPoint {
  index: number;
  tournament: string;
  handicap: number;
}

export interface HoleResults {
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  dbogeys: number;
  tbogeysPlus: number;
  ratlles: number;
  forats: number;
}

export interface TournamentPointEntry {
  tournament: string;
  points: number | string | null;
}

export interface OrdreDeMeritData {
  rank: number | null;
  ryder: string;
  points: number;
  tournaments: number;
  first: number;
  second: number;
  third: number;
  top5: number;
  top10: number;
  tournamentPoints: TournamentPointEntry[];
}

export interface MemberPerformance {
  id: string;
  license: string;
  rawName: string;
  displayName: string;
  roundsPlayed: number;
  handicapSeries: HandicapPoint[];
  currentHandicap: number | null;
  holeResults: HoleResults;
  om: OrdreDeMeritData | null;
}

export interface SeasonDataset {
  season: string;
  sourceMode: 'default-2026' | 'live-sheets';
  fetchedAt: string;
  tournaments: string[];
  activeTournamentsCount: number;
  players: MemberPerformance[];
}

export interface SeasonConfig {
  season: string;
  sourceMode: 'default-2026' | 'live-sheets';
  resultsSheetUrl: string;
  omSheetUrl: string;
  updatedAt: string;
}

export function normalizeText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell);
        cell = '';
      } else if (c === '\r' && next === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (c === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function parseDecimal(val: string | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === 'DQ' || upper === 'O' || upper === '-' || upper === 'N/A' || upper === 'ACTUALITZANT') {
    return null;
  }
  const normalized = trimmed.replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function parseIntSafe(val: string | undefined): number {
  const num = parseDecimal(val);
  return num !== null ? Math.round(num) : 0;
}

export function formatCatalanNumber(num: number, decimals?: number): string {
  const value = decimals !== undefined ? num.toFixed(decimals) : String(num);
  return value.replace('.', ',');
}

export function formatDisplayName(rawName: string): string {
  const cleaned = (rawName || '').trim();
  if (!cleaned) return '';

  const commaIdx = cleaned.indexOf(',');
  if (commaIdx !== -1) {
    const surnames = cleaned.slice(0, commaIdx).trim().toUpperCase();
    const firstNamesRaw = cleaned.slice(commaIdx + 1).trim();
    const firstNames = toTitleCase(firstNamesRaw);
    return `${firstNames} ${surnames}`.trim();
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, -1).join(' ').toUpperCase();
    return `${toTitleCase(last)} ${rest}`;
  }

  return toTitleCase(cleaned);
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      if (word === 'de' || word === 'del' || word === 'la' || word === 'i') return word;
      if (word.includes('-')) {
        return word
          .split('-')
          .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ''))
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

interface ParsedResultPlayer {
  license: string;
  rawName: string;
  roundsPlayed: number;
  handicapSeries: HandicapPoint[];
  holeResults: HoleResults;
}

interface ParsedResultsSheet {
  tournaments: string[];
  activeTournamentsCount: number;
  players: ParsedResultPlayer[];
}

export function parseResultsCSV(csvText: string): ParsedResultsSheet {
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    return { tournaments: [], activeTournamentsCount: 0, players: [] };
  }

  let headerIdx = rows.findIndex((row) => {
    const joined = row.map((c) => normalizeText(c)).join('|');
    return (joined.includes('LLICENCIA') || joined.includes('LICENCIA')) && joined.includes('NOM');
  });

  if (headerIdx === -1) {
    headerIdx = rows.findIndex((row) =>
      row.some((c) => normalizeText(c) === 'VOLTES') && row.some((c) => normalizeText(c) === 'EAGLES')
    );
  }

  if (headerIdx === -1) {
    throw new Error('No s’ha trobat la fila de capçalera al fitxer de Resultats (Llicència, Nom, Voltes, Eagles...).');
  }

  const header = rows[headerIdx];
  const normHeader = header.map((h) => normalizeText(h));

  const licenseCol = normHeader.findIndex((h) => h.includes('LLICENCIA') || h.includes('LICENCIA'));
  const nameCol = normHeader.findIndex((h) => h === 'NOM' || h === 'NOMBRE');
  const voltesCol = normHeader.findIndex((h) => h === 'VOLTES' || h === 'VUELTAS' || h === 'ROUNDS');
  const eaglesCol = normHeader.findIndex((h) => h === 'EAGLES');
  const birdiesCol = normHeader.findIndex((h) => h === 'BIRDIES');
  const parsCol = normHeader.findIndex((h) => h === 'PARS');
  const bogeysCol = normHeader.findIndex((h) => h === 'BOGEYS');
  const dbogeysCol = normHeader.findIndex((h) => h === 'DBOGEYS' || h === 'DOBLE BOGEYS');
  const tbogeysCol = normHeader.findIndex((h) => h.startsWith('TBOGEYS'));
  const ratllesCol = normHeader.findIndex((h) => h === 'RATLLES' || h === 'RAYAS');
  const foratsCol = normHeader.findIndex((h) => h === 'FORATS' || h === 'HOYOS');

  const startTournamentCol = (voltesCol !== -1 ? voltesCol : nameCol) + 1;
  const endTournamentCol = eaglesCol !== -1 ? eaglesCol : header.length;

  const tournamentCols: { colIndex: number; name: string }[] = [];
  for (let c = startTournamentCol; c < endTournamentCol; c++) {
    const title = (header[c] || '').replace(/\s+/g, ' ').trim();
    if (title && normalizeText(title) !== 'RESULTATS') {
      tournamentCols.push({ colIndex: c, name: title });
    }
  }

  const activeColFlags = new Set<number>();
  const players: ParsedResultPlayer[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const license = (row[licenseCol] || '').trim();
    const rawName = (row[nameCol] || '').trim();

    if (!rawName || normalizeText(rawName) === 'ACTUALITZANT') continue;
    if (!license && !rawName) continue;

    const handicapSeries: HandicapPoint[] = [];
    let playedIdx = 1;

    for (const tCol of tournamentCols) {
      const hcp = parseDecimal(row[tCol.colIndex]);
      if (hcp !== null) {
        activeColFlags.add(tCol.colIndex);
        handicapSeries.push({
          index: playedIdx++,
          tournament: tCol.name,
          handicap: hcp,
        });
      }
    }

    const roundsRaw = voltesCol !== -1 ? parseIntSafe(row[voltesCol]) : handicapSeries.length;
    const roundsPlayed = roundsRaw > 0 ? roundsRaw : handicapSeries.length;

    const holeResults: HoleResults = {
      eagles: eaglesCol !== -1 ? parseIntSafe(row[eaglesCol]) : 0,
      birdies: birdiesCol !== -1 ? parseIntSafe(row[birdiesCol]) : 0,
      pars: parsCol !== -1 ? parseIntSafe(row[parsCol]) : 0,
      bogeys: bogeysCol !== -1 ? parseIntSafe(row[bogeysCol]) : 0,
      dbogeys: dbogeysCol !== -1 ? parseIntSafe(row[dbogeysCol]) : 0,
      tbogeysPlus: tbogeysCol !== -1 ? parseIntSafe(row[tbogeysCol]) : 0,
      ratlles: ratllesCol !== -1 ? parseIntSafe(row[ratllesCol]) : 0,
      forats: foratsCol !== -1 ? parseIntSafe(row[foratsCol]) : 0,
    };

    players.push({
      license: license || `SOC-${r}`,
      rawName,
      roundsPlayed,
      handicapSeries,
      holeResults,
    });
  }

  return {
    tournaments: tournamentCols.map((t) => t.name),
    activeTournamentsCount: activeColFlags.size,
    players,
  };
}

interface ParsedOMPlayer {
  rawName: string;
  om: OrdreDeMeritData;
}

export function parseOrdreDeMeritCSV(csvText: string): { tournaments: string[]; players: ParsedOMPlayer[] } {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return { tournaments: [], players: [] };

  const headerIdx = rows.findIndex((row) => {
    const norms = row.map((c) => normalizeText(c));
    return norms.includes('NOM') && norms.includes('PUNTS');
  });

  if (headerIdx === -1) {
    throw new Error('No s’ha trobat la fila de capçalera al fitxer d’Ordre de Mèrit (NOM, PUNTS, Tor...).');
  }

  const header = rows[headerIdx];
  const normHeader = header.map((h) => normalizeText(h));

  const ryderCol = normHeader.findIndex((h) => h === 'RYDER');
  const nomCol = normHeader.findIndex((h) => h === 'NOM' || h === 'NOMBRE');
  const puntsCol = normHeader.findIndex((h) => h === 'PUNTS' || h === 'PUNTOS');
  const torCol = normHeader.findIndex((h) => h === 'TOR' || h.startsWith('TOR'));
  const firstCol = normHeader.findIndex((h) => h === '1ER' || h === '1');
  const secondCol = normHeader.findIndex((h) => h === '2ON' || h === '2');
  const thirdCol = normHeader.findIndex((h) => h === '3ER' || h === '3');
  const top5Col = normHeader.findIndex((h) => h === 'TOP 5' || h === 'TOP5');
  const top10Col = normHeader.findIndex((h) => h === 'TOP 10' || h === 'TOP10');

  // Tournament columns sit after Top-10 and before any trailing duplicate PUNTS/NOM columns
  const startTCol = (top10Col !== -1 ? top10Col : puntsCol) + 1;
  let endTCol = header.length;
  for (let c = startTCol; c < header.length; c++) {
    if (normHeader[c] === 'PUNTS' || normHeader[c] === 'NOM') {
      endTCol = c;
      break;
    }
  }

  const tournamentCols: { colIndex: number; name: string }[] = [];
  for (let c = startTCol; c < endTCol; c++) {
    const title = (header[c] || '').replace(/\s+/g, ' ').trim();
    if (title) {
      tournamentCols.push({ colIndex: c, name: title });
    }
  }

  const players: ParsedOMPlayer[] = [];
  let lastRank: number | null = null;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawName = (row[nomCol] || '').trim();
    if (!rawName || normalizeText(rawName) === 'NOM') continue;

    const rankVal = parseDecimal(row[0]);
    if (rankVal !== null && rankVal > 0) {
      lastRank = Math.round(rankVal);
    }

    const ryderRaw = ryderCol !== -1 ? (row[ryderCol] || '').trim().toUpperCase() : '';
    let ryder = 'NO';
    if (ryderRaw && ryderRaw !== '0' && ryderRaw !== 'NO') {
      if (ryderRaw === 'SI' || ryderRaw === 'SÍ' || ryderRaw === 'YES' || ryderRaw === 'X' || ryderRaw === '1') {
        ryder = 'SÍ';
      } else {
        ryder = ryderRaw;
      }
    }

    const tournamentPoints: TournamentPointEntry[] = tournamentCols.map((tCol) => {
      const rawCell = (row[tCol.colIndex] || '').trim();
      if (!rawCell) return { tournament: tCol.name, points: null };
      const num = parseDecimal(rawCell);
      return {
        tournament: tCol.name,
        points: num !== null ? num : rawCell.toUpperCase(),
      };
    });

    players.push({
      rawName,
      om: {
        rank: lastRank,
        ryder,
        points: puntsCol !== -1 ? parseIntSafe(row[puntsCol]) : 0,
        tournaments: torCol !== -1 ? parseIntSafe(row[torCol]) : 0,
        first: firstCol !== -1 ? parseIntSafe(row[firstCol]) : 0,
        second: secondCol !== -1 ? parseIntSafe(row[secondCol]) : 0,
        third: thirdCol !== -1 ? parseIntSafe(row[thirdCol]) : 0,
        top5: top5Col !== -1 ? parseIntSafe(row[top5Col]) : 0,
        top10: top10Col !== -1 ? parseIntSafe(row[top10Col]) : 0,
        tournamentPoints,
      },
    });
  }

  return {
    tournaments: tournamentCols.map((t) => t.name),
    players,
  };
}

const NAME_SYNONYMS: Record<string, string> = {
  IGNASI: 'IGNACIO',
  IGNACIO: 'IGNASI',
  CARLOS: 'CARLES',
  CARLES: 'CARLOS',
  FRANCESC: 'FRANCISCO',
  FRANCISCO: 'FRANCESC',
  RAMON: 'RAIMON',
  RAIMON: 'RAMON',
  JOSE: 'JOSEP',
  JOSEP: 'JOSE',
  MIQUEL: 'MIGUEL',
  MIGUEL: 'MIQUEL',
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function tokenMatchScore(a: string, b: string): number {
  if (a === b) return 1;
  if (NAME_SYNONYMS[a] === b) return 0.95;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen >= 4 && dist <= 1) return 0.88;
  if (maxLen >= 6 && dist <= 2) return 0.72;
  return 0;
}

function computeNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeText(nameA);
  const normB = normalizeText(nameB);
  if (normA === normB) return 100;

  const tokensA = normA.split(' ').filter((t) => t.length > 1);
  const tokensB = normB.split(' ').filter((t) => t.length > 1);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Must match first surname strongly (token 0)
  const surnameScore = tokenMatchScore(tokensA[0], tokensB[0]);
  if (surnameScore < 0.7) return 0;

  let totalScore = 0;
  const usedB = new Set<number>();

  for (const ta of tokensA) {
    let best = 0;
    let bestIdx = -1;
    for (let j = 0; j < tokensB.length; j++) {
      if (usedB.has(j)) continue;
      const sc = tokenMatchScore(ta, tokensB[j]);
      if (sc > best) {
        best = sc;
        bestIdx = j;
      }
    }
    if (bestIdx !== -1 && best > 0) {
      usedB.add(bestIdx);
      totalScore += best;
    }
  }

  const maxTokens = Math.max(tokensA.length, tokensB.length);
  return (totalScore / maxTokens) * 100;
}

export function mergeDatasets(
  resultsCSV: string,
  omCSV: string,
  season: string,
  sourceMode: 'default-2026' | 'live-sheets'
): SeasonDataset {
  const parsedResults = parseResultsCSV(resultsCSV);
  const parsedOM = parseOrdreDeMeritCSV(omCSV);

  const usedOMIndices = new Set<number>();

  // Pass 1: exact normalized match
  const matchedOMByResultIdx = new Map<number, number>();
  const omNorms = parsedOM.players.map((p) => normalizeText(p.rawName));

  parsedResults.players.forEach((rp, rIdx) => {
    const rNorm = normalizeText(rp.rawName);
    const exactIdx = omNorms.findIndex((n, idx) => !usedOMIndices.has(idx) && n === rNorm);
    if (exactIdx !== -1) {
      matchedOMByResultIdx.set(rIdx, exactIdx);
      usedOMIndices.add(exactIdx);
    }
  });

  // Pass 2: fuzzy match for spelling variations (e.g., IGNASI vs IGNACIO, CARBONELL LADO vs LLADO)
  parsedResults.players.forEach((rp, rIdx) => {
    if (matchedOMByResultIdx.has(rIdx)) return;

    let bestIdx = -1;
    let bestScore = 0;
    parsedOM.players.forEach((omp, omIdx) => {
      if (usedOMIndices.has(omIdx)) return;
      const score = computeNameSimilarity(rp.rawName, omp.rawName);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = omIdx;
      }
    });

    if (bestIdx !== -1 && bestScore >= 60) {
      matchedOMByResultIdx.set(rIdx, bestIdx);
      usedOMIndices.add(bestIdx);
    }
  });

  const players: MemberPerformance[] = parsedResults.players.map((rp, idx) => {
    const omIdx = matchedOMByResultIdx.get(idx);
    const omRecord = omIdx !== undefined ? parsedOM.players[omIdx].om : null;
    const lastPoint = rp.handicapSeries[rp.handicapSeries.length - 1];

    return {
      id: rp.license || `member-${idx}`,
      license: rp.license,
      rawName: rp.rawName,
      displayName: formatDisplayName(rp.rawName),
      roundsPlayed: rp.roundsPlayed,
      handicapSeries: rp.handicapSeries,
      currentHandicap: lastPoint ? lastPoint.handicap : null,
      holeResults: rp.holeResults,
      om: omRecord,
    };
  });

  // Include any OM-only players not found in Results sheet
  parsedOM.players.forEach((omp, omIdx) => {
    if (usedOMIndices.has(omIdx)) return;
    players.push({
      id: `om-${omIdx}`,
      license: '—',
      rawName: omp.rawName,
      displayName: formatDisplayName(omp.rawName),
      roundsPlayed: omp.om.tournaments,
      handicapSeries: [],
      currentHandicap: null,
      holeResults: {
        eagles: 0,
        birdies: 0,
        pars: 0,
        bogeys: 0,
        dbogeys: 0,
        tbogeysPlus: 0,
        ratlles: 0,
        forats: 0,
      },
      om: omp.om,
    });
  });

  return {
    season,
    sourceMode,
    fetchedAt: new Date().toISOString(),
    tournaments: parsedResults.tournaments.length > 0 ? parsedResults.tournaments : parsedOM.tournaments,
    activeTournamentsCount: parsedResults.activeTournamentsCount,
    players,
  };
}

export function normalizeGoogleSheetUrl(rawUrl: string): string {
  const url = (rawUrl || '').trim();
  if (!url) return '';

  // Already a direct CSV export link
  if (url.includes('output=csv') || url.includes('format=csv') || url.includes('tqx=out:csv')) {
    return url;
  }

  // Published to the web link: /spreadsheets/d/e/2PACX-.../pubhtml
  const pubMatch = url.match(/\/spreadsheets\/d\/e\/([^/]+)/);
  if (pubMatch) {
    const pubId = pubMatch[1];
    const gidMatch = url.match(/[?&#]gid=(\d+)/);
    return `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv${gidMatch ? `&gid=${gidMatch[1]}&single=true` : ''}`;
  }

  // Standard Google Sheets sharing link: /spreadsheets/d/{id}/edit#gid=123
  const stdMatch = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (stdMatch) {
    const sheetId = stdMatch[1];
    const gidMatch = url.match(/[?&#]gid=(\d+)/);
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidMatch ? `&gid=${gidMatch[1]}` : ''}`;
  }

  return url;
}
