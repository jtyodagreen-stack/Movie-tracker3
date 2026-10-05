export interface OfflineAction {
  id: string;
  type: 'ADD_SHOW' | 'UPDATE_SHOW' | 'DELETE_SHOW' | 'SYNC_STATUS';
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'showflix_offline_queue';
const CACHED_DATA_KEY = 'showflix_app_data_cache';

export interface AppDataCache {
  shows: any[];
  headers: string[];
  customViewers: string[];
  viewerColors?: Record<string, string>;
  lastUpdated: number;
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName: string;
  showcaseSheetName: string;
  sheetTitle?: string;
  availableTabs?: string[];
  dataSignature?: string;
}

export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY) || localStorage.getItem('bingebox_offline_queue');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineAction(type: OfflineAction['type'], payload: any) {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type,
    payload,
    timestamp: Date.now(),
  };
  queue.push(newAction);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline action to queue', e);
  }
  return newAction;
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {}
}

export function getAppDataCache(): AppDataCache | null {
  try {
    const raw = localStorage.getItem(CACHED_DATA_KEY) || localStorage.getItem('bingebox_app_data_cache');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAppDataCache(data: Partial<AppDataCache>) {
  try {
    const existing = getAppDataCache() || {
      shows: [],
      headers: [],
      customViewers: [],
      lastUpdated: 0,
      spreadsheetId: '',
      sheetName: '',
      wishlistSheetName: ''
    };
    const updated = { ...existing, ...data, lastUpdated: Date.now() };
    localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(updated));
  } catch {}
}

// Deprecated - use getAppDataCache().shows instead
export function getCachedShows(): any[] {
  return getAppDataCache()?.shows || [];
}

// Deprecated - use setAppDataCache({ shows }) instead
export function setCachedShows(shows: any[]) {
  setAppDataCache({ shows });
}
