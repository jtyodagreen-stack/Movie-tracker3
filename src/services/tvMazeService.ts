export interface TvMazeEpisode {
  id: number;
  url: string;
  name: string;
  season: number;
  number: number;
  airdate: string;
  airtime: string;
  airstamp: string;
  runtime: number;
  summary?: string;
}

export interface TvMazeShowInfo {
  id: number;
  name: string;
  status: string; // "Running", "Ended", "To Be Determined", "In Development"
  premiered?: string;
  officialSite?: string;
  nextEpisode?: TvMazeEpisode;
  previousEpisode?: TvMazeEpisode;
  outNowEpisode?: TvMazeEpisode;
}

/**
 * Extracts the exact epoch timestamp in milliseconds for a TVMaze episode.
 * Prioritizes the definitive ISO airstamp (with network timezone), falling back to airdate + airtime.
 */
export function getTvMazeEpisodeTimestamp(ep?: TvMazeEpisode | null): number | null {
  if (!ep) return null;
  if (ep.airstamp) {
    const ts = new Date(ep.airstamp).getTime();
    if (!isNaN(ts)) return ts;
  }
  if (ep.airdate) {
    const timeStr = ep.airtime && /^\d{1,2}:\d{2}$/.test(ep.airtime) ? ep.airtime : '20:00';
    const ts = new Date(`${ep.airdate}T${timeStr}:00`).getTime();
    if (!isNaN(ts)) return ts;
  }
  return null;
}

// In-memory cache for fast instant lookups across cards & modals
const tvMazeMemoryCache = new Map<string, TvMazeShowInfo | null>();

/**
 * Searches TVMaze for a given show title and returns embedded next/previous episode details
 */
export async function fetchLiveTvMazeInfo(title: string): Promise<TvMazeShowInfo | null> {
  if (!title || title.trim().length < 2) return null;

  const cleanKey = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (tvMazeMemoryCache.has(cleanKey)) {
    return tvMazeMemoryCache.get(cleanKey) || null;
  }

  try {
    const trimmed = title.trim();
    const idMatch = trimmed.match(/(tt\d+)/i);
    let data: any = null;

    if (idMatch) {
      // Direct IMDb ID lookup on TVMaze
      const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${idMatch[1]}`);
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        if (lookupData && lookupData.id) {
          const detailRes = await fetch(`https://api.tvmaze.com/shows/${lookupData.id}?embed[]=nextepisode&embed[]=previousepisode&embed[]=episodes`);
          if (detailRes.ok) {
            data = await detailRes.json();
          } else {
            data = lookupData;
          }
        }
      }
    }

    if (!data) {
      // Clean URL if present and query TVMaze single search
      const cleanTitle = trimmed.replace(/https?:\/\/[^\s]+/gi, '').trim() || trimmed;
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed[]=nextepisode&embed[]=previousepisode&embed[]=episodes`;
      const res = await fetch(url);
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback to general search query
        try {
          const searchRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanTitle)}`);
          if (searchRes.ok) {
            const searchResults = await searchRes.json();
            if (Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0].show?.id) {
              const showId = searchResults[0].show.id;
              const detailRes = await fetch(`https://api.tvmaze.com/shows/${showId}?embed[]=nextepisode&embed[]=previousepisode&embed[]=episodes`);
              if (detailRes.ok) {
                data = await detailRes.json();
              }
            }
          }
        } catch {
          // ignore fallback error
        }
      }
    }

    if (!data) {
      tvMazeMemoryCache.set(cleanKey, null);
      return null;
    }

    const showInfo: TvMazeShowInfo = {
      id: data.id,
      name: data.name,
      status: data.status,
      premiered: data.premiered,
      officialSite: data.officialSite,
    };

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    if (data._embedded) {
      const episodesList: TvMazeEpisode[] = Array.isArray(data._embedded.episodes) ? data._embedded.episodes : [];
      const embeddedPrev: TvMazeEpisode | undefined = data._embedded.previousepisode;
      const embeddedNext: TvMazeEpisode | undefined = data._embedded.nextepisode;

      // 1. Check if embeddedNext has already reached its airstamp
      const nextEpTs = getTvMazeEpisodeTimestamp(embeddedNext);
      const prevEpTs = getTvMazeEpisodeTimestamp(embeddedPrev);

      // 2. Identify if an episode is currently within its exact 24h OUT NOW window
      // Starts at exact airstamp (now >= ts) and stays for full 24h (now < ts + 24h)
      let activeOutNow: TvMazeEpisode | undefined;
      if (embeddedNext && nextEpTs !== null && now >= nextEpTs && now < nextEpTs + TWENTY_FOUR_HOURS_MS) {
        activeOutNow = embeddedNext;
      } else if (embeddedPrev && prevEpTs !== null && now >= prevEpTs && now < prevEpTs + TWENTY_FOUR_HOURS_MS) {
        activeOutNow = embeddedPrev;
      } else if (episodesList.length > 0) {
        activeOutNow = episodesList.find((ep) => {
          const t = getTvMazeEpisodeTimestamp(ep);
          return t !== null && now >= t && now < t + TWENTY_FOUR_HOURS_MS;
        });
      }

      if (activeOutNow) {
        showInfo.outNowEpisode = activeOutNow;
        showInfo.previousEpisode = activeOutNow;
      } else if (embeddedPrev) {
        showInfo.previousEpisode = embeddedPrev;
      }

      // 3. Identify the true upcoming future episode (strictly where epTs > now)
      if (embeddedNext && nextEpTs !== null && nextEpTs > now) {
        showInfo.nextEpisode = embeddedNext;
      } else if (episodesList.length > 0) {
        const trueFutureEp = episodesList.find((ep) => {
          const t = getTvMazeEpisodeTimestamp(ep);
          return t !== null && t > now;
        });
        if (trueFutureEp) {
          showInfo.nextEpisode = trueFutureEp;
        }
      }
    }

    tvMazeMemoryCache.set(cleanKey, showInfo);
    return showInfo;
  } catch (err) {
    console.warn('TVMaze fetch error:', err);
    return null;
  }
}
