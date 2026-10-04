// Memory cache for zero-latency, 100% reliable access across iOS WebKit & Desktop
const inMemoryTimestampMap = new Map<string, number>();

// Helper to normalize keys
export function normalizeTitleKey(str?: string | null): string {
  if (!str) return '';
  return str.trim().toLowerCase();
}

export function cleanTitleKey(str?: string | null): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Storage keys used across iOS & desktop browsers
const STORAGE_KEYS = [
  'bingebox_added_timestamps',
  'bingebox_session_added',
  'showflix_added_timestamps',
];

// Initialize in-memory cache from localStorage on startup
export function initTimestampStore(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    for (const key of STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'number' && v > 0) {
              inMemoryTimestampMap.set(k, v);
              inMemoryTimestampMap.set(normalizeTitleKey(k), v);
              inMemoryTimestampMap.set(cleanTitleKey(k), v);
            }
          }
        }
      }
    }
  } catch {
    // Ignore storage parse issues on iOS WebKit
  }
}

// Auto-run init
initTimestampStore();

/**
 * Record when a show was added. Writes to memory + all localStorage keys.
 */
export function recordShowAddedTime(id?: string, title?: string, timestamp: number = Date.now()): void {
  if (!id && !title) return;
  const ts = timestamp || Date.now();

  // 1. Update in-memory Map instantly (guaranteed on iOS even if localStorage throws)
  if (id) inMemoryTimestampMap.set(id, ts);
  if (title) {
    const raw = title.trim();
    const norm = normalizeTitleKey(raw);
    const clean = cleanTitleKey(raw);
    inMemoryTimestampMap.set(raw, ts);
    inMemoryTimestampMap.set(norm, ts);
    inMemoryTimestampMap.set(clean, ts);
    if (id) {
      inMemoryTimestampMap.set(`${id}::${clean}`, ts);
    }
  }

  // 2. Persist to localStorage safely
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (const key of STORAGE_KEYS) {
        let existingMap: Record<string, number> = {};
        try {
          const raw = localStorage.getItem(key);
          if (raw) existingMap = JSON.parse(raw) || {};
        } catch {}

        if (id) existingMap[id] = ts;
        if (title) {
          const raw = title.trim();
          const norm = normalizeTitleKey(raw);
          const clean = cleanTitleKey(raw);
          existingMap[raw] = ts;
          existingMap[norm] = ts;
          existingMap[clean] = ts;
        }

        localStorage.setItem(key, JSON.stringify(existingMap));
      }
    }
  } catch (e) {
    console.warn('Storage write error on iOS WebKit:', e);
  }
}

/**
 * Look up the add timestamp for a show from memory or localStorage.
 */
export function getShowAddedTimestamp(show?: { id?: string; title?: string } | null): number | undefined {
  if (!show) return undefined;

  // 1. Fresh storage check on every call (no stale cached data)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (const key of STORAGE_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const map = JSON.parse(raw);
          if (map) {
            const rawTitle = (show.title || '').trim();
            const normTitle = normalizeTitleKey(rawTitle);
            const cleanTitle = cleanTitleKey(rawTitle);
            const val =
              (show.id && map[show.id]) ||
              (rawTitle && map[rawTitle]) ||
              (normTitle && map[normTitle]) ||
              (cleanTitle && map[cleanTitle]);
            if (typeof val === 'number' && val > 0) {
              return val;
            }
          }
        }
      }
    }
  } catch {}

  // 2. In-memory fallback lookup
  if (show.id && inMemoryTimestampMap.has(show.id)) {
    return inMemoryTimestampMap.get(show.id);
  }
  if (show.title) {
    const raw = show.title.trim();
    const norm = normalizeTitleKey(raw);
    const clean = cleanTitleKey(raw);
    if (inMemoryTimestampMap.has(raw)) return inMemoryTimestampMap.get(raw);
    if (inMemoryTimestampMap.has(norm)) return inMemoryTimestampMap.get(norm);
    if (inMemoryTimestampMap.has(clean)) return inMemoryTimestampMap.get(clean);
  }

  return undefined;
}

// Detect iOS devices (iPhone, iPad, iPod, or iPad on iOS 13+ desktop mode)
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadSafari = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
  return isIOS || isIPadSafari;
}

/**
 * Background verification check that runs during Google Sheet sync:
 * 1. Checks every show to confirm its add-time timestamp metadata exists in localStorage and memory.
 * 2. If any timestamp is missing (especially on iOS devices where WebKit may purge storage),
 *    it recalculates and re-triggers timestamp recording across all localStorage keys.
 */
export function verifyAndBackfillShowTimestamps(
  shows: Array<{
    id?: string;
    title?: string;
    createdTimestamp?: number;
    sessionAddedAt?: number;
    dateAdded?: string;
    addedRank?: number;
  }>
): { verifiedCount: number; healedCount: number; isIOS: boolean } {
  const isIOS = isIOSDevice();
  let healedCount = 0;
  let verifiedCount = 0;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const show of shows) {
    if (!show || (!show.id && !show.title)) continue;
    verifiedCount++;

    const existingTs = getShowAddedTimestamp(show);
    let resolvedTs = existingTs;

    // Check if show has an explicit createdTimestamp or sessionAddedAt
    if (!resolvedTs && typeof show.createdTimestamp === 'number' && show.createdTimestamp > 0) {
      resolvedTs = show.createdTimestamp;
    }
    if (!resolvedTs && typeof show.sessionAddedAt === 'number' && show.sessionAddedAt > 0) {
      resolvedTs = show.sessionAddedAt;
    }

    // Check if show has a dateAdded string (e.g. DD-MM-YYYY)
    if (!resolvedTs && show.dateAdded) {
      const matchDDMM = String(show.dateAdded).match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
      if (matchDDMM) {
        const [_, d, m, y] = matchDDMM;
        const parsed = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        if (!isNaN(parsed.getTime())) {
          resolvedTs = parsed.getTime();
        }
      }
    }

    // If metadata was missing or only partially recorded, re-trigger timestamp recording
    if (resolvedTs && resolvedTs > 0) {
      // Re-trigger to guarantee persistent keys on iOS
      recordShowAddedTime(show.id, show.title, resolvedTs);
      if (!existingTs) {
        healedCount++;
      }
    }
  }

  if (healedCount > 0) {
    console.log(
      `[Timestamp Verification] ${isIOS ? '📱 iOS' : '💻 Desktop'}: Verified ${verifiedCount} shows, healed & recorded ${healedCount} missing timestamps in localStorage.`
    );
  }

  return { verifiedCount, healedCount, isIOS };
}
