import React from 'react';
import toast from 'react-hot-toast';
import { ShowItem, AlertIntervals } from '../types';
import { formatToLocalDisplay } from '../utils/dateUtils';
import { TvMazeEpisode, TvMazeShowInfo, getTvMazeEpisodeTimestamp } from './tvMazeService';

const NOTIF_KEY = 'showtracker_24h_notifications';
const NOTIFIED_KEY = 'showtracker_sent_notifications';
const INTERVALS_KEY = 'showtracker_alert_intervals';
const MUTED_KEY = 'showtracker_muted_notifications';

export function getMutedShowIds(): string[] {
  try {
    const raw = localStorage.getItem(MUTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveMutedShowIds(ids: string[]) {
  try {
    localStorage.setItem(MUTED_KEY, JSON.stringify(ids));
  } catch (e) {}
}

export const DEFAULT_ALERT_INTERVALS: AlertIntervals = {
  oneWeek: false,
  threeDays: false,
  oneDay: true,
  oneHour: true,
  atRelease: true,
};

export function getAlertIntervals(): AlertIntervals {
  try {
    const raw = localStorage.getItem(INTERVALS_KEY);
    return raw ? { ...DEFAULT_ALERT_INTERVALS, ...JSON.parse(raw) } : DEFAULT_ALERT_INTERVALS;
  } catch (e) {
    return DEFAULT_ALERT_INTERVALS;
  }
}

export function saveAlertIntervals(intervals: AlertIntervals) {
  try {
    localStorage.setItem(INTERVALS_KEY, JSON.stringify(intervals));
  } catch (e) {}
}

export function getNotificationShowIds(): string[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function isNotificationEnabled(showOrId: ShowItem | string, optionalTitle?: string): boolean {
  const id = typeof showOrId === 'string' ? showOrId : showOrId.id;
  const title = optionalTitle || (typeof showOrId === 'object' ? showOrId.title : '');

  // 1. Check if explicitly muted / blacklisted
  const muted = getMutedShowIds();
  if (id && muted.includes(id)) return false;

  // 2. Check if explicitly enabled
  const ids = getNotificationShowIds();
  if (ids.includes(id)) return true;
  
  if (title) {
    const cleanTitle = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTitle) {
      if (ids.includes(`title:${cleanTitle}`)) return true;
      if (ids.some((storedId) => storedId.toLowerCase().includes(cleanTitle))) return true;
    }
  }

  // Check title slug in ID (e.g. "show-mastertracker-12-[#slug]")
  if (id) {
    const parts = id.split('-');
    const slug = parts[parts.length - 1];
    if (slug && slug.length >= 3 && ids.some((storedId) => storedId.toLowerCase().includes(slug))) {
      return true;
    }
  }

  // 3. Auto-active if the show has an upcoming / release date
  if (typeof showOrId === 'object') {
    const hasRelease = Boolean(
      showOrId.releaseDate || 
      showOrId.releaseNote || 
      showOrId.nextAirDate || 
      showOrId.nextAirTimestamp
    );
    if (hasRelease) return true;
  }

  return false;
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.warn('Browser notification permission request skipped/blocked by iframe context:', e);
  }

  return false;
}

/**
 * Dispatches a custom Premiere Reminder alert
 */
export function sendIntervalNotificationAlert(show: ShowItem, intervalLabel: string) {
  const title = show.title;
  const platform = show.platform || 'TV';
  const releaseInfo = show.releaseDate || show.releaseNote || 'Soon';

  // In-App Toast Alert Card
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out'
        } max-w-md w-full bg-zinc-950 border-2 border-amber-500/80 shadow-2xl rounded-xl p-4 pointer-events-auto flex items-start gap-3.5 text-white ring-1 ring-amber-500/30`}
      >
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 text-amber-400 text-xl font-black shadow">
          ⏰
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
              🔔 {intervalLabel} Alert
            </span>
            <span className="text-[10px] font-mono text-zinc-400">COMING SOON</span>
          </div>
          <h4 className="text-sm font-black text-white truncate">{title}</h4>
          <p className="text-xs text-amber-200/90 leading-snug">
            Premieres in <span className="text-amber-400 font-bold">{intervalLabel}</span> on <span className="text-amber-400 font-bold">{platform}</span>! ({releaseInfo})
          </p>
        </div>
      </div>
    ),
    { duration: 7000 }
  );

  // Native Browser Notification
  const msg = `${title} premieres in ${intervalLabel} on ${platform}! (${releaseInfo})`;
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`⏰ ${intervalLabel} Alert: ${title}`, {
        body: msg,
        icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
      });
    } catch (e) {
      console.warn('Native notification notice:', e);
    }
  } else {
    requestBrowserNotificationPermission().then((granted) => {
      if (granted) {
        try {
          new Notification(`⏰ ${intervalLabel} Alert: ${title}`, {
            body: msg,
            icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
          });
        } catch (e) {}
      }
    });
  }
}

/**
 * Dispatches 24h Premiere Reminder alert
 */
export function send24hNotificationAlert(show: ShowItem) {
  sendIntervalNotificationAlert(show, '24 Hours');
}

/**
 * Dispatches "OUT NOW!" release moment alert when countdown reaches 00:00:00
 */
export function sendOutNowNotificationAlert(show: ShowItem) {
  const title = show.title;
  const platform = show.platform || 'TV';

  // In-App Toast Alert Card
  toast.custom(
    (t) => (
      <div
        onClick={() => toast.dismiss(t.id)}
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out'
        } max-w-md w-full bg-zinc-950 border-2 border-emerald-500/90 shadow-2xl rounded-xl p-4 pointer-events-auto flex items-start gap-3.5 text-white ring-1 ring-emerald-500/40 cursor-pointer`}
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 text-emerald-400 text-xl font-black shadow animate-bounce">
          🎉
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
              🎉 OUT NOW!
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">RELEASED</span>
          </div>
          <h4 className="text-sm font-black text-white truncate">{title}</h4>
          <p className="text-xs text-emerald-200/90 leading-snug">
            Available to watch now on <span className="text-emerald-300 font-bold">{platform}</span>!
          </p>
        </div>
      </div>
    ),
    { duration: 7000 }
  );

  // Native Browser Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`🎉 OUT NOW: ${title}!`, {
        body: `${title} is now available to watch on ${platform}!`,
        icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
        requireInteraction: true,
      });
    } catch (e) {
      console.warn('Native notification notice:', e);
    }
  } else {
    requestBrowserNotificationPermission().then((granted) => {
      if (granted) {
        try {
          new Notification(`🎉 OUT NOW: ${title}!`, {
            body: `${title} is now available to watch on ${platform}!`,
            icon: show.posterUrl || show.backdropUrl || '/favicon.ico',
            requireInteraction: true,
          });
        } catch (e) {}
      }
    });
  }
}

export async function toggleShowNotification(showOrItem: ShowItem | { id: string; title: string; platform?: string }): Promise<boolean> {
  const ids = getNotificationShowIds();
  const show = typeof showOrItem === 'string' ? { id: showOrItem, title: showOrItem } : showOrItem;
  
  const cleanTitle = show.title ? show.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const titleKey = cleanTitle ? `title:${cleanTitle}` : '';

  const currentlyActive = isNotificationEnabled(show.id, show.title);

  let newValue: boolean;
  if (currentlyActive) {
    // Disable notification - only explicit manual toggle removes it!
    const muted = getMutedShowIds();
    if (show.id && !muted.includes(show.id)) {
      muted.push(show.id);
      saveMutedShowIds(muted);
    }

    const updated = ids.filter((id) => {
      if (id === show.id) return false;
      if (titleKey && id === titleKey) return false;
      if (cleanTitle && cleanTitle.length >= 3 && id.toLowerCase().includes(cleanTitle)) return false;
      return true;
    });
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    newValue = false;

    toast.custom(
      (t) => (
        <div
          onClick={() => toast.dismiss(t.id)}
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out'
          } max-w-md w-full bg-zinc-950 border border-zinc-800 shadow-2xl rounded-xl p-3.5 pointer-events-auto flex items-start gap-3 text-white ring-1 ring-zinc-800/50 cursor-pointer`}
        >
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 text-lg font-black shadow">
            🔕
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                🔕 24h Alert Muted
              </span>
              <span className="text-[10px] font-mono text-zinc-500 font-semibold">DISABLED</span>
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">{show.title}</h4>
            <p className="text-[11px] text-zinc-400 leading-snug">
              24-hour premiere notifications disabled for this title.
            </p>
          </div>
        </div>
      ),
      { duration: 4000 }
    );
  } else {
    // Enable notification - store both ID and title key so sync reloads never turn it off
    const muted = getMutedShowIds();
    const updatedMuted = muted.filter((id) => id !== show.id);
    saveMutedShowIds(updatedMuted);

    const toAdd = [show.id];
    if (titleKey) toAdd.push(titleKey);

    const updated = Array.from(new Set([...ids, ...toAdd]));
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    newValue = true;

    toast.custom(
      (t) => (
        <div
          onClick={() => toast.dismiss(t.id)}
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out'
          } max-w-md w-full bg-zinc-950 border-2 border-amber-500/80 shadow-2xl shadow-amber-950/40 rounded-xl p-3.5 pointer-events-auto flex items-start gap-3 text-white ring-1 ring-amber-500/40 cursor-pointer`}
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 text-amber-400 text-lg font-black shadow animate-pulse">
            🔔
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                🔔 24h Release Alert Active
              </span>
              <span className="text-[10px] font-mono text-amber-400 font-extrabold bg-amber-500/20 px-1.5 py-0.5 rounded">
                ENABLED
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">{show.title}</h4>
            <p className="text-[11px] text-amber-200/90 leading-snug">
              You will be alerted 24 hours before release on <span className="text-amber-400 font-bold">{show.platform || 'TV'}</span>!
            </p>
          </div>
        </div>
      ),
      { duration: 5000 }
    );

    requestBrowserNotificationPermission();
  }
  
  // Dispatch custom event to notify components in the same window
  window.dispatchEvent(new CustomEvent('notification-changed', { detail: { showId: show.id, title: show.title, enabled: newValue } }));
  
  return newValue;
}

export function enableShowNotificationSilent(showOrItem: ShowItem | string | { id: string; title: string }) {
  const ids = getNotificationShowIds();
  const show = typeof showOrItem === 'string' ? { id: showOrItem, title: showOrItem } : showOrItem;
  const cleanTitle = show.title ? show.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const titleKey = cleanTitle ? `title:${cleanTitle}` : '';

  const toAdd: string[] = [];
  if (show.id && !ids.includes(show.id)) toAdd.push(show.id);
  if (titleKey && !ids.includes(titleKey)) toAdd.push(titleKey);

  if (toAdd.length > 0) {
    const updated = Array.from(new Set([...ids, ...toAdd]));
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('notification-changed', { detail: { showId: show.id, title: show.title, enabled: true } }));
  }
}

function getSentNotifiedKeys(): string[] {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markNotifiedSent(key: string) {
  const sent = getSentNotifiedKeys();
  if (!sent.includes(key)) {
    sent.push(key);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(sent));
  }
}

/**
 * Robustly parses release date strings (supports "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", ISO strings, etc.)
 */
export function parseReleaseDateToTimestamp(dateStr?: string): number | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  if (!str) return null;

  // Split date and optional time
  const spaceSplit = str.split(/[ T]+/);
  const datePart = spaceSplit[0];
  const timePart = spaceSplit[1] || '00:00';

  const timeParts = timePart.split(':');
  const hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);

  const delimiters = ['-', '/'];
  for (const delim of delimiters) {
    const parts = datePart.split(delim);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD-MM-YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const parsed = new Date(year, month, day, hours, minutes);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
      } else if (parts[0].length === 4) {
        // YYYY-MM-DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const parsed = new Date(year, month, day, hours, minutes);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
      }
    }
  }

  const stdParsed = new Date(str);
  if (!isNaN(stdParsed.getTime())) {
    return stdParsed.getTime();
  }

  return null;
}

/**
 * Checks if a show has a future release date that has not yet arrived.
 */
export function isFutureRelease(show: ShowItem): boolean {
  if (!show.releaseDate) return false;
  const targetTime = parseReleaseDateToTimestamp(show.releaseDate);
  if (!targetTime) return false;
  return targetTime > Date.now();
}

/**
 * Checks if a show's release date has already passed and the 24-hour "OUT NOW" window is finished.
 * This indicates the episode has completed its release window and the show should look for the next upcoming episode.
 */
export function isReleaseDatePast(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const targetTime = parseReleaseDateToTimestamp(dateStr);
  if (!targetTime) return false;
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return now - targetTime > TWENTY_FOUR_HOURS_MS;
}

/**
 * Checks all shows with notifications enabled:
 * Triggers alerts based on custom intervals.
 */
export function checkAndTrigger24hNotifications(shows: ShowItem[]): number {
  const enabledIds = getNotificationShowIds();
  const sentKeys = getSentNotifiedKeys();
  const intervals = getAlertIntervals();
  const now = Date.now();
  
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * ONE_HOUR_MS;
  const THREE_DAYS_MS = 3 * ONE_DAY_MS;
  const ONE_WEEK_MS = 7 * ONE_DAY_MS;

  let sentCount = 0;

  shows.forEach((show) => {
    if (!enabledIds.includes(show.id)) return;

    // Use getEffectiveReleaseInfo to get correct timing (live network schedule priority)
    const eff = getEffectiveReleaseInfo(show);
    const targetTime = eff.timestamp;
    if (!targetTime) return;

    const timeDiff = targetTime - now;

    // Helper to send alert once
    const trySend = (keySuffix: string, label: string) => {
      const key = `${show.id}_${targetTime}_${keySuffix}`;
      if (!sentKeys.includes(key)) {
        sendIntervalNotificationAlert(show, label);
        markNotifiedSent(key);
        sentCount++;
      }
    };

    // 1. One Week Alert
    if (intervals.oneWeek && timeDiff > 0 && timeDiff <= ONE_WEEK_MS && timeDiff > THREE_DAYS_MS) {
      trySend('1w', '1 Week');
    }

    // 2. Three Days Alert
    if (intervals.threeDays && timeDiff > 0 && timeDiff <= THREE_DAYS_MS && timeDiff > ONE_DAY_MS) {
      trySend('3d', '3 Days');
    }

    // 3. One Day Alert
    if (intervals.oneDay && timeDiff > 0 && timeDiff <= ONE_DAY_MS && timeDiff > ONE_HOUR_MS) {
      trySend('24h', '24 Hours');
    }

    // 4. One Hour Alert
    if (intervals.oneHour && timeDiff > 0 && timeDiff <= ONE_HOUR_MS && timeDiff > 0) {
      trySend('1h', '1 Hour');
    }

    // 5. "OUT NOW!" Release Alert (countdown reached 0 / release date reached, valid for 48h past)
    if (intervals.atRelease && eff.isOut) {
      const outNowKey = `${show.id}_${targetTime}_out_now`;
      if (!sentKeys.includes(outNowKey)) {
        sendOutNowNotificationAlert(show);
        markNotifiedSent(outNowKey);
        sentCount++;
      }
    }
  });

  return sentCount;
}

function hasExplicitTime(str?: string): boolean {
  if (!str) return false;
  return /([01]?\d|2[0-3]):[0-5]\d|\b\d{1,2}\s*(am|pm)\b/i.test(str);
}

export interface EffectiveReleaseInfo {
  timestamp: number | null;
  outNowTimestamp?: number | null;
  nextEpisodeTimestamp?: number | null;
  formattedDateStr: string;
  date: Date | null;
  label: string;
  isOut: boolean;
  isPastWindow: boolean;
  isFuture: boolean;
  isNextEpisode: boolean;
  outNowEpisode?: {
    season?: number | string;
    number?: number | string;
    name?: string;
    airstamp?: string;
    timestamp?: number;
    airdate?: string;
    airtime?: string;
  };
  upcomingEpisode?: {
    season?: number | string;
    number?: number | string;
    name?: string;
    airstamp?: string;
    timestamp?: number;
    airdate?: string;
    airtime?: string;
  };
}

export function getEffectiveReleaseInfo(
  show: ShowItem,
  liveAirstampOrTvMaze?: string | TvMazeShowInfo | null
): EffectiveReleaseInfo {
  if (!show) {
    return {
      timestamp: null,
      formattedDateStr: '',
      date: null,
      label: 'Coming Soon',
      isOut: false,
      isPastWindow: false,
      isFuture: false,
      isNextEpisode: false,
    };
  }

  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  // 1. Identify previous/recent episode (for exact 24h OUT NOW window)
  let prevTs: number | null = null;
  let prevEpObj: any = null;

  if (typeof liveAirstampOrTvMaze === 'object' && liveAirstampOrTvMaze) {
    const candidate = liveAirstampOrTvMaze.outNowEpisode || liveAirstampOrTvMaze.previousEpisode;
    if (candidate) {
      prevEpObj = candidate;
      prevTs = getTvMazeEpisodeTimestamp(candidate);
    }
  }

  if (prevTs === null && show.lastAirTimestamp) {
    prevTs = show.lastAirTimestamp;
  }
  if (prevTs === null && show.lastAirDate) {
    prevTs = parseReleaseDateToTimestamp(show.lastAirDate);
  }

  // 2. Identify next/upcoming episode timestamp
  let nextTs: number | null = null;
  let nextEpObj: any = null;

  if (typeof liveAirstampOrTvMaze === 'string' && liveAirstampOrTvMaze) {
    const parsed = new Date(liveAirstampOrTvMaze).getTime();
    if (!isNaN(parsed)) nextTs = parsed;
  } else if (typeof liveAirstampOrTvMaze === 'object' && liveAirstampOrTvMaze?.nextEpisode) {
    nextEpObj = liveAirstampOrTvMaze.nextEpisode;
    nextTs = getTvMazeEpisodeTimestamp(nextEpObj);
  }

  if (nextTs === null && show.nextAirTimestamp) {
    nextTs = show.nextAirTimestamp;
  }
  if (nextTs === null && show.nextAirDate) {
    nextTs = parseReleaseDateToTimestamp(show.nextAirDate);
  }

  // If nextEp has already passed its exact airstamp and is within the 24h window, it is the OUT NOW episode
  if (nextTs !== null && now >= nextTs && now < nextTs + TWENTY_FOUR_HOURS_MS) {
    if (prevTs === null || nextTs >= prevTs) {
      prevTs = nextTs;
      prevEpObj = nextEpObj;
      nextTs = null;
      nextEpObj = null;
    }
  }

  // 3. User-entered primary release date (e.g. for movies or manually tracked shows)
  let primaryTs = parseReleaseDateToTimestamp(show.releaseDate);
  if (primaryTs !== null && !hasExplicitTime(show.releaseDate)) {
    const dateObj = new Date(primaryTs);
    const today = new Date();
    if (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    ) {
      const primeTimeDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 20, 0, 0);
      if (primeTimeDate.getTime() > now) {
        primaryTs = primeTimeDate.getTime();
      }
    }
  }

  const isSeries = show.type === 'Series';

  // Construct structured episode descriptors
  const outNowFromPrev = prevTs !== null ? {
    season: prevEpObj?.season || show.lastSeasonNum,
    number: prevEpObj?.number || show.lastEpisodeNum,
    name: prevEpObj?.name || show.lastEpisodeTitle,
    airstamp: prevEpObj?.airstamp,
    timestamp: prevTs,
    airdate: prevEpObj?.airdate || show.lastAirDate,
    airtime: prevEpObj?.airtime || show.lastAirTime,
  } : undefined;

  const upcomingFromNext = nextTs !== null && nextTs > now ? {
    season: nextEpObj?.season || show.nextSeasonNum,
    number: nextEpObj?.number || show.nextEpisodeNum,
    name: nextEpObj?.name || show.nextEpisodeTitle,
    airstamp: nextEpObj?.airstamp,
    timestamp: nextTs,
    airdate: nextEpObj?.airdate || show.nextAirDate,
    airtime: nextEpObj?.airtime || show.nextAirTime,
  } : undefined;

  // RULE A: 24-HOUR EXACT OUT NOW WINDOW
  // 1. Check if episode aired within the last 24 hours:
  // Starts at EXACT airstamp (now >= prevTs) and STAYS visible for FULL 24 hours (now < prevTs + TWENTY_FOUR_HOURS_MS)
  // Do NOT roll to next episode until the 24 hours are COMPLETELY finished!
  if (isSeries && prevTs !== null && now >= prevTs && now < prevTs + TWENTY_FOUR_HOURS_MS) {
    const hasUpcoming = Boolean(upcomingFromNext?.timestamp && upcomingFromNext.timestamp > now);
    const labelStr = outNowFromPrev?.season && outNowFromPrev?.number
      ? `S${outNowFromPrev.season} E${outNowFromPrev.number}${outNowFromPrev.name ? ` • ${outNowFromPrev.name}` : ''}`
      : formatToLocalDisplay(prevTs);

    return {
      timestamp: hasUpcoming ? (upcomingFromNext!.timestamp || prevTs) : prevTs,
      outNowTimestamp: prevTs,
      nextEpisodeTimestamp: hasUpcoming ? upcomingFromNext!.timestamp : null,
      formattedDateStr: formatToLocalDisplay(prevTs),
      date: new Date(prevTs),
      label: labelStr,
      isOut: true,
      isPastWindow: false,
      isFuture: false,
      isNextEpisode: hasUpcoming,
      outNowEpisode: outNowFromPrev,
      upcomingEpisode: upcomingFromNext,
    };
  }

  // 2. Check user-entered primary releaseDate within 24h window
  if (primaryTs !== null && now >= primaryTs && now < primaryTs + TWENTY_FOUR_HOURS_MS) {
    const dateLabel = formatToLocalDisplay(primaryTs);
    return {
      timestamp: primaryTs,
      outNowTimestamp: primaryTs,
      nextEpisodeTimestamp: null,
      formattedDateStr: dateLabel,
      date: new Date(primaryTs),
      label: show.releaseNote || dateLabel,
      isOut: true,
      isPastWindow: false,
      isFuture: false,
      isNextEpisode: false,
      outNowEpisode: {
        name: show.title,
        timestamp: primaryTs,
        airdate: show.releaseDate,
      },
    };
  }

  // RULE B: FUTURE UPCOMING EPISODES (COUNTDOWN)
  // 1. Live TVMaze upcoming episode
  if (isSeries && nextTs !== null && nextTs > now) {
    const dateLabel = formatToLocalDisplay(nextTs);
    return {
      timestamp: nextTs,
      outNowTimestamp: null,
      nextEpisodeTimestamp: nextTs,
      formattedDateStr: dateLabel,
      date: new Date(nextTs),
      label: upcomingFromNext?.season && upcomingFromNext?.number
        ? `${dateLabel} (S${upcomingFromNext.season} E${upcomingFromNext.number})`
        : dateLabel,
      isOut: false,
      isPastWindow: false,
      isFuture: true,
      isNextEpisode: true,
      upcomingEpisode: upcomingFromNext,
    };
  }

  // 2. User-entered primary future release date
  if (primaryTs !== null && primaryTs > now) {
    const dateLabel = formatToLocalDisplay(primaryTs);
    return {
      timestamp: primaryTs,
      outNowTimestamp: null,
      nextEpisodeTimestamp: primaryTs,
      formattedDateStr: dateLabel,
      date: new Date(primaryTs),
      label: show.releaseNote || dateLabel,
      isOut: false,
      isPastWindow: false,
      isFuture: true,
      isNextEpisode: false,
    };
  }

  // RULE C: EXPIRED BEYOND 24 HOURS (Cleanly switch or finish)
  if (
    (prevTs !== null && now >= prevTs + TWENTY_FOUR_HOURS_MS && (!nextTs || nextTs <= now)) ||
    (primaryTs !== null && now >= primaryTs + TWENTY_FOUR_HOURS_MS)
  ) {
    return {
      timestamp: nextTs || primaryTs || prevTs,
      outNowTimestamp: null,
      nextEpisodeTimestamp: null,
      formattedDateStr: formatToLocalDisplay(nextTs || primaryTs || prevTs),
      date: new Date(nextTs || primaryTs || prevTs || 0),
      label: show.releaseNote || 'Released',
      isOut: false,
      isPastWindow: true,
      isFuture: false,
      isNextEpisode: false,
    };
  }

  return {
    timestamp: null,
    formattedDateStr: '',
    date: null,
    label: show.releaseNote || 'Coming Soon',
    isOut: false,
    isPastWindow: false,
    isFuture: false,
    isNextEpisode: false,
  };
}

export function isShowOutNow(
  show: ShowItem,
  liveAirstampOrTvMaze?: string | TvMazeShowInfo | null
): boolean {
  return getEffectiveReleaseInfo(show, liveAirstampOrTvMaze).isOut;
}

/**
 * 📋 Copied to Clipboard Toast (3s)
 */
export function notifyCopiedToClipboard() {
  toast.success('✅ Copied to clipboard — ready to paste', { duration: 3000 });
}

/**
 * 💾 Saved to Sheet Toast (4s)
 */
export function notifySavedToSheet() {
  toast.success('✅ Saved to Google Sheet ✓', { duration: 4000 });
}

/**
 * 🔄 No Changes Toast (3s)
 */
export function notifyNoChangesSync() {
  toast('Nothing new to sync — already up to date', {
    duration: 3000,
    icon: '🔄',
    style: {
      background: '#09090b',
      color: '#38bdf8',
      border: '1px solid rgba(56, 189, 248, 0.4)',
    },
  });
}

/**
 * 🕐 Last Synced Toast (2s)
 */
export function notifyLastSynced(timeStr?: string) {
  const displayTime = timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  toast(`⏱️ Last synced: ${displayTime}`, {
    duration: 2000,
    style: {
      background: '#18181b',
      color: '#a1a1aa',
      border: '1px solid #3f3f46',
      fontSize: '12px',
    },
  });
}
