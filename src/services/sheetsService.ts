import { ShowItem, WatchStatus, PRESET_PLATFORMS, PresetPlatform } from '../types';
import { getBackdropForShow, getPosterForShow } from '../data/mediaAssets';
import { googleFetch as fetch } from '../firebase';

export interface SheetParseResult {
  shows: ShowItem[];
  headers: string[];
  headerRowIndex: number;
}

export function normalizePlatform(raw?: string): string {
  if (!raw) return '📺 Netflix';
  const trimmed = raw.trim();
  if (!trimmed) return '📺 Netflix';

  // Direct match with one of the canonical 7 preset platforms
  for (const preset of PRESET_PLATFORMS) {
    if (trimmed === preset) return preset;
  }

  const lower = trimmed.toLowerCase();
  
  if (lower.includes('netflix')) return '📺 Netflix';
  if (lower.includes('prime') || lower.includes('amazon')) return '🛒 Prime Video';
  if (lower.includes('disney')) return '⚡ Disney+';
  if (lower.includes('apple') || lower.includes('atv')) return '🟣 Apple Tv+';
  if (lower.includes('paramount')) return '🟥 Paramount+';
  if (lower.includes('max') || lower.includes('hbo')) return '🟪 Max / Hbo';
  if (lower.includes('sky') || lower.includes('now')) return '🎬 Sky / Now';

  // If already prefixed with an emoji or custom name, return cleaned or default to first preset
  return trimmed;
}

export function normalizePriority(raw?: string): string {
  if (!raw) return '🔴 High';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('high') || lower.includes('🔴')) return '🔴 High';
  if (lower.includes('medium') || lower.includes('mid') || lower.includes('yellow') || lower.includes('🟡')) return '🟡 Medium';
  if (lower.includes('low') || lower.includes('green') || lower.includes('🟢')) return '🟢 Low';
  return '🔴 High';
}

export function parseGoogleSheetsDate(val: any): string {
  if (!val) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const baseDate = new Date(1899, 11, 30);
    const wholeDays = Math.floor(num);
    const fraction = num - wholeDays;
    baseDate.setDate(baseDate.getDate() + wholeDays);
    const ms = Math.round(fraction * 86400000);
    baseDate.setTime(baseDate.getTime() + ms);
    const day = String(baseDate.getDate()).padStart(2, '0');
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const year = baseDate.getFullYear();
    const hours = String(baseDate.getHours()).padStart(2, '0');
    const minutes = String(baseDate.getMinutes()).padStart(2, '0');
    if (fraction > 0.0001 && (hours !== '00' || minutes !== '00')) {
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    }
    return `${day}-${month}-${year}`;
  }
  
  const str = String(val).trim();
  
  // 1. Detect and preserve ISO airstamps (e.g. 2026-10-06T01:00:00+00:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return str;
  }

  const rawNum = Number(str);
  if (!isNaN(rawNum) && rawNum > 30000 && rawNum < 60000) {
    const baseDate = new Date(1899, 11, 30);
    const wholeDays = Math.floor(rawNum);
    const fraction = rawNum - wholeDays;
    baseDate.setDate(baseDate.getDate() + wholeDays);
    const ms = Math.round(fraction * 86400000);
    baseDate.setTime(baseDate.getTime() + ms);
    const day = String(baseDate.getDate()).padStart(2, '0');
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const year = baseDate.getFullYear();
    const hours = String(baseDate.getHours()).padStart(2, '0');
    const minutes = String(baseDate.getMinutes()).padStart(2, '0');
    if (fraction > 0.0001 && (hours !== '00' || minutes !== '00')) {
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    }
    return `${day}-${month}-${year}`;
  }

  // Extract time if present: "2026-09-27 20:00" or "27-09-2026 20:00" or "2026-09-27T20:00"
  const timeMatch = str.match(/[\sT](\d{1,2}:\d{2}(?::\d{2})?)/);
  const timePart = timeMatch ? timeMatch[1].slice(0, 5) : '';
  const dateOnly = str.split(/[\sT]/)[0].trim();

  if (dateOnly.includes('-')) {
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      let formattedDate = dateOnly;
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD-MM-YYYY
        formattedDate = `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY -> DD-MM-YYYY
        formattedDate = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
      return timePart ? `${formattedDate} ${timePart}` : formattedDate;
    }
  }

  if (dateOnly.includes('/')) {
    const parts = dateOnly.split('/');
    if (parts.length === 3) {
      let formattedDate = dateOnly;
      if (parts[0].length === 4) {
        // YYYY/MM/DD -> DD-MM-YYYY
        formattedDate = `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY -> DD-MM-YYYY
        formattedDate = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
      return timePart ? `${formattedDate} ${timePart}` : formattedDate;
    }
  }
  
  return str;
}

export const DEFAULT_TRACKER_HEADERS = [
  'Title',       // Col A (0)
  'Type',        // Col B (1)
  'Platform',    // Col C (2)
  'Season',      // Col D (3)
  'Episodes',    // Col E (4)
  'Next Ep',     // Col F (5)
  'Next Ssn',    // Col G (6)
  'Genre',       // Col H (7)
  'Year',        // Col I (8)
  'Status',      // Col J (9)
  'Rating',      // Col K (10)
  'Notes',       // Col L (11)
  'Who',         // Col M (12)
  'Rating num',  // Col N (13)
  'Max Ep',      // Col O (14)
  'Poster',      // Col P (15)
  'Release Date', // Col Q (16)
  'Release Note', // Col R (17)
];

export const DEFAULT_WISHLIST_HEADERS = [
  'Title',        // Col A (0)
  'Type',         // Col B (1)
  'Platform',     // Col C (2)
  'Release Year', // Col D (3)
  'Priority',     // Col E (4)
  'Date Added',   // Col F (5)
  'DONE',         // Col G (6)
  'Poster',       // Col H (7)
  'Release Date', // Col I (8)
  'Release Note', // Col J (9)
  'Who',          // Col K (10)
];

export function extractImageUrl(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  // Match =IMAGE("https://...") or =IMAGE('https://...')
  const match = trimmed.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export function formatPosterForSheet(url: string | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('=IMAGE(') || trimmed.startsWith('=image(')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `=IMAGE("${trimmed}")`;
  }
  // Avoid saving huge base64 data URLs directly to Google Sheets cell
  if (trimmed.startsWith('data:image/')) {
    return '';
  }
  return trimmed;
}

export function matchHeaderToField(header: string, index: number): string {
  const h = header.trim().toLowerCase();

  // Explicit title / name / show header check
  if (
    h.includes('title') ||
    h.includes('show name') ||
    h.includes('series name') ||
    h.includes('movie name') ||
    h.includes('film name') ||
    h === 'title' ||
    h === 'name' ||
    h === 'show' ||
    h === 'movie' ||
    h === 'series'
  ) {
    return 'title';
  }

  // If header is empty, fallback by column index position
  if (!h) {
    if (index === 0) return 'title';
    if (index === 1) return 'type';
    if (index === 2) return 'platform';
    if (index === 3) return 'season';
    if (index === 4) return 'episode';
    if (index === 5) return 'next_ep';
    if (index === 6) return 'next_ssn';
    if (index === 7) return 'genre';
    if (index === 8) return 'year';
    if (index === 9) return 'status';
    if (index === 10) return 'rating';
    if (index === 11) return 'notes';
    if (index === 12) return 'who';
    if (index === 13) return 'rating_num';
    if (index === 14) return 'max_ep';
    if (index === 15) return 'poster';
    if (index === 16) return 'release_date';
    if (index === 17) return 'release_note';
  }

  // Specific Release Date check MUST run BEFORE generic date or release checks
  if (
    h.includes('release date') ||
    h.includes('release_date') ||
    h.includes('premiere date') ||
    h.includes('target date') ||
    h.includes('air date') ||
    h.includes('air_date') ||
    h === 'releasedate' ||
    h === 'target premiere date' ||
    h === 'target premiere'
  ) {
    return 'release_date';
  }

  // Specific Release Note check MUST run BEFORE generic note or release checks
  if (
    h.includes('release note') ||
    h.includes('release_note') ||
    h.includes('premiere note') ||
    h.includes('countdown note') ||
    h === 'releasenote' ||
    h === 'premiere/countdown note' ||
    h === 'countdown_note'
  ) {
    return 'release_note';
  }

  // Next ep / Next ssn MUST be checked before general episode / season
  if (
    h.includes('next ep') ||
    h.includes('next episode') ||
    h.includes('next eposide') ||
    h === 'nextep' ||
    h === '▶ next ep'
  ) {
    return 'next_ep';
  }
  if (
    h.includes('next ssn') ||
    h.includes('next season') ||
    h === 'nextssn' ||
    h === '📺 next ssn'
  ) {
    return 'next_ssn';
  }

  // Max ep / total ep MUST be checked BEFORE general episode / season
  if (
    h.includes('max ep') ||
    h.includes('total ep') ||
    h.includes('max episode') ||
    h === 'maxep' ||
    h === 'max_ep'
  ) {
    return 'max_ep';
  }

  // Episode: matches "E", "Ep", "Eps", "Episode", "Episodes", "Eposide", "Current Ep"
  if (
    h === 'e' ||
    h === 'ep' ||
    h === 'eps' ||
    h === 'ep.' ||
    h.includes('episode') ||
    h.includes('eposide') ||
    h.includes('episodes') ||
    h.startsWith('ep ') ||
    h.endsWith(' ep')
  ) {
    return 'episode';
  }

  // Season: matches "S", "Ssn", "Ssns", "Season", "Seasons", "Current Season"
  if (
    h === 's' ||
    h === 'ssn' ||
    h === 'ssns' ||
    h === 's.' ||
    h.includes('season') ||
    h.includes('seasons') ||
    h.startsWith('ssn ') ||
    h.endsWith(' ssn')
  ) {
    return 'season';
  }

  // Priority (Wishlist Col E)
  if (h.includes('priority') || h.includes('prio')) {
    return 'priority';
  }

  // Date Added (Wishlist Col F) - only match date added, not general dates
  if (h.includes('date added') || h.includes('date_added') || h === 'added' || h === 'date') {
    return 'date_added';
  }

  // DONE / Watched (Wishlist Col G)
  if (h === 'done' || h === 'is_done' || h === 'done?' || h === 'watched?' || h === 'finished') {
    return 'done';
  }

  // Year / Release Year (Wishlist Col D or Master Col I) - only match year or release year
  if (h === 'year' || h.includes('release year') || h === 'release_year' || (h.includes('year') && !h.includes('next'))) {
    return 'year';
  }

  // Title (Col A)
  if (h.includes('title') || h.includes('name') || h === 'show') {
    return 'title';
  }

  // Type (Col B)
  if (h.includes('type') || h.includes('format') || h.includes('series') || h.includes('movie')) {
    return 'type';
  }

  // Platform (Col C)
  if (
    h.includes('platform') ||
    h.includes('service') ||
    h.includes('streaming') ||
    h.includes('network')
  ) {
    return 'platform';
  }

  // Genre (Master Col H)
  if (h.includes('genre') || h.includes('category')) {
    return 'genre';
  }

  // Status (Master Col J)
  if (h.includes('status') || h.includes('state') || h.includes('progress')) {
    return 'status';
  }

  // Rating num (Master Col N)
  if (h.includes('rating num') || h.includes('score num') || h === 'rating_num') {
    return 'rating_num';
  }

  // Rating (Master Col K)
  if (h.includes('rating') || h.includes('score') || h.includes('stars')) {
    return 'rating';
  }

  // Notes (Master Col L) - avoid release notes
  if ((h.includes('note') && !h.includes('release') && !h.includes('premiere')) || h.includes('comment') || h.includes('review')) {
    return 'notes';
  }

  // Who (Master Col M)
  if (
    h.includes('who') ||
    h.includes('user') ||
    h.includes('viewer') ||
    h.includes('watcher') ||
    h.includes('person')
  ) {
    return 'who';
  }

  // Poster / Backdrop (Master Col P, Wishlist Col H, or named column)
  if (
    h.includes('poster') ||
    h.includes('image') ||
    h.includes('art') ||
    h.includes('photo') ||
    h.includes('cover') ||
    h.includes('pic') ||
    h.includes('thumb') ||
    h.includes('img')
  ) {
    return 'poster';
  }
  if (h.includes('backdrop') || h.includes('banner') || h.includes('hero') || h.includes('wallpaper')) {
    return 'backdrop';
  }

  return 'unknown';
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  // Check if it's a full Google Sheets URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Otherwise assume user pasted the raw ID
  return trimmed;
}

export async function getSheetTabHeaders(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[]> {
  try {
    const range = formatA1Range(sheetName, 'A1:Z10');
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rows: string[][] = data.values || [];
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (row && row.some((c) => String(c).trim().toLowerCase() === 'title')) {
        return row.map((c) => String(c).trim());
      }
    }
    if (rows.length > 0) {
      return rows[0].map((c) => String(c).trim());
    }
  } catch (e) {
    console.warn('Failed to fetch headers for sheet:', sheetName, e);
  }
  return [];
}

export function formatA1Range(sheetName: string, cellRange: string): string {
  const cleanName = (sheetName || 'Sheet1').trim();
  // Strip existing outer quotes if present
  const unquoted =
    cleanName.startsWith("'") && cleanName.endsWith("'")
      ? cleanName.slice(1, -1)
      : cleanName;
  // Escape inner single quotes by doubling them (' -> '')
  const escaped = unquoted.replace(/'/g, "''");
  // Always wrap in single quotes: 'MASTER TRACKER'!A1:Z500
  return `'${escaped}'!${cellRange}`;
}

export interface SheetMetadata {
  title: string;
  sheets: Array<{ id: number; title: string }>;
  sheetNames: string[];
}

export async function fetchSpreadsheetDetails(
  spreadsheetId: string,
  accessToken: string
): Promise<SheetMetadata> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to fetch spreadsheet metadata (Status ${res.status})`
    );
  }

  const data = await res.json();
  const title = data.properties?.title || 'Untitled Spreadsheet';
  const sheets: Array<{ id: number; title: string }> = (data.sheets || []).map((s: any) => ({
    id: typeof s.properties?.sheetId === 'number' ? s.properties.sheetId : 0,
    title: s.properties?.title || 'Sheet1',
  }));
  const sheetNames = sheets.map((s) => s.title);

  return { title, sheets, sheetNames };
}

/**
 * Automatically detects and matches a wishlist sheet name from available sheets.
 * Accurately finds user sheets like "📋  WISHLIST", "📋 WISHLIST", "Wishlist", etc.
 */
export function findMatchingWishlistSheet(sheetNames: string[]): string | undefined {
  if (!sheetNames || sheetNames.length === 0) return undefined;

  // 1. Direct match with "📋  WISHLIST" or "📋 WISHLIST" (with clipboard emoji or variations)
  const clipboardExact = sheetNames.find((s) => {
    const trimmed = s.trim();
    return (
      trimmed === '📋  WISHLIST' ||
      trimmed === '📋 WISHLIST' ||
      trimmed.toUpperCase() === '📋  WISHLIST' ||
      trimmed.toUpperCase() === '📋 WISHLIST'
    );
  });
  if (clipboardExact) return clipboardExact;

  // 2. Contains both clipboard emoji and 'wishlist' (case-insensitive)
  const clipboardWishlist = sheetNames.find(
    (s) => s.includes('📋') && s.toLowerCase().includes('wishlist')
  );
  if (clipboardWishlist) return clipboardWishlist;

  // 3. Any sheet containing 'wishlist' (case-insensitive)
  const candidates = sheetNames.filter((s) => s.toLowerCase().includes('wishlist'));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    // Prefer the one with emoji or all-uppercase if the user has both
    const withEmoji = candidates.find((s) => s.includes('📋') || s.includes('🎁') || s.includes('⭐'));
    if (withEmoji) return withEmoji;
    const allUpper = candidates.find((s) => s.includes('WISHLIST'));
    if (allUpper) return allUpper;
    return candidates[0];
  }

  // 4. Strip all non-alphanumeric and match 'wishlist'
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const stripped = sheetNames.find((s) => clean(s) === 'wishlist');
  if (stripped) return stripped;

  return undefined;
}

/**
 * Automatically detects and matches a master tracker sheet name from available sheets.
 */
export function findMatchingMasterSheet(sheetNames: string[]): string | undefined {
  if (!sheetNames || sheetNames.length === 0) return undefined;

  // 1. Check for tracker or master
  const tracker = sheetNames.find((s) => {
    const lower = s.toLowerCase();
    return lower.includes('tracker') || lower.includes('master');
  });
  if (tracker) return tracker;

  // 2. First non-wishlist sheet
  const nonWishlist = sheetNames.find((s) => !s.toLowerCase().includes('wishlist'));
  return nonWishlist || sheetNames[0] || 'Sheet1';
}

/**
 * Automatically detects and matches a showcase sheet name from available sheets.
 */
export function findMatchingShowcaseSheet(sheetNames: string[]): string | undefined {
  if (!sheetNames || sheetNames.length === 0) return undefined;

  return sheetNames.find((s) => {
    const lower = s.toLowerCase();
    return lower.includes('showcase') || lower.includes('featured') || lower.includes('highlight');
  });
}

export interface BatchFetchResult {
  sheetResults: Record<string, SheetParseResult>;
  viewersResult?: FetchViewersResult;
  dataSignature?: string;
}

export function computeSheetDataSignature(valueRanges: any[]): string {
  if (!Array.isArray(valueRanges)) return '';
  let hash = 0x811c9dc5;
  let totalCells = 0;
  let rowCount = 0;

  for (const vr of valueRanges) {
    const values = vr?.values;
    if (Array.isArray(values)) {
      rowCount += values.length;
      for (let r = 0; r < values.length; r++) {
        const row = values[r];
        if (Array.isArray(row)) {
          totalCells += row.length;
          for (let c = 0; c < row.length; c++) {
            const str = String(row[c] ?? '');
            for (let i = 0; i < str.length; i++) {
              hash ^= str.charCodeAt(i);
              hash = Math.imul(hash, 0x01000193);
            }
          }
        }
      }
    }
  }

  return `sig_r${rowCount}_c${totalCells}_h${(hash >>> 0).toString(16)}`;
}

export async function fetchAllSheetDataBatch(
  spreadsheetId: string,
  tabConfigs: Array<{ name: string; isWishlist: boolean }>,
  accessToken: string,
  listsTabName?: string
): Promise<BatchFetchResult> {
  if (tabConfigs.length === 0 && !listsTabName) return { sheetResults: {} };

  let resolvedConfigs = tabConfigs;
  try {
    const meta = await fetchSpreadsheetDetails(spreadsheetId, accessToken);
    resolvedConfigs = tabConfigs.map((t) => {
      const lowerName = t.name.toLowerCase();
      if (t.isWishlist || lowerName.includes('wishlist')) {
        const matched = findMatchingWishlistSheet(meta.sheetNames);
        if (matched) {
          return { ...t, name: matched };
        }
      } else if (lowerName.includes('showcase') || lowerName.includes('featured') || lowerName.includes('highlight')) {
        const matchedShowcase = findMatchingShowcaseSheet(meta.sheetNames);
        if (matchedShowcase) {
          return { ...t, name: matchedShowcase };
        }
      } else {
        const matchedMaster = findMatchingMasterSheet(meta.sheetNames);
        if (matchedMaster) {
          return { ...t, name: matchedMaster };
        }
      }
      return t;
    });
  } catch (e) {
    console.warn('Batch tab name resolution notice:', e);
  }

  const allRanges: string[] = [];
  const rangeMap: Array<{ type: 'tab' | 'lists'; name: string; isWishlist?: boolean }> = [];

  resolvedConfigs.forEach((t) => {
    allRanges.push(encodeURIComponent(formatA1Range(t.name, 'A1:ZZ1000')));
    rangeMap.push({ type: 'tab', name: t.name, isWishlist: t.isWishlist });
  });

  if (listsTabName) {
    allRanges.push(encodeURIComponent(formatA1Range(listsTabName, 'D2:E900')));
    rangeMap.push({ type: 'lists', name: listsTabName });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${allRanges.join('&ranges=')}&valueRenderOption=FORMULA`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // If batch fails, fallback to individual fetches for resilience
    const sheetResults: Record<string, SheetParseResult> = {};
    for (const config of tabConfigs) {
      try {
        sheetResults[config.name] = await fetchSheetRows(spreadsheetId, config.name, accessToken, config.isWishlist);
      } catch (e) {
        console.warn(`Fallback fetch failed for ${config.name}:`, e);
      }
    }
    let viewersResult: FetchViewersResult | undefined = undefined;
    if (listsTabName) {
      try {
        viewersResult = await fetchCustomViewers(spreadsheetId, listsTabName, accessToken);
      } catch {}
    }
    return { sheetResults, viewersResult };
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];
  const sheetResults: Record<string, SheetParseResult> = {};
  let viewersResult: FetchViewersResult | undefined = undefined;

  rangeMap.forEach((item, idx) => {
    const vr = valueRanges[idx];
    const rawRows: string[][] = vr?.values || [];
    if (item.type === 'tab') {
      sheetResults[item.name] = parseRawSheetRows(item.name, rawRows, Boolean(item.isWishlist));
    } else if (item.type === 'lists') {
      const viewers: string[] = [];
      const colors: Record<string, string> = {};
      rawRows.forEach((row: any) => {
        if (!Array.isArray(row) || !row[0]) return;
        const name = String(row[0]).trim();
        const lower = name.toLowerCase();
        if (
          name.length > 0 &&
          lower !== 'who' &&
          lower !== 'viewer' &&
          lower !== 'viewers' &&
          lower !== 'name' &&
          lower !== 'profile' &&
          lower !== 'profiles' &&
          lower !== 'color' &&
          lower !== 'color tag' &&
          lower !== 'color tags'
        ) {
          if (!viewers.includes(name)) {
            viewers.push(name);
          }
          if (row[1]) {
            const color = String(row[1]).trim();
            if (color) colors[name] = color;
          }
        }
      });
      viewersResult = { viewers, colors };
    }
  });

  const dataSignature = computeSheetDataSignature(valueRanges);

  return { sheetResults, viewersResult, dataSignature };
}

export async function fetchMultipleSheetRows(
  spreadsheetId: string,
  tabConfigs: Array<{ name: string; isWishlist: boolean }>,
  accessToken: string
): Promise<Record<string, SheetParseResult>> {
  const result = await fetchAllSheetDataBatch(spreadsheetId, tabConfigs, accessToken);
  return result.sheetResults;
}

export function parseRawSheetRows(
  sheetName: string,
  rawRows: string[][],
  isWishlistTab: boolean = false
): SheetParseResult {
  if (rawRows.length === 0) {
    return { shows: [], headers: [], headerRowIndex: 0 };
  }

  // Find header row within Rows 1-10 (0-based indices 0..9)
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    if (row.some((col) => {
      const c = String(col).trim().toLowerCase();
      return (
        c === 'title' || c.includes('title') || c === 'type' || c === 'platform' ||
        c === 'genre' || c === 'priority' || c === 'season' || c === 'episodes' ||
        c === 'name' || c === 'show' || c === 'status'
      );
    })) {
      headerIndex = i;
      break;
    }
  }

  // Default to Row 1 (0-based index 0) if none found
  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const headers = (rawRows[headerIndex] || [])
    .map((h) => String(h).trim())
    .map((h, i) => (h === '' && i > 15 ? '' : h));

  // Map header fields using matchHeaderToField
  let titleIdx = -1;
  let typeIdx = -1;
  let platformIdx = -1;
  let seasonsIdx = -1;
  let episodesIdx = -1;
  let nextEpIdx = -1;
  let nextSsnIdx = -1;
  let genreIdx = -1;
  let yearIdx = -1;
  let priorityIdx = -1;
  let dateAddedIdx = -1;
  let doneIdx = -1;
  let statusIdx = -1;
  let ratingIdx = -1;
  let ratingTextIdx = -1;
  let notesIdx = -1;
  let whoIdx = -1;
  let maxEpIdx = -1;
  let posterIdx = -1;
  let backdropIdx = -1;
  let releaseDateIdx = -1;
  let releaseNoteIdx = -1;

  headers.forEach((h, idx) => {
    const field = matchHeaderToField(h, idx);
    if (field === 'title' && titleIdx === -1) titleIdx = idx;
    else if (field === 'type' && typeIdx === -1) typeIdx = idx;
    else if (field === 'platform' && platformIdx === -1) platformIdx = idx;
    else if (field === 'season' && seasonsIdx === -1) seasonsIdx = idx;
    else if (field === 'episode' && episodesIdx === -1) episodesIdx = idx;
    else if (field === 'next_ep' && nextEpIdx === -1) nextEpIdx = idx;
    else if (field === 'next_ssn' && nextSsnIdx === -1) nextSsnIdx = idx;
    else if (field === 'genre' && genreIdx === -1) genreIdx = idx;
    else if (field === 'year' && yearIdx === -1) yearIdx = idx;
    else if (field === 'priority' && priorityIdx === -1) priorityIdx = idx;
    else if (field === 'date_added' && dateAddedIdx === -1) dateAddedIdx = idx;
    else if (field === 'done' && doneIdx === -1) doneIdx = idx;
    else if (field === 'status' && statusIdx === -1) statusIdx = idx;
    else if (field === 'rating_num' && ratingIdx === -1) ratingIdx = idx;
    else if (field === 'rating' && ratingTextIdx === -1) ratingTextIdx = idx;
    else if (field === 'notes' && notesIdx === -1) notesIdx = idx;
    else if (field === 'who' && whoIdx === -1) whoIdx = idx;
    else if (field === 'max_ep' && maxEpIdx === -1) maxEpIdx = idx;
    else if (field === 'poster' && posterIdx === -1) posterIdx = idx;
    else if (field === 'backdrop' && backdropIdx === -1) backdropIdx = idx;
    else if (field === 'release_date' && releaseDateIdx === -1) releaseDateIdx = idx;
    else if (field === 'release_note' && releaseNoteIdx === -1) releaseNoteIdx = idx;
  });

  // If titleIdx was not explicitly matched by header text, find the first non-ID column or fallback to 0
  if (titleIdx === -1) {
    for (let c = 0; c < Math.max(headers.length, 1); c++) {
      const h = (headers[c] || '').toLowerCase().trim();
      if (h !== 'id' && h !== '#' && h !== 'no' && h !== 'num' && h !== 'row' && h !== 'index') {
        titleIdx = c;
        break;
      }
    }
    if (titleIdx === -1) titleIdx = 0;
  }

  const isEffectiveWishlist =
    isWishlistTab ||
    sheetName.toLowerCase().includes('wishlist');

  const isEffectiveShowcase =
    sheetName.toLowerCase().includes('showcase') ||
    sheetName.toLowerCase().includes('featured') ||
    sheetName.toLowerCase().includes('highlight');

  // Positional fallbacks if any fields are unmapped
  if (isEffectiveWishlist) {
    if (typeIdx === -1) typeIdx = 1;
    if (platformIdx === -1) platformIdx = 2;
    if (yearIdx === -1) yearIdx = 3;
    if (priorityIdx === -1) priorityIdx = 4;
    if (dateAddedIdx === -1) dateAddedIdx = 5;
    if (doneIdx === -1) doneIdx = 6;
    if (posterIdx === -1) posterIdx = 7;
    if (releaseDateIdx === -1) releaseDateIdx = 8;
    if (releaseNoteIdx === -1) releaseNoteIdx = 9;
    if (whoIdx === -1) whoIdx = 10;
  } else if (isEffectiveShowcase) {
    if (typeIdx === -1) typeIdx = 1;
    if (platformIdx === -1) platformIdx = 2;
    if (genreIdx === -1) genreIdx = 3;
    if (posterIdx === -1) posterIdx = 4;
    if (notesIdx === -1) notesIdx = 5;
  } else {
    // Master Tracker
    if (typeIdx === -1) typeIdx = 1;
    if (platformIdx === -1) platformIdx = 2;
    if (seasonsIdx === -1) seasonsIdx = 3;
    if (episodesIdx === -1) episodesIdx = 4;
    if (nextEpIdx === -1) nextEpIdx = 5;
    if (nextSsnIdx === -1) nextSsnIdx = 6;
    if (genreIdx === -1) genreIdx = 7;
    if (yearIdx === -1) yearIdx = 8;
    if (statusIdx === -1) statusIdx = 9;
    if (ratingTextIdx === -1) ratingTextIdx = 10;
    if (notesIdx === -1) notesIdx = 11;
    if (whoIdx === -1) whoIdx = 12;
    if (ratingIdx === -1) ratingIdx = 13;
    if (maxEpIdx === -1) maxEpIdx = 14;
    if (posterIdx === -1) posterIdx = 15;
    if (releaseDateIdx === -1) releaseDateIdx = 16;
    if (releaseNoteIdx === -1) releaseNoteIdx = 17;
  }

  const shows: ShowItem[] = [];

  // Read data rows starting immediately after header row
  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    let rawTitle = row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : '';

    // If rawTitle is empty or looks like a row number (e.g. "1") and Col A was just an ID/index, try Col B
    if ((!rawTitle || (titleIdx === 0 && /^\d+$/.test(rawTitle))) && row[1] && typeof row[1] === 'string') {
      const alt = String(row[1]).trim();
      if (alt && !/^\d+$/.test(alt)) {
        rawTitle = alt;
      }
    }

    if (!rawTitle) continue;

    // Skip if row is a duplicate header row
    const lowerTitle = rawTitle.toLowerCase();
    if (
      lowerTitle === 'title' ||
      lowerTitle === 'show name' ||
      lowerTitle === 'series name' ||
      lowerTitle === 'movie name' ||
      lowerTitle === 'name' ||
      lowerTitle === 'show'
    ) {
      continue;
    }

    const title = rawTitle;
    const typeStr = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : 'Series';
    const type = typeStr.toLowerCase().includes('movie') ? 'Movie' : 'Series';
    const isMovie = type === 'Movie';
    const rawPlatform = platformIdx !== -1 && row[platformIdx] ? String(row[platformIdx]).trim() : '';
    const platform = normalizePlatform(rawPlatform);
    const seasons = isMovie ? '' : (seasonsIdx !== -1 && row[seasonsIdx] ? String(row[seasonsIdx]).trim() : 'S1');
    const episodes = isMovie ? '' : (episodesIdx !== -1 && row[episodesIdx] ? String(row[episodesIdx]).trim() : 'E1');
    const nextEpRaw = nextEpIdx !== -1 ? row[nextEpIdx] : '';
    const nextEp = isMovie ? false : (String(nextEpRaw).trim().toUpperCase() === 'TRUE' || String(nextEpRaw).trim() === '1');
    const nextSsnRaw = nextSsnIdx !== -1 ? row[nextSsnIdx] : '';
    const nextSsn = isMovie ? false : (String(nextSsnRaw).trim().toUpperCase() === 'TRUE' || String(nextSsnRaw).trim() === '1');
    const genre = genreIdx !== -1 && row[genreIdx] ? String(row[genreIdx]).trim() : 'Drama';
    const year = yearIdx !== -1 && row[yearIdx] ? String(row[yearIdx]).trim() : '2024';

    const priority = priorityIdx !== -1 && row[priorityIdx] ? normalizePriority(String(row[priorityIdx])) : (isEffectiveWishlist ? '🔴 High' : undefined);
    const dateAddedRaw = dateAddedIdx !== -1 && row[dateAddedIdx] ? String(row[dateAddedIdx]).trim() : undefined;
    const dateAdded = dateAddedRaw ? parseGoogleSheetsDate(dateAddedRaw) : undefined;
    const doneVal = doneIdx !== -1 && row[doneIdx] ? String(row[doneIdx]).trim().toUpperCase() : '';

    let status: WatchStatus = '⏳ Watching';
    if (doneVal === 'TRUE' || doneVal === 'DONE' || doneVal === 'YES' || doneVal === '1') {
      status = '✅ Watched';
    } else {
      let statusRaw = statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim() : '⏳ Watching';
      if (statusRaw.includes('Watched') || statusRaw.includes('Done') || statusRaw.includes('Finished')) {
        status = '✅ Watched';
      } else if (statusRaw.includes('Drop') || statusRaw.includes('❌')) {
        status = '❌ Dropped';
      } else if (statusRaw.includes('Hold') || statusRaw.includes('Pause') || statusRaw.includes('⏸️')) {
        status = '⏸️ Paused';
      } else {
        status = '⏳ Watching';
      }
    }

    const ratingRaw = ratingTextIdx !== -1 && row[ratingTextIdx] ? String(row[ratingTextIdx]).trim() : '';
    let ratingNum = 0;
    if (ratingIdx !== -1 && row[ratingIdx]) {
      const rawVal = String(row[ratingIdx]).trim();
      const firstPart = rawVal.split('/')[0];
      const parsed = parseFloat(firstPart.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) ratingNum = parsed;
    }
    if (ratingNum > 5) {
      if (ratingNum >= 10 && ratingNum <= 55) ratingNum = Math.min(5, Math.floor(ratingNum / 10));
      else ratingNum = 5;
    }
    if (ratingNum === 0 && ratingRaw) {
      const stars = (ratingRaw.match(/⭐/g) || []).length;
      if (stars > 0) ratingNum = stars;
    }

    const notes = notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]).trim() : '';
    const who = whoIdx !== -1 && row[whoIdx] ? String(row[whoIdx]).trim() : '';
    const maxEp = isMovie ? '' : (maxEpIdx !== -1 && row[maxEpIdx] ? String(row[maxEpIdx]).trim() : 'E8');
    const releaseDateRaw = releaseDateIdx !== -1 && row[releaseDateIdx] ? String(row[releaseDateIdx]).trim() : undefined;
    const releaseDate = releaseDateRaw ? parseGoogleSheetsDate(releaseDateRaw) : undefined;
    const releaseNote = releaseNoteIdx !== -1 && row[releaseNoteIdx] ? String(row[releaseNoteIdx]).trim() : undefined;

    let customPoster: string | undefined = undefined;
    if (posterIdx !== -1 && row[posterIdx]) customPoster = extractImageUrl(String(row[posterIdx]).trim());
    if (!customPoster && isEffectiveWishlist && row.length > 7 && row[7]) customPoster = extractImageUrl(String(row[7]).trim());
    if (!customPoster && !isEffectiveWishlist && row.length > 15 && row[15]) customPoster = extractImageUrl(String(row[15]).trim());
    
    if (!customPoster) {
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim();
        if (cell.includes('=IMAGE') || cell.includes('=image') || cell.includes('http://') || cell.includes('https://') || cell.includes('drive.google.com')) {
          const parsed = extractImageUrl(cell);
          if (parsed) {
            customPoster = parsed;
            break;
          }
        }
      }
    }

    const customBackdrop = backdropIdx !== -1 && row[backdropIdx] ? extractImageUrl(String(row[backdropIdx])) : undefined;
    const tabPrefix = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const id = `show-${tabPrefix}-${r}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const finalPosterUrl = customPoster || customBackdrop || getPosterForShow(title, genre);
    const finalBackdropUrl = customBackdrop || customPoster || getBackdropForShow(title, genre);

    let finalRatingText = 'Unrated';
    if (ratingRaw) finalRatingText = ratingRaw;
    else if (ratingNum > 0) {
      if (ratingNum === 1) finalRatingText = '⭐ = Poor';
      else if (ratingNum === 2) finalRatingText = '⭐⭐ = Fair';
      else if (ratingNum === 3) finalRatingText = '⭐⭐⭐ = Good';
      else if (ratingNum === 4) finalRatingText = '⭐⭐⭐⭐ = Great';
      else if (ratingNum === 5) finalRatingText = '⭐⭐⭐⭐⭐ = Excellent';
    }

    shows.push({
      id, title, type, platform, seasons, episodes, nextEp, nextSsn, genre, year, status,
      rating: finalRatingText, ratingNum: ratingNum || 0, notes, who, maxEp,
      rowNumber: r + 1, isWishlist: isEffectiveWishlist, sheetTabName: sheetName,
      priority, dateAdded, backdropUrl: finalBackdropUrl, posterUrl: finalPosterUrl,
      releaseDate, releaseNote,
    });
  }

  return { shows, headers, headerRowIndex: headerIndex };
}

export async function fetchSheetRows(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  isWishlistTab: boolean = false
): Promise<SheetParseResult> {
  let targetSheet = sheetName;

  // Auto-resolve wishlist tab name if generic 'Wishlist' was provided
  if (isWishlistTab && targetSheet.trim().toLowerCase() === 'wishlist') {
    try {
      const meta = await fetchSpreadsheetDetails(spreadsheetId, accessToken);
      const matched = findMatchingWishlistSheet(meta.sheetNames);
      if (matched) {
        targetSheet = matched;
      }
    } catch {
      // Continue with provided targetSheet
    }
  }

  const safeRange = formatA1Range(targetSheet, 'A1:ZZ1000');
  const encodedRange = encodeURIComponent(safeRange);
  // Request valueRenderOption=FORMULA so formulas like =IMAGE("https://...") return the URL string instead of empty blank cells
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueRenderOption=FORMULA`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // If fetching wishlist tab failed (e.g. range not found), try auto-discovering the actual tab
    if (isWishlistTab || targetSheet.toLowerCase().includes('wishlist')) {
      try {
        const meta = await fetchSpreadsheetDetails(spreadsheetId, accessToken);
        const resolved = findMatchingWishlistSheet(meta.sheetNames);
        if (resolved && resolved !== targetSheet) {
          console.log(`Auto-redirecting wishlist fetch from "${targetSheet}" to detected "${resolved}"`);
          return await fetchSheetRows(spreadsheetId, resolved, accessToken, true);
        }
      } catch (fallbackErr) {
        console.warn('Fallback wishlist sheet lookup notice:', fallbackErr);
      }
    }

    throw new Error(
      errorData.error?.message || `Failed to fetch spreadsheet rows from "${targetSheet}" (Status ${res.status})`
    );
  }

  const data = await res.json();
  const rawRows: string[][] = data.values || [];
  return parseRawSheetRows(targetSheet, rawRows, isWishlistTab);
}

export interface FetchViewersResult {
  viewers: string[];
  colors: Record<string, string>;
}

export async function fetchCustomViewers(
  spreadsheetId: string,
  listsTabName: string,
  accessToken: string
): Promise<FetchViewersResult> {
  // Read D2:E900 (Column D is Profile / Viewer Name, Column E is Color Tag)
  const safeRange = formatA1Range(listsTabName, 'D2:E900');
  const encodedRange = encodeURIComponent(safeRange);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return { viewers: [], colors: {} };
  }

  const data = await res.json();
  if (!data.values || !Array.isArray(data.values)) {
    return { viewers: [], colors: {} };
  }

  const viewers: string[] = [];
  const colors: Record<string, string> = {};

  // Extract non-empty trimmed strings from Column D (name) & Column E (color tag)
  data.values.forEach((row: any) => {
    if (!Array.isArray(row) || !row[0]) return;
    const name = String(row[0]).trim();
    const lower = name.toLowerCase();
    if (
      name.length > 0 &&
      lower !== 'who' &&
      lower !== 'viewer' &&
      lower !== 'viewers' &&
      lower !== 'name' &&
      lower !== 'profile' &&
      lower !== 'profiles' &&
      lower !== 'color' &&
      lower !== 'color tag' &&
      lower !== 'color tags'
    ) {
      if (!viewers.includes(name)) {
        viewers.push(name);
      }
      if (row[1]) {
        const color = String(row[1]).trim();
        if (color) {
          colors[name] = color;
        }
      }
    }
  });

  return { viewers, colors };
}

export async function updateCustomViewers(
  spreadsheetId: string,
  listsTabName: string,
  viewers: string[],
  accessToken: string,
  colors?: Record<string, string>
): Promise<boolean> {
  // Safe range D3:E300 stores Profile Name in Column D and Color Tag in Column E
  const safeRange = formatA1Range(listsTabName, 'D3:E300');
  const encodedRange = encodeURIComponent(safeRange);

  const values: string[][] = Array(298).fill(["", ""]);
  viewers.forEach((v, idx) => {
    if (idx < values.length) {
      values[idx] = [v, (colors && colors[v]) ? colors[v] : ''];
    }
  });

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: safeRange,
          majorDimension: 'ROWS',
          values,
        }),
      }
    );

    // Also update Column E header "Color Tag" in cell E2 if possible
    try {
      const headerRange = formatA1Range(listsTabName, 'E2');
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: headerRange,
            majorDimension: 'ROWS',
            values: [['Color Tag']],
          }),
        }
      );
    } catch {
      // Header write optional
    }

    return res.ok;
  } catch (err) {
    console.warn('Google Sheets updateCustomViewers API error:', err);
    return false;
  }
}

export function normalizeSeasonStr(val: string | number | undefined): string {
  if (val === undefined || val === null || val === '') return 'S1';
  const str = String(val).trim();
  if (/^\d+$/.test(str)) return `S${str}`;
  if (/^[sS]\d+/.test(str)) return `S${str.slice(1)}`;
  return str;
}

export function normalizeEpisodeStr(val: string | number | undefined): string {
  if (val === undefined || val === null || val === '') return 'E1';
  const str = String(val).trim();
  if (/^\d+$/.test(str)) return `E${str}`;
  if (/^[eE]\d+/.test(str)) return `E${str.slice(1)}`;
  return str;
}

export function buildRowValues(show: ShowItem, headers: string[]): string[] {
  const isWishlist =
    Boolean(show.isWishlist) ||
    headers.some((h) => {
      const l = h.toLowerCase();
      return l.includes('priority') || l === 'done' || l.includes('date added') || l.includes('release year');
    });

  // Strict 8 Wishlist columns: Title | Type | Platform | Release Year | Priority | Date Added | DONE | Poster (Col H)
  if (isWishlist) {
    const isDone =
      show.status === '✅ Watched' ||
      String(show.status).toLowerCase().includes('watched') ||
      String(show.status).toUpperCase() === 'DONE';

    const posterVal = formatPosterForSheet(show.posterUrl || show.backdropUrl);
    const activeHeaders = headers && headers.length > 0 ? headers : DEFAULT_WISHLIST_HEADERS;
    const values: string[] = [];

    for (let i = 0; i < activeHeaders.length; i++) {
      const field = matchHeaderToField(activeHeaders[i], i);
      switch (field) {
        case 'title':
          values.push(show.title || '');
          break;
        case 'type':
          values.push(show.type || 'Movie');
          break;
        case 'platform':
          values.push(normalizePlatform(show.platform) || '📺 Netflix');
          break;
        case 'year':
          values.push(String(show.year || ''));
          break;
        case 'priority':
          values.push(normalizePriority(show.priority));
          break;
        case 'date_added':
          values.push(parseGoogleSheetsDate(show.dateAdded));
          break;
        case 'done':
          values.push(isDone ? 'TRUE' : 'FALSE');
          break;
        case 'poster':
          values.push(posterVal);
          break;
        case 'release_date':
          values.push(show.releaseDate || '');
          break;
        case 'release_note':
          values.push(show.releaseNote || '');
          break;
        case 'who':
          values.push(show.who || '');
          break;
        default:
          values.push('');
      }
    }
    return values;
  }

  // Master Tracker (16 columns)
  const isMovie = show.type === 'Movie';
  const activeHeaders =
    headers && headers.length > 0
      ? headers
      : DEFAULT_TRACKER_HEADERS;
  const values: string[] = [];

  for (let i = 0; i < activeHeaders.length; i++) {
    const field = matchHeaderToField(activeHeaders[i], i);
    console.log(`[Google Sheets BuildRowValues] Header: "${activeHeaders[i]}", Field: "${field}", Index: ${i}`);
    switch (field) {
      case 'title':
        values.push(show.title || '');
        break;
      case 'type':
        values.push(show.type || (isMovie ? 'Movie' : 'Series'));
        break;
      case 'platform':
        values.push(normalizePlatform(show.platform) || '📺 Netflix');
        break;
      case 'season':
        values.push(isMovie ? '' : (show.seasons ? normalizeSeasonStr(show.seasons) : ''));
        break;
      case 'episode':
        values.push(isMovie ? '' : (show.episodes ? normalizeEpisodeStr(show.episodes) : ''));
        break;
      case 'next_ep':
        values.push(isMovie ? 'FALSE' : (show.nextEp ? 'TRUE' : 'FALSE'));
        break;
      case 'next_ssn':
        values.push(isMovie ? 'FALSE' : (show.nextSsn ? 'TRUE' : 'FALSE'));
        break;
      case 'genre':
        values.push(show.genre || '');
        break;
      case 'year':
        values.push(String(show.year || ''));
        break;
      case 'status':
        values.push(show.status || '⏳ Watching');
        break;
      case 'rating':
        values.push(show.rating || '');
        break;
      case 'notes':
        values.push(show.notes || '');
        break;
      case 'who':
        values.push(show.who || '');
        break;
      case 'rating_num':
        values.push(show.ratingNum ? String(show.ratingNum) : '');
        break;
      case 'max_ep':
        values.push(isMovie ? '' : (show.maxEp ? normalizeEpisodeStr(show.maxEp) : ''));
        break;
      case 'poster':
        values.push(formatPosterForSheet(show.posterUrl));
        break;
      case 'backdrop':
        values.push(formatPosterForSheet(show.backdropUrl));
        break;
      case 'release_date':
        values.push(show.releaseDate || '');
        break;
      case 'release_note':
        values.push(show.releaseNote || '');
        break;
      case 'date_added':
        values.push(parseGoogleSheetsDate(show.dateAdded) || show.dateAdded || '');
        break;
      default:
        values.push('');
        break;
    }
  }

  return values;
}

export function colIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Ensures a 'Poster' header column exists in the connected Google Sheet.
 * If missing, writes 'Poster' into the next available column in Row 1.
 */
export async function ensurePosterColumnInSheet(
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  accessToken: string
): Promise<{ headers: string[]; posterColIndex: number; wasAdded: boolean }> {
  // Check if poster column already exists
  const existingIndex = headers.findIndex((h, i) => matchHeaderToField(h, i) === 'poster');
  if (existingIndex !== -1) {
    return { headers, posterColIndex: existingIndex, wasAdded: false };
  }
  // NEVER write to row 1. Return headers as-is.
  return { headers, posterColIndex: -1, wasAdded: false };
}

export async function clearRow1Poster(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<void> {
  try {
    const range = formatA1Range(sheetName, 'P1');
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    ).catch(() => {});
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values: [['']],
        }),
      }
    ).catch(() => {});
  } catch (e) {
    console.warn('Could not clear row 1 P1 poster:', e);
  }
}

export async function ensurePosterHeader(
  spreadsheetId: string,
  sheetName: string,
  isWishlist: boolean,
  accessToken: string,
  headers?: string[]
): Promise<void> {
  // NO-OP: Never write "Poster" to row 1. Always clean up P1.
  try {
    await clearRow1Poster(spreadsheetId, sheetName, accessToken);
  } catch (e) {
    console.warn('ensurePosterHeader cleanup notice:', e);
  }
}

export async function updateSheetRow(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  show: ShowItem,
  headers: string[],
  accessToken: string
): Promise<void> {
  // Safety protection: Never touch Rows 1–3 (headers/labels)
  if (rowNumber < 4) {
    console.warn(`Safety abort: Cannot update protected header/label row ${rowNumber}. Data starts at Row 4.`);
    return;
  }
  const isWishlist =
    Boolean(show.isWishlist) || sheetName.toLowerCase().includes('wishlist');
  let activeHeaders =
    headers && headers.length > 0
      ? headers
      : isWishlist
      ? DEFAULT_WISHLIST_HEADERS
      : DEFAULT_TRACKER_HEADERS;

  // If Wishlist show but passed Master Tracker headers with 'Season', use Wishlist headers
  if (isWishlist && activeHeaders.some((h) => h.toLowerCase().includes('season'))) {
    activeHeaders = DEFAULT_WISHLIST_HEADERS;
  }

  // If show has a poster or backdrop image, ensure the header cell is labeled at the correct column
  if (show.posterUrl || show.backdropUrl) {
    ensurePosterHeader(spreadsheetId, sheetName, isWishlist, accessToken, activeHeaders).catch(console.warn);
  }

  const rowValues = buildRowValues(show, activeHeaders);
  const maxColIndex = Math.max(activeHeaders.length - 1, rowValues.length - 1, 17);
  const endColLetter = isWishlist ? 'Z' : colIndexToLetter(maxColIndex);
  const finalValues = rowValues.slice(0, maxColIndex + 1);
  const a1Range = formatA1Range(sheetName, `A${rowNumber}:${endColLetter}${rowNumber}`);
  const encodedRange = encodeURIComponent(a1Range);

  // Note: Omit 'range' from the body in PUT requests to avoid 400 'Range in request body does not match range in URL' errors from Google Sheets API
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [finalValues],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update sheet row ${rowNumber}`);
  }
}

export async function updateEpisodeAndSeasonInSheet(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  seasons: string,
  episodes: string,
  headers: string[],
  accessToken: string,
  status?: string,
  nextEp?: boolean | string,
  nextSsn?: boolean | string,
  posterUrl?: string,
  maxEp?: string,
  rating?: string,
  ratingNum?: number,
  type?: string,
  releaseDate?: string,
  releaseNote?: string
): Promise<void> {
  // Safety protection: Never touch Rows 1–3 (headers/labels)
  if (rowNumber < 4) {
    console.warn(`Safety abort: Cannot update protected header/label row ${rowNumber}. Data starts at Row 4.`);
    return;
  }
  const isMovie = type === 'Movie' || (seasons === '' && episodes === '' && maxEp === '');
  const activeHeaders = headers && headers.length > 0 ? headers : DEFAULT_TRACKER_HEADERS;

  // Find column index for Season, Episode, Status, Next Ep, Next Ssn, Poster, Max Ep, Rating, Rating Num, Release Date, Release Note
  let ssnColIndex = -1;
  let epColIndex = -1;
  let statusColIndex = -1;
  let nextEpColIndex = -1;
  let nextSsnColIndex = -1;
  let posterColIndex = -1;
  let maxEpColIndex = -1;
  let ratingColIndex = -1;
  let ratingNumColIndex = -1;
  let releaseDateColIndex = -1;
  let releaseNoteColIndex = -1;

  for (let i = 0; i < activeHeaders.length; i++) {
    const f = matchHeaderToField(activeHeaders[i], i);
    if (f === 'season' && ssnColIndex === -1) ssnColIndex = i;
    else if (f === 'episode' && epColIndex === -1) epColIndex = i;
    else if (f === 'status' && statusColIndex === -1) statusColIndex = i;
    else if (f === 'next_ep' && nextEpColIndex === -1) nextEpColIndex = i;
    else if (f === 'next_ssn' && nextSsnColIndex === -1) nextSsnColIndex = i;
    else if (f === 'poster' && posterColIndex === -1) posterColIndex = i;
    else if (f === 'max_ep' && maxEpColIndex === -1) maxEpColIndex = i;
    else if (f === 'rating' && ratingColIndex === -1) ratingColIndex = i;
    else if (f === 'rating_num' && ratingNumColIndex === -1) ratingNumColIndex = i;
    else if (f === 'release_date' && releaseDateColIndex === -1) releaseDateColIndex = i;
    else if (f === 'release_note' && releaseNoteColIndex === -1) releaseNoteColIndex = i;
  }

  // Fallbacks based on standard template positions: Col D (3) = Season, Col E (4) = Episode, Col P (15) = Poster, Col O (14) = Max Ep
  if (ssnColIndex === -1) ssnColIndex = 3;
  if (epColIndex === -1) epColIndex = 4;
  if (statusColIndex === -1 && activeHeaders.length > 9) statusColIndex = 9;
  if (nextEpColIndex === -1 && activeHeaders.length > 5) nextEpColIndex = 5;
  if (nextSsnColIndex === -1 && activeHeaders.length > 6) nextSsnColIndex = 6;
  if (posterColIndex === -1 && activeHeaders.length > 15) posterColIndex = 15;
  if (maxEpColIndex === -1 && activeHeaders.length > 14) maxEpColIndex = 14;
  if (ratingColIndex === -1 && activeHeaders.length > 10) ratingColIndex = 10;
  if (ratingNumColIndex === -1 && activeHeaders.length > 13) ratingNumColIndex = 13;
  if (releaseDateColIndex === -1 && activeHeaders.length > 16) releaseDateColIndex = 16;
  if (releaseNoteColIndex === -1 && activeHeaders.length > 17) releaseNoteColIndex = 17;

  const dataToUpdate: Array<{ range: string; values: string[][] }> = [];

  // Season cell update (e.g. D2)
  dataToUpdate.push({
    range: formatA1Range(sheetName, `${colIndexToLetter(ssnColIndex)}${rowNumber}`),
    values: [[isMovie ? '' : normalizeSeasonStr(seasons)]],
  });

  // Episode cell update (e.g. E2)
  dataToUpdate.push({
    range: formatA1Range(sheetName, `${colIndexToLetter(epColIndex)}${rowNumber}`),
    values: [[isMovie ? '' : normalizeEpisodeStr(episodes)]],
  });

  // Status cell update (e.g. J2) if provided
  if (status && statusColIndex !== -1) {
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(statusColIndex)}${rowNumber}`),
      values: [[status]],
    });
  }

  // Next Ep boolean/checkbox update (e.g. F2) if provided
  if (nextEp !== undefined && nextEpColIndex !== -1) {
    const isEpTrue = !isMovie && (nextEp === true || String(nextEp).toLowerCase() === 'true');
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(nextEpColIndex)}${rowNumber}`),
      values: [[isEpTrue ? 'TRUE' : 'FALSE']],
    });
  }

  // Next Ssn boolean/checkbox update (e.g. G2) if provided
  if (nextSsn !== undefined && nextSsnColIndex !== -1) {
    const isSsnTrue = !isMovie && (nextSsn === true || String(nextSsn).toLowerCase() === 'true');
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(nextSsnColIndex)}${rowNumber}`),
      values: [[isSsnTrue ? 'TRUE' : 'FALSE']],
    });
  }

  // Poster update if provided and poster column exists
  if (posterUrl !== undefined && posterColIndex !== -1) {
    const formattedPoster = formatPosterForSheet(posterUrl);
    if (formattedPoster) {
      dataToUpdate.push({
        range: formatA1Range(sheetName, `${colIndexToLetter(posterColIndex)}${rowNumber}`),
        values: [[formattedPoster]],
      });
    }
  }

  // Max Ep cell update if provided (e.g. O2)
  if (maxEpColIndex !== -1) {
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(maxEpColIndex)}${rowNumber}`),
      values: [[isMovie ? '' : (maxEp ? normalizeEpisodeStr(maxEp) : '')]],
    });
  }

  // Rating cell update if provided (e.g. K2)
  if (rating !== undefined && ratingColIndex !== -1) {
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(ratingColIndex)}${rowNumber}`),
      values: [[rating]],
    });
  }

  // Rating num cell update if provided (e.g. N2)
  if (ratingNum !== undefined && ratingNumColIndex !== -1) {
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(ratingNumColIndex)}${rowNumber}`),
      values: [[ratingNum > 0 ? String(ratingNum) : '']],
    });
  }

  // Release Date cell update (clear if empty string, or write new value)
  if (releaseDate !== undefined && releaseDateColIndex !== -1) {
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(releaseDateColIndex)}${rowNumber}`),
      values: [[(releaseDate || '').trim()]],
    });
  }

  // Release Note cell update (clear if empty string, or write new value)
  if (releaseNote !== undefined && releaseNoteColIndex !== -1) {
    dataToUpdate.push({
      range: formatA1Range(sheetName, `${colIndexToLetter(releaseNoteColIndex)}${rowNumber}`),
      values: [[(releaseNote || '').trim()]],
    });
  }

  const batchPayload = {
    valueInputOption: 'USER_ENTERED',
    data: dataToUpdate,
  };

  console.log(`[Google Sheets batchUpdate Payload Inspector] Target: "${sheetName}" Row ${rowNumber}`);
  console.log(`[Google Sheets batchUpdate Payload Inspector] Total Cell Ranges to update: ${dataToUpdate.length}`);
  console.log('[Google Sheets batchUpdate Payload Inspector] Payload sent to API:', JSON.stringify(batchPayload, null, 2));

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchPayload),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update episode & season cells in row ${rowNumber}`);
  }
}

export async function appendSheetRow(
  spreadsheetId: string,
  sheetName: string,
  show: ShowItem,
  headers: string[],
  accessToken: string
): Promise<{ rowNumber?: number }> {
  const isWishlist =
    Boolean(show.isWishlist) ||
    sheetName.toLowerCase().includes('wishlist');

  // Check if title already exists in the sheet to prevent duplicates
  if (show.title) {
    const existingRow = await findRowNumberByTitle(spreadsheetId, sheetName, show.title, accessToken);
    if (existingRow && existingRow >= 4) {
      console.log(`[appendSheetRow] "${show.title}" already exists at row ${existingRow} in "${sheetName}". Updating row instead of appending duplicate.`);
      await updateSheetRow(spreadsheetId, sheetName, existingRow, show, headers, accessToken);
      return { rowNumber: existingRow };
    }
  }

  let targetHeaders = isWishlist ? DEFAULT_WISHLIST_HEADERS : headers;
  let nextRow = 4; // Rows 1–3 are headers/labels. Data starts at Row 4 downwards.

  // Inspect the live tab to identify the last used row starting from Row 4
  try {
    const checkRange = formatA1Range(sheetName, 'A1:ZZ1000');
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(checkRange)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (checkRes.ok) {
      const data = await checkRes.json();
      const rows: string[][] = data.values || [];

      // Find headers in Rows 1-3 if present
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        if (rows[i] && rows[i].some((c) => String(c).trim().toLowerCase() === 'title')) {
          if (!isWishlist) {
            targetHeaders = rows[i].map((c) => String(c).trim());
          }
          break;
        }
      }

      // Find last used data row starting strictly from Row 4 (0-based index 3)
      let lastUsedDataRow = 3; // 1-based Row 3 represents the header boundary
      for (let r = 3; r < rows.length; r++) {
        const row = rows[r];
        if (row && row.some((cell) => String(cell).trim() !== '')) {
          lastUsedDataRow = r + 1; // 1-based row number
        }
      }

      // If Row 4 is empty, lastUsedDataRow is 3 -> nextRow is 4.
      // If Row 4 has data, lastUsedDataRow is 4 -> nextRow is 5.
      // If Rows 4, 5, 6 have data, lastUsedDataRow is 6 -> nextRow is 7.
      nextRow = Math.max(4, lastUsedDataRow + 1);
    }
  } catch (e) {
    console.warn('Tab inspection notice before append:', e);
  }

  if (!targetHeaders || targetHeaders.length === 0) {
    targetHeaders = isWishlist ? DEFAULT_WISHLIST_HEADERS : DEFAULT_TRACKER_HEADERS;
  }

  // If show has a poster or backdrop image, ensure the header cell is labeled at the correct column
  if (show.posterUrl || show.backdropUrl) {
    ensurePosterHeader(spreadsheetId, sheetName, isWishlist, accessToken, targetHeaders).catch(console.warn);
  }

  const rowValues = buildRowValues(show, isWishlist ? DEFAULT_WISHLIST_HEADERS : targetHeaders);
  const posterIdx = targetHeaders.findIndex((h, i) => matchHeaderToField(h, i) === 'poster');
  const endColLetter = isWishlist ? 'Z' : colIndexToLetter(Math.max(targetHeaders.length - 1, rowValues.length - 1, isWishlist ? 7 : (posterIdx !== -1 ? posterIdx : 15)));
  const finalValues = rowValues;

  // 1. Direct write to the exact nextRow via PUT to ensure precision and prevent misplacement
  const targetA1Range = formatA1Range(sheetName, `A${nextRow}:${endColLetter}${nextRow}`);
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetA1Range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [finalValues],
      }),
    }
  );

  if (writeRes.ok) {
    return { rowNumber: nextRow };
  }

  // 2. Fallback to standard Google Sheets :append if PUT was rejected
  const a1Range = formatA1Range(sheetName, 'A4');
  const encodedRange = encodeURIComponent(a1Range);
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [finalValues],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to append new row to Google Sheets');
  }

  const data = await res.json().catch(() => ({}));
  let rowNumber: number | undefined = nextRow;
  const updatedRange = data.updates?.updatedRange || '';
  const match = updatedRange.match(/![A-Z]+(\d+)/);
  if (match && match[1]) {
    rowNumber = Math.max(4, parseInt(match[1], 10));
  }

  return { rowNumber };
}

export async function findRowNumberByTitle(
  spreadsheetId: string,
  sheetName: string,
  title: string,
  accessToken: string
): Promise<number | null> {
  try {
    const safeRange = formatA1Range(sheetName, 'A1:ZZ1000');
    const encodedRange = encodeURIComponent(safeRange);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rawRows: string[][] = data.values || [];

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[^a-z0-9]/g, '');

    const targetNorm = normalize(title);
    if (!targetNorm) return null;

    // First pass: exact normalized match on Column A starting strictly from Row 4 (r = 3) downwards
    for (let r = 3; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (row && row.length > 0) {
        const col0Norm = normalize(String(row[0] || ''));
        if (col0Norm === targetNorm) {
          return r + 1;
        }
      }
    }

    // Second pass: exact normalized match across any column starting from Row 4 (r = 3) downwards
    for (let r = 3; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (row) {
        for (let c = 0; c < row.length; c++) {
          if (normalize(String(row[c] || '')) === targetNorm) {
            return r + 1;
          }
        }
      }
    }

    // Third pass: substring match from Row 4 (r = 3) downwards
    for (let r = 3; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (row && row.length > 0) {
        const col0Norm = normalize(String(row[0] || ''));
        if (col0Norm.includes(targetNorm) || targetNorm.includes(col0Norm)) {
          return r + 1;
        }
      }
    }
  } catch (err) {
    console.warn('Could not find row number by title:', err);
  }
  return null;
}

export async function deleteSheetRow(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  sheetTabId: number | undefined,
  accessToken: string
): Promise<void> {
  // Safety protection: Never delete Rows 1–3 (headers/labels)
  if (rowNumber < 4) {
    console.warn(`Safety abort: Cannot delete protected header/label row ${rowNumber}.`);
    return;
  }
  let numericSheetId = sheetTabId;
  let resolvedSheetName = sheetName;

  if (numericSheetId === undefined) {
    try {
      const meta = await fetchSpreadsheetDetails(spreadsheetId, accessToken);
      let targetSheet = meta.sheets.find(
        (s) => s.title.trim().toLowerCase() === sheetName.trim().toLowerCase()
      );
      if (!targetSheet && sheetName.toLowerCase().includes('wishlist')) {
        const matchedWishlist = findMatchingWishlistSheet(meta.sheetNames);
        if (matchedWishlist) {
          targetSheet = meta.sheets.find((s) => s.title === matchedWishlist);
        }
      }
      if (!targetSheet && (sheetName.toLowerCase().includes('tracker') || sheetName.toLowerCase().includes('master'))) {
        const matchedMaster = findMatchingMasterSheet(meta.sheetNames);
        if (matchedMaster) {
          targetSheet = meta.sheets.find((s) => s.title === matchedMaster);
        }
      }
      if (targetSheet) {
        numericSheetId = targetSheet.id;
        resolvedSheetName = targetSheet.title;
      }
    } catch (e) {
      console.warn('Could not lookup numeric sheetId:', e);
    }
  }

  if (numericSheetId !== undefined) {
    // deleteDimension uses 0-indexed startIndex (inclusive) and endIndex (exclusive)
    const startIndex = rowNumber - 1;
    const endIndex = rowNumber;

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: numericSheetId,
                  dimension: 'ROWS',
                  startIndex,
                  endIndex,
                },
              },
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Failed to delete row ${rowNumber} from Google Sheets`
      );
    }
  } else {
    // Fallback: Clear the row content if numeric sheet tab ID could not be resolved
    const a1Range = formatA1Range(resolvedSheetName, `A${rowNumber}:Z${rowNumber}`);
    const encodedRange = encodeURIComponent(a1Range);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Failed to clear row ${rowNumber} in Google Sheets`
      );
    }
  }
}

/**
 * Checks if a sheet tab exists in the spreadsheet. If not, creates it and adds standard headers.
 * Accurately finds and reuses custom-named tabs like "📋  WISHLIST" to prevent creating duplicate sheets.
 */
export async function ensureSheetTabExists(
  spreadsheetId: string,
  sheetTabTitle: string,
  headers: string[],
  accessToken: string
): Promise<{ sheetId?: number; wasCreated: boolean; actualTitle: string }> {
  const meta = await fetchSpreadsheetDetails(spreadsheetId, accessToken);
  
  // 1. Direct match
  const directMatch = meta.sheets.find(
    (s) => s.title.trim().toLowerCase() === sheetTabTitle.trim().toLowerCase()
  );
  if (directMatch) {
    return { sheetId: directMatch.id, wasCreated: false, actualTitle: directMatch.title };
  }

  // 2. Wishlist intelligent match (e.g. "📋  WISHLIST" when user or code requested "Wishlist")
  if (sheetTabTitle.toLowerCase().includes('wishlist')) {
    const matchedWishlist = findMatchingWishlistSheet(meta.sheetNames);
    if (matchedWishlist) {
      const existing = meta.sheets.find((s) => s.title === matchedWishlist);
      return { sheetId: existing?.id, wasCreated: false, actualTitle: matchedWishlist };
    }
  }

  // 3. Master tracker intelligent match
  if (sheetTabTitle.toLowerCase().includes('tracker') || sheetTabTitle.toLowerCase().includes('master')) {
    const matchedMaster = findMatchingMasterSheet(meta.sheetNames);
    if (matchedMaster) {
      const existing = meta.sheets.find((s) => s.title === matchedMaster);
      return { sheetId: existing?.id, wasCreated: false, actualTitle: matchedMaster };
    }
  }

  // 4. Only create a new sheet tab in the spreadsheet if completely non-existent
  const addRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTabTitle,
              },
            },
          },
        ],
      }),
    }
  );

  if (!addRes.ok) {
    const err = await addRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create "${sheetTabTitle}" tab in Google Sheets`);
  }

  const addData = await addRes.json();
  const newSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;

  // Add header row to the newly created sheet
  const isWishlist = sheetTabTitle.toLowerCase().includes('wishlist');
  const activeHeaders =
    headers && headers.length > 0
      ? headers
      : isWishlist
      ? DEFAULT_WISHLIST_HEADERS
      : DEFAULT_TRACKER_HEADERS;
  const a1Range = formatA1Range(sheetTabTitle, 'A1');
  const encodedRange = encodeURIComponent(a1Range);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [activeHeaders],
      }),
    }
  ).catch(console.warn);

  return { sheetId: newSheetId, wasCreated: true, actualTitle: sheetTabTitle };
}

/**
 * Moves a show from one sheet tab to another (e.g. from Wishlist to Master Tracker).
 */
export async function moveShowBetweenTabs(
  spreadsheetId: string,
  fromSheet: string,
  toSheet: string,
  show: ShowItem,
  headers: string[],
  accessToken: string,
  fromSheetTabId?: number
): Promise<{ newRowNumber?: number; targetSheetName: string }> {
  const isTargetWishlist = toSheet.toLowerCase().includes('wishlist');
  const defaultTargetHeaders = isTargetWishlist
    ? DEFAULT_WISHLIST_HEADERS
    : DEFAULT_TRACKER_HEADERS;

  // 1. Ensure target and source sheet tabs exist and resolve actual tab names
  const targetRes = await ensureSheetTabExists(
    spreadsheetId,
    toSheet,
    defaultTargetHeaders,
    accessToken
  );
  const actualTargetSheet = targetRes.actualTitle || toSheet;

  let actualFromSheet = fromSheet;
  try {
    const isSourceWishlist = fromSheet.toLowerCase().includes('wishlist');
    const sourceRes = await ensureSheetTabExists(
      spreadsheetId,
      fromSheet,
      isSourceWishlist ? DEFAULT_WISHLIST_HEADERS : DEFAULT_TRACKER_HEADERS,
      accessToken
    );
    if (sourceRes.actualTitle) {
      actualFromSheet = sourceRes.actualTitle;
    }
  } catch (e) {
    console.warn('Could not resolve actual source sheet tab:', e);
  }

  // 2. Fetch target sheet's live headers if possible
  let targetHeaders = isTargetWishlist
    ? DEFAULT_WISHLIST_HEADERS
    : await getSheetTabHeaders(spreadsheetId, actualTargetSheet, accessToken);
  if (!targetHeaders || targetHeaders.length === 0) {
    targetHeaders = defaultTargetHeaders;
  }

  // 3. Append show to target sheet with strict field cleanup
  const todayStr = new Date().toISOString().split('T')[0];
  const showToAppend: ShowItem = {
    ...show,
    isWishlist: isTargetWishlist,
    sheetTabName: actualTargetSheet,
    status: (isTargetWishlist ? show.status : '⏳ Watching') as WatchStatus,
    dateAdded: isTargetWishlist ? (show.dateAdded ? parseGoogleSheetsDate(show.dateAdded) : parseGoogleSheetsDate(undefined)) : todayStr,
    priority: isTargetWishlist ? normalizePriority(show.priority) : undefined,
    seasons: isTargetWishlist ? '' : normalizeSeasonStr(show.seasons || 'S1'),
    episodes: isTargetWishlist ? '' : normalizeEpisodeStr(show.episodes || 'E1'),
    maxEp: isTargetWishlist ? '' : normalizeEpisodeStr(show.maxEp || 'E8'),
    posterUrl: show.posterUrl,
    backdropUrl: show.backdropUrl,
    releaseDate: show.releaseDate,
    releaseNote: show.releaseNote,
  };

  // Check if title is already in target sheet (e.g. from rapid double-click or previous sync)
  let targetRowNumber: number | undefined = undefined;
  try {
    const existingTargetRow = await findRowNumberByTitle(spreadsheetId, actualTargetSheet, show.title, accessToken);
    if (existingTargetRow) {
      console.warn(`"${show.title}" already exists in target sheet "${actualTargetSheet}" at row ${existingTargetRow}. Skipping duplicate append.`);
      targetRowNumber = existingTargetRow;
    }
  } catch (e) {
    console.warn('Could not check target sheet for existing title:', e);
  }

  if (!targetRowNumber) {
    const appendRes = await appendSheetRow(
      spreadsheetId,
      actualTargetSheet,
      showToAppend,
      targetHeaders,
      accessToken
    );
    targetRowNumber = appendRes.rowNumber;
  }

  // 4. Delete from original sheet (find by title first to ensure accurate index)
  let sourceRow: number | undefined = undefined;
  try {
    const found = await findRowNumberByTitle(spreadsheetId, actualFromSheet, show.title, accessToken);
    if (found) {
      sourceRow = found;
    }
  } catch (e) {
    console.warn('Could not find row by title before delete:', e);
  }

  if (!sourceRow) {
    sourceRow = show.rowNumber;
  }

  if (sourceRow) {
    await deleteSheetRow(spreadsheetId, actualFromSheet, sourceRow, fromSheetTabId, accessToken).catch((e) => {
      console.warn('Failed to delete from source sheet when moving show:', e);
    });
  }

  return { newRowNumber: targetRowNumber, targetSheetName: actualTargetSheet };
}



