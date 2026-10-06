import { ShowItem } from '../types';
import { parseAnyDate } from './dateUtils';

/**
 * Normalizes and extracts numeric rating (1-5) from ratingNum or rating string.
 */
export function getShowRatingNumber(show: ShowItem): number {
  if (typeof show.ratingNum === 'number' && show.ratingNum > 0) {
    return show.ratingNum;
  }
  if (!show.rating) return 0;

  const str = String(show.rating).toLowerCase().trim();

  // Count star emojis if present
  const starCount = (str.match(/⭐/g) || []).length;
  if (starCount > 0) return starCount;

  // Text keyword matching
  if (str.includes('excellent') || str.includes('5 star') || str.includes('masterpiece') || str.includes('5/5')) return 5;
  if (str.includes('great') || str.includes('4 star') || str.includes('4/5')) return 4;
  if (str.includes('good') || str.includes('3 star') || str.includes('3/5')) return 3;
  if (str.includes('fair') || str.includes('2 star') || str.includes('2/5')) return 2;
  if (str.includes('poor') || str.includes('1 star') || str.includes('1/5')) return 1;

  // Parse leading numbers e.g. "4.5", "5"
  const match = str.match(/^([1-5])(\.[0-9])?/);
  if (match) {
    return Math.min(5, Math.max(1, parseFloat(match[0])));
  }

  return 0;
}

/**
 * Returns true if the show has a 4 or 5 star rating (Masterpiece / Top Rated).
 */
export function isTopRatedShow(show: ShowItem): boolean {
  return getShowRatingNumber(show) >= 4;
}

/**
 * Calculates standardized progress percentage (0 - 100) for a show or movie.
 * - For Movies (type === 'Movie'):
 *   - Watched -> 100%
 *   - Watching / In Progress / Paused -> 50%
 *   - Not Started / Wishlist -> 0%
 * - For TV Series:
 *   - Watched -> 100%
 *   - Watching -> calculated (episodes / maxEp) * 100 (min 10% when watching)
 */
export function calculateShowProgress(show: ShowItem): number {
  if (!show) return 0;

  const isMovie =
    show.type === 'Movie' ||
    String(show.maxEp || '').toLowerCase().includes('movie') ||
    String(show.episodes || '').toLowerCase().includes('movie') ||
    (parseInt(String(show.maxEp || '').replace(/[^0-9]/g, '')) === 1 &&
      parseInt(String(show.seasons || '').replace(/[^0-9]/g, '')) <= 1);

  const statusStr = String(show.status || '').toLowerCase();
  const isWatched = statusStr.includes('watched') || statusStr.includes('completed') || statusStr.includes('✅');
  const isWatching = statusStr.includes('watching') || statusStr.includes('in progress') || statusStr.includes('⏳');
  const isPaused = statusStr.includes('paused') || statusStr.includes('⏸️');

  if (isMovie) {
    if (isWatched) return 100;
    if (isWatching || isPaused) return 50;

    const curEp = parseInt(String(show.episodes || '').replace(/[^0-9]/g, '')) || 0;
    if (curEp >= 1) return 100;

    return 0;
  }

  // TV Series
  if (isWatched) return 100;

  const currentEpNum = parseInt(String(show.episodes || '').replace(/[^0-9]/g, '')) || 0;
  const maxEpNum = Math.max(1, parseInt(String(show.maxEp || '').replace(/[^0-9]/g, '')) || 8);

  let progress = Math.min(100, Math.max(0, Math.round((currentEpNum / maxEpNum) * 100)));

  if (isWatching && progress === 0) {
    progress = 10;
  }

  return progress;
}

/**
 * Calculates standardized stats across the app.
 */
export function calculateStandardStats(shows: ShowItem[]) {
  const masterShows = shows.filter((s) => !s.isWishlist && s.status !== ('🎁 Wishlist' as any));
  const wishlistShows = shows.filter((s) => s.isWishlist || s.status === ('🎁 Wishlist' as any));

  const watched = shows.filter((s) => s.status === '✅ Watched');
  const watching = shows.filter((s) => s.status === '⏳ Watching');
  const paused = shows.filter((s) => s.status === '⏸️ Paused');
  const dropped = shows.filter((s) => s.status === '❌ Dropped');

  const topRated = shows.filter(isTopRatedShow);

  const movies = shows.filter((s) => s.type === 'Movie');
  const series = shows.filter((s) => s.type === 'Series');

  // Master Tracker Completion Rate (excluding wishlist items)
  const masterCompletionRate =
    masterShows.length > 0 ? Math.round((watched.length / masterShows.length) * 100) : 0;

  // Total Library Completion Rate (including wishlist)
  const totalCompletionRate =
    shows.length > 0 ? Math.round((watched.length / shows.length) * 100) : 0;

  return {
    totalShows: shows.length,
    masterShowsCount: masterShows.length,
    wishlistShowsCount: wishlistShows.length,
    watchedCount: watched.length,
    watchingCount: watching.length,
    pausedCount: paused.length,
    droppedCount: dropped.length,
    topRatedCount: topRated.length,
    moviesCount: movies.length,
    seriesCount: series.length,
    masterCompletionRate,
    totalCompletionRate,
  };
}

/**
 * Normalizes title for duplicate detection and comparison (lower-cased, alphanumeric only, diacritics stripped).
 */
export function normalizeTitleForComparison(title: string): string {
  if (!title) return '';
  return String(title)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Deterministically deduplicates shows without dropping separate sheet rows or Wishlist/Master items.
 */
export function deduplicateShowsByTitle(showList: ShowItem[]): ShowItem[] {
  if (!showList || showList.length === 0) return [];

  const map = new Map<string, ShowItem>();

  for (const show of showList) {
    if (!show) continue;
    const normTitle = normalizeTitleForComparison(show.title);
    if (!normTitle && !show.id) continue;

    const viewerKey = String(show.who || '').trim().toLowerCase();
    const primaryKey = normTitle ? `title:${normTitle}::${viewerKey}` : `id:${show.id}`;

    const existing = map.get(primaryKey);
    if (!existing) {
      map.set(primaryKey, show);
    } else {
      const existingRank = Math.max(existing.addedTime || 0, existing.addedRank || 0, existing.sortOrderNum || 0, existing.createdTimestamp || 0);
      const newRank = Math.max(show.addedTime || 0, show.addedRank || 0, show.sortOrderNum || 0, show.createdTimestamp || 0);

      // Master status safeguard: If one item is Master and the other is Wishlist, favor the Master item or the one updated most recently
      let isWishlistFinal = existing.isWishlist;
      if (existing.isWishlist !== show.isWishlist) {
        if (!existing.isWishlist && show.isWishlist) {
          isWishlistFinal = newRank > (existingRank + 1000) ? true : false;
        } else if (existing.isWishlist && !show.isWishlist) {
          isWishlistFinal = false;
        }
      }

      const shouldReplace = newRank >= existingRank;

      if (shouldReplace) {
        map.set(primaryKey, {
          ...existing,
          ...show,
          isWishlist: isWishlistFinal,
          posterUrl: show.posterUrl || existing.posterUrl,
          backdropUrl: show.backdropUrl || existing.backdropUrl,
          notes: show.notes || existing.notes,
          releaseDate: show.releaseDate || existing.releaseDate,
          releaseNote: show.releaseNote || existing.releaseNote,
          who: show.who || existing.who,
          genre: show.genre || existing.genre,
          year: show.year || existing.year,
          ratingNum: show.ratingNum || existing.ratingNum,
          rating: show.rating || existing.rating,
          imdbId: show.imdbId || existing.imdbId,
        });
      } else {
        map.set(primaryKey, {
          ...show,
          ...existing,
          isWishlist: isWishlistFinal,
          posterUrl: existing.posterUrl || show.posterUrl,
          backdropUrl: existing.backdropUrl || show.backdropUrl,
          notes: existing.notes || show.notes,
          releaseDate: existing.releaseDate || show.releaseDate,
          releaseNote: existing.releaseNote || show.releaseNote,
          who: existing.who || existing.who,
          genre: existing.genre || existing.genre,
          year: existing.year || existing.year,
          ratingNum: existing.ratingNum || existing.ratingNum,
          rating: existing.rating || existing.rating,
          imdbId: existing.imdbId || existing.imdbId,
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Rebuilds pure numeric `addedRank` directly from Sheet data on every load.
 * Clears any stale iOS or browser cache.
 * Higher rowNumber = appended later = higher addedRank = newest = first.
 * Completely ignores all timestamps/dates for 100% cross-platform parity.
 */
export function rebuildSheetAddedRanks(showList: ShowItem[]): ShowItem[] {
  if (!showList || showList.length === 0) return [];
  return showList.map((show, idx) => {
    const rowNum = typeof show.rowNumber === 'number' && !isNaN(show.rowNumber) && show.rowNumber > 0
      ? show.rowNumber
      : idx + 1;
    // Master tab gets bonus 2, Wishlist gets bonus 1 for deterministic tie-break across tabs
    const tabBonus = show.isWishlist ? 1 : 2;
    const computedRank = rowNum * 10 + tabBonus;
    const finalRank =
      typeof show.addedRank === 'number' && show.addedRank > computedRank
        ? show.addedRank
        : (typeof show.sortOrderNum === 'number' && show.sortOrderNum > computedRank
          ? show.sortOrderNum
          : computedRank);

    return {
      ...show,
      addedTime: show.addedTime || Date.now(),
      addedRank: finalRank,
      sortOrderNum: finalRank,
    };
  });
}

export const ensureSortOrderNumbers = rebuildSheetAddedRanks;

/**
 * Sort ONLY by highest score descending (highest = newest = first).
 * Ensures newly added or moved titles immediately appear at the top/front.
 * Evaluates the precise millisecond addition timestamp of each show first,
 * falling back to sheet dateAdded and rowNumber for 100% stable cross-sync ordering.
 */
export function compareByAddedRank(a: ShowItem, b: ShowItem): number {
  if (a.id === b.id) return 0;

  // Determine effective millisecond addition timestamp
  const parseTime = (s: ShowItem) => {
    const hasRow = typeof s.rowNumber === 'number' && !isNaN(s.rowNumber) && s.rowNumber > 0;
    if (!hasRow) {
      // Local unsynced show: trust precise millisecond timestamp
      const rawTs = s.createdTimestamp || s.sessionAddedAt || s.addedTime;
      if (typeof rawTs === 'number' && rawTs > 0) return rawTs;
    } else {
      // Synced sheet show: only trust preserved session/created timestamps
      const rawTs = s.createdTimestamp || s.sessionAddedAt;
      if (typeof rawTs === 'number' && rawTs > 0) return rawTs;
    }
    if (s.dateAdded) {
      const parsed = parseAnyDate(s.dateAdded);
      if (parsed) return parsed.getTime();
    }
    return 0;
  };

  const timeA = parseTime(a);
  const timeB = parseTime(b);

  // 1. Sort by timestamp descending if they differ
  if (timeA !== timeB) {
    return timeB - timeA;
  }

  // 2. Unsynced local titles with no row number should come before synced ones with row number
  const hasRowA = typeof a.rowNumber === 'number' && !isNaN(a.rowNumber) && a.rowNumber > 0;
  const hasRowB = typeof b.rowNumber === 'number' && !isNaN(b.rowNumber) && b.rowNumber > 0;
  if (!hasRowA && hasRowB) return -1;
  if (hasRowA && !hasRowB) return 1;

  // 3. Fallback to Google Sheet row number descending (highest row number = appended later = more recent)
  const rowA = a.rowNumber || 0;
  const rowB = b.rowNumber || 0;
  if (rowA !== rowB) {
    return rowB - rowA;
  }

  return b.id.localeCompare(a.id);
}

export const compareRecentlyAdded = compareByAddedRank;

/**
 * Robust helper to check if a show belongs to Wishlist (by boolean flag, sheet tab name, or status).
 */
export function isWishlistShow(s?: ShowItem | null): boolean {
  if (!s) return false;
  if (s.isWishlist === true || String(s.isWishlist) === 'true') return true;
  if (s.sheetTabName && String(s.sheetTabName).toLowerCase().includes('wishlist')) return true;
  if (s.status && (String(s.status).includes('Wishlist') || String(s.status).includes('🎁'))) return true;
  return false;
}
