export type ShowType = 'Series' | 'Movie';

export type WatchStatus = '✅ Watched' | '⏳ Watching' | '⏸️ Paused' | '❌ Dropped';

export const PRESET_PLATFORMS = [
  '📺 Netflix',
  '🛒 Prime Video',
  '⚡ Disney+',
  '🟣 Apple Tv+',
  '🟥 Paramount+',
  '🟪 Max / Hbo',
  '🎬 Sky / Now',
] as const;

export type PresetPlatform = (typeof PRESET_PLATFORMS)[number];

export interface ShowItem {
  id: string;
  title: string;
  type: ShowType;
  platform: string; // e.g., "📺 Netflix", "🛒 Prime Video", "⚡ Disney+", "🟣 Apple Tv+", "🟥 Paramount+", "🟪 Max / Hbo", "🎬 Sky / Now"
  seasons: string; // e.g., "S1", "S3"
  episodes: string; // e.g., "E1", "E8"
  nextEp?: boolean | string;
  nextSsn?: boolean | string;
  genre: string; // e.g., "Drama", "Documentary", "Action"
  year: number | string;
  status: WatchStatus;
  rating: string; // e.g., "⭐⭐⭐⭐⭐ = Excellent"
  ratingNum: number; // e.g. 5, 4, 3
  notes: string;
  who: string; // Viewer profile name
  maxEp: string; // e.g., "E8"
  backdropUrl?: string;
  posterUrl?: string;
  synopsis?: string;
  rowNumber?: number; // 1-indexed row number in the Google Sheet
  isWishlist?: boolean; // Whether the item is on the Wishlist sheet
  sheetTabName?: string; // The specific sheet tab this show belongs to (e.g. MASTER TRACKER, Wishlist)
  priority?: string; // e.g. "High", "Medium", "Low"
  dateAdded?: string; // e.g. "2026-09-21"
  addedTime?: number; // Epoch ms when added
  createdTimestamp?: number; // Exact Epoch ms when show was added to tracker
  sessionAddedAt?: number; // Priority timestamp for newly added titles
  sortOrderNum?: number; // Pure numeric order index: highest = newest = top (identical on iOS, mobile, desktop)
  addedRank?: number; // Pure numeric addedRank: highest = newest = first (rebuilt from Sheet on every load)
  imdbId?: string; // Official IMDb ID (e.g. tt1234567)
  // Live Season Premiere & Weekly Air Schedule Tracking
  nextAirDate?: string; // Formatted as DD-MM-YYYY (e.g. "15-10-2026")
  nextAirTime?: string; // e.g. "21:00"
  nextAirTimestamp?: number; // Epoch ms for live ticking countdown
  nextEpisodeTitle?: string; // e.g. "Hello Ms. Cobel"
  nextSeasonNum?: number | string; // e.g. 2
  nextEpisodeNum?: number | string; // e.g. 1
  airScheduleText?: string; // e.g. "Airs Fridays at 21:00 on Apple TV+"
  isOngoing?: boolean; // True if series is actively airing or has upcoming season premiere
  scheduleStatus?: string; // e.g. "Season 2 Premiere", "Weekly Episode", "Returning Series"
  releaseDate?: string; // Target Premiere/Release date (e.g. DD-MM-YYYY)
  releaseNote?: string; // Premiere/Countdown note (e.g. "Season 5 Premiere")
  notify24h?: boolean; // Whether 24h release reminder notification is enabled
  trailerUrl?: string; // Custom YouTube trailer URL or share link
  trailerYoutubeId?: string; // Extracted 11-char YouTube Video ID
}

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface TrackerStats {
  totalShows: number;
  watched: number;
  watching: number;
  planToWatch: number;
  seriesCount: number;
  moviesCount: number;
}

export interface AccessibilitySettings {
  contrastMode: 'default' | 'high';
  textSize: 'standard' | 'large'; // UK Gov 16pt+ / 125% clear print recommendation
  dyslexiaFont: boolean; // Accessible sans/dyslexic clear font
  reduceMotion: boolean; // WCAG vestibular accessibility
  accentColor?: string; // Predefined theme accent hex or theme ID (default: '#E50914')
}

export interface AccentTheme {
  id: string;
  name: string;
  hex: string;
  hoverHex: string;
  rgb: string;
  previewClass: string;
}

export const PREDEFINED_ACCENT_THEMES: AccentTheme[] = [
  { id: 'red', name: 'Netflix Red (Default)', hex: '#E50914', hoverHex: '#B91C1C', rgb: '229, 9, 20', previewClass: 'bg-[#E50914]' },
  { id: 'rose', name: 'Crimson Rose', hex: '#F43F5E', hoverHex: '#E11D48', rgb: '244, 63, 94', previewClass: 'bg-rose-500' },
  { id: 'pink', name: 'Cyber Neon Pink', hex: '#EC4899', hoverHex: '#DB2777', rgb: '236, 72, 153', previewClass: 'bg-pink-500' },
  { id: 'purple', name: 'Electric Purple', hex: '#A855F7', hoverHex: '#9333EA', rgb: '168, 85, 247', previewClass: 'bg-purple-500' },
  { id: 'indigo', name: 'Royal Indigo', hex: '#6366F1', hoverHex: '#4F46E5', rgb: '99, 102, 241', previewClass: 'bg-indigo-500' },
  { id: 'blue', name: 'Vibrant Blue', hex: '#3B82F6', hoverHex: '#2563EB', rgb: '59, 130, 246', previewClass: 'bg-blue-500' },
  { id: 'cyan', name: 'Ocean Cyan', hex: '#06B6D4', hoverHex: '#0891B2', rgb: '6, 182, 212', previewClass: 'bg-cyan-500' },
  { id: 'emerald', name: 'Emerald Green', hex: '#10B981', hoverHex: '#059669', rgb: '16, 185, 129', previewClass: 'bg-emerald-500' },
  { id: 'amber', name: 'Amber Gold', hex: '#F59E0B', hoverHex: '#D97706', rgb: '245, 158, 11', previewClass: 'bg-amber-500' },
  { id: 'orange', name: 'Sunset Orange', hex: '#F97316', hoverHex: '#EA580C', rgb: '249, 115, 22', previewClass: 'bg-orange-500' },
];

export interface AlertIntervals {
  oneWeek: boolean;
  threeDays: boolean;
  oneDay: boolean;
  oneHour: boolean;
  atRelease: boolean;
}

export interface CustomFilter {
  id: string;
  name: string;
  status: WatchStatus;
  [key: string]: any;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'AUTO' | 'MANUAL' | 'INITIAL' | 'PUSH';
  status: 'SUCCESS' | 'ERROR';
  details: string;
}

