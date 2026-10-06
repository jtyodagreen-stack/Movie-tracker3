import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Table,
  LogOut,
  Tv,
  Film,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Zap,
  Calendar,
  Layers,
  Check,
  Accessibility,
  BarChart3,
  WifiOff,
  Clock,
  History,
  Sparkles,
  Trash2,
  Star,
  Shuffle,
  Settings,
  Users,
  Palette,
  MessageSquare,
  HelpCircle,
  Bug,
  Bell,
  BellRing,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { ShowItem, PRESET_PLATFORMS, AccessibilitySettings, AlertIntervals } from '../types';
import { normalizePlatform } from '../services/sheetsService';
import { getOptimizedPoster } from '../utils/imageOptimizer';
import { isNotificationEnabled, toggleShowNotification, isShowOutNow, isReleaseDatePast } from '../services/notificationService';
import { formatToDDMMYYYY } from '../utils/dateUtils';
import {
  getProfilePicture,
  getProfileDisplayName,
  getProfileEmail,
  GOOGLE_AVATAR_DATA_URI,
  DEFAULT_PROFILE_USER,
} from '../utils/userProfile';
import { getViewerColor, getViewerColorName } from '../utils/profileColors';
import { APP_VERSION, APP_BUILD_DATE } from '../config/version';

import SettingsCenterModal from './SettingsCenterModal';
import NetflixProfileSwitcherModal from './NetflixProfileSwitcherModal';
import FeedbackModal from './FeedbackModal';

interface NavbarProps {
  user: User | null;
  onSignIn: (options?: { forceConsent?: boolean }) => any;
  onSignOut: () => void;
  onOpenSync: () => void;
  onOpenAdd: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: string;
  onSelectFilter: (f: string) => void;
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
  sheetConnected: boolean;
  sheetTitle?: string;
  shows: ShowItem[];
  isSyncing?: boolean;
  lastSyncedAt?: string;
  autoSyncEnabled?: boolean;
  onTriggerSync?: () => void;
  accessibilitySettings: AccessibilitySettings;
  setAccessibilitySettings: (settings: AccessibilitySettings) => void;
  onOpenDashboard?: () => void;
  isOnline?: boolean;
  syncFrequency?: number;
  onUpdateSyncFrequency?: (freq: number) => void;
  onOpenDetails?: (show: ShowItem) => void;
  onOpenRandomPicker?: () => void;
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  customViewers?: string[];
  onUpdateCustomViewers?: (viewers: string[], colors?: Record<string, string>) => void;
  viewerColors?: Record<string, string>;
  onUpdateViewerColors?: (colors: Record<string, string>) => void;
  viewerAvatars?: Record<string, string>;
  onUpdateViewerAvatars?: (avatars: Record<string, string>) => void;
  alertIntervals: AlertIntervals;
  onUpdateAlertIntervals: (intervals: AlertIntervals) => void;
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  availableTabs?: string[];
  onConnect: (id: string, name: string, wishlistName?: string) => Promise<void>;
  onDisconnect: () => void;
  onToggleAutoSync?: (enabled: boolean) => void;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-red-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
];

export default function Navbar({
  user,
  onSignIn,
  onSignOut,
  onOpenSync,
  onOpenAdd,
  searchQuery,
  onSearchChange,
  activeFilter,
  onSelectFilter,
  selectedPlatform,
  onSelectPlatform,
  sheetConnected,
  sheetTitle,
  shows,
  isSyncing,
  lastSyncedAt,
  autoSyncEnabled = true,
  onTriggerSync,
  accessibilitySettings,
  setAccessibilitySettings,
  onOpenDashboard,
  isOnline,
  syncFrequency = 45,
  onUpdateSyncFrequency,
  onOpenDetails,
  onOpenRandomPicker,
  activeProfile,
  onSwitchProfile,
  customViewers = [],
  onUpdateCustomViewers,
  viewerColors = {},
  onUpdateViewerColors,
  viewerAvatars = {},
  onUpdateViewerAvatars,
  alertIntervals,
  onUpdateAlertIntervals,
  spreadsheetId,
  sheetName,
  wishlistSheetName,
  availableTabs,
  onConnect,
  onDisconnect,
  onToggleAutoSync,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(Boolean(searchQuery));
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsCenterModal, setShowSettingsCenterModal] = useState(false);
  const [showNetflixProfileSwitcher, setShowNetflixProfileSwitcher] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'all' | 'user' | 'sync' | 'acc' | 'theme' | 'data'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAccMenu, setShowAccMenu] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnlineState(true);
    const handleOffline = () => setIsOnlineState(false);
    const handleCloseMenu = () => {
      setIsMobileMenuOpen(false);
      setShowUserMenu(false);
      setShowAccMenu(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('close-mobile-menu', handleCloseMenu);
    setIsOnlineState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('close-mobile-menu', handleCloseMenu);
    };
  }, []);

  const online = isOnline !== undefined ? isOnline : isOnlineState;
  const isSignedIn = Boolean(user && user.uid);
  const activeUser = user || DEFAULT_PROFILE_USER;
  const profilePictureUrl = getProfilePicture(activeUser);
  const profileDisplayName = getProfileDisplayName(activeUser);
  const profileEmail = getProfileEmail(activeUser);

  // Global Keyboard shortcut Ctrl+K or Cmd+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === '/' && !isInputFocused && sheetConnected) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sheetConnected]);

  // Desktop Dropdown States
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [showSyncFreqMenu, setShowSyncFreqMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const platformDropdownRef = useRef<HTMLDivElement>(null);
  const platformTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const accDropdownRef = useRef<HTMLDivElement>(null);
  const mobileAccDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const mobileNotifDropdownRef = useRef<HTMLDivElement>(null);
  const syncFreqDropdownRef = useRef<HTMLDivElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recent Searches State
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bingebox_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string' && s.trim());
      }
    } catch {}
    return [];
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('bingebox_recent_searches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeRecentSearch = (itemToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== itemToRemove);
      try {
        localStorage.setItem('bingebox_recent_searches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearAllRecentSearches = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('bingebox_recent_searches');
    } catch {}
  };

  const filteredRecentSearches = useMemo(() => {
    if (!searchQuery.trim()) return recentSearches;
    const q = searchQuery.toLowerCase().trim();
    return recentSearches.filter((item) => item.toLowerCase().includes(q));
  }, [recentSearches, searchQuery]);

  const formatS = (s: string | number) => {
    const str = String(s).trim();
    if (!str) return 'S1';
    if (/^\d+$/.test(str)) return `S${str}`;
    if (/^[sS]\d+/.test(str)) return `S${str.slice(1)}`;
    return str.startsWith('S') || str.startsWith('s') ? str.toUpperCase() : `S${str}`;
  };

  const formatE = (e: string | number) => {
    const str = String(e).trim();
    if (!str) return 'E1';
    if (/^\d+$/.test(str)) return `E${str}`;
    if (/^[eE]\d+/.test(str)) return `E${str.slice(1)}`;
    return str.startsWith('E') || str.startsWith('e') ? str.toUpperCase() : `E${str}`;
  };

  // Live Matching Shows with Poster & Info for Search Results
  const matchingShows = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return shows
      .filter((s) => {
        return (
          s.title.toLowerCase().includes(q) ||
          (s.genre && s.genre.toLowerCase().includes(q)) ||
          (s.platform && s.platform.toLowerCase().includes(q)) ||
          (s.type && s.type.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q)) ||
          (s.who && s.who.toLowerCase().includes(q)) ||
          (s.year && String(s.year).includes(q))
        );
      })
      .slice(0, 6);
  }, [shows, searchQuery]);

  const notificationShows = useMemo(() => {
    return shows.filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate || s.nextAirTimestamp));
  }, [shows]);

  // Auto-save search term after debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      saveRecentSearch(searchQuery);
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchMouseEnter = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setShowSearch(true);
  };

  const handleSearchMouseLeave = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (!searchQuery.trim()) {
        searchInputRef.current?.blur();
        setShowSearch(false);
      }
    }, 150);
  };

  const handlePlatformMouseEnter = () => {
    if (platformTimeoutRef.current) {
      clearTimeout(platformTimeoutRef.current);
      platformTimeoutRef.current = null;
    }
    setShowPlatformMenu(true);
  };

  const handlePlatformMouseLeave = () => {
    if (platformTimeoutRef.current) {
      clearTimeout(platformTimeoutRef.current);
    }
    platformTimeoutRef.current = setTimeout(() => {
      setShowPlatformMenu(false);
    }, 200);
  };

  const userTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUserMouseEnter = () => {
    if (userTimeoutRef.current) {
      clearTimeout(userTimeoutRef.current);
      userTimeoutRef.current = null;
    }
    setShowUserMenu(true);
  };

  const handleUserMouseLeave = () => {
    if (userTimeoutRef.current) {
      clearTimeout(userTimeoutRef.current);
    }
    userTimeoutRef.current = setTimeout(() => {
      setShowUserMenu(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (platformTimeoutRef.current) {
        clearTimeout(platformTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (userTimeoutRef.current) {
        clearTimeout(userTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (searchQuery) {
      setShowSearch(true);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        platformDropdownRef.current &&
        !platformDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPlatformMenu(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
      if (
        syncFreqDropdownRef.current &&
        !syncFreqDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSyncFreqMenu(false);
      }
      if (
        accDropdownRef.current &&
        !accDropdownRef.current.contains(event.target as Node) &&
        mobileAccDropdownRef.current &&
        !mobileAccDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAccMenu(false);
      }
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target as Node) &&
        mobileNotifDropdownRef.current &&
        !mobileNotifDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotifMenu(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
        if (!searchQuery.trim()) {
          setShowSearch(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const watchingCount = shows.filter(
    (s) =>
      !s.isWishlist &&
      (s.status === '⏳ Watching' ||
        String(s.status).toLowerCase().includes('watching') ||
        String(s.status).toLowerCase().includes('in progress'))
  ).length;
  const watchedCount = shows.filter(
    (s) =>
      !s.isWishlist &&
      (s.status === '✅ Watched' ||
        String(s.status).toLowerCase().includes('watched') ||
        String(s.status).toLowerCase().includes('done') ||
        String(s.status).toLowerCase().includes('finished'))
  ).length;
  const wishlistCount = shows.filter(
    (s) =>
      Boolean(s.isWishlist) ||
      s.status === ('🎁 Wishlist' as any) ||
      String(s.status).toLowerCase().includes('wishlist')
  ).length;

  // Exact user preset platforms
  const availablePlatforms = useMemo(() => {
    return PRESET_PLATFORMS.map((preset) => {
      const clean = preset.replace(/^[^\w\s]+/, '').trim() || preset;
      const count = shows.filter((s) => {
        if (!s.platform) return false;
        const norm = normalizePlatform(s.platform);
        return norm === preset || s.platform.trim() === preset;
      }).length;
      return { raw: preset, name: clean, count };
    });
  }, [shows]);

  const isTransparent =
    !scrolled &&
    activeFilter === 'all' &&
    selectedPlatform === 'all' &&
    !searchQuery.trim() &&
    !isMobileMenuOpen;

  const handleMobileNavClick = (filter: string) => {
    onSelectFilter(filter);
    setIsMobileMenuOpen(false);
  };

  const handleMobilePlatformClick = (plat: string) => {
    onSelectPlatform(plat);
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        isTransparent
          ? 'bg-gradient-to-b from-black/90 via-black/60 to-transparent'
          : 'bg-[#141414]/98 backdrop-blur-md shadow-xl border-b border-[#262626]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Desktop Navigation */}
        <div className="flex items-center gap-4 xl:gap-6 min-w-0">
          <button
            id="brand-logo-btn"
            onClick={() => {
              onSelectFilter('all');
              onSelectPlatform('all');
              onSearchChange('');
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none shrink-0"
          >
            <div className="w-9 h-9 rounded bg-red-600 flex items-center justify-center font-black text-white text-xl tracking-tighter shadow-lg shadow-red-900/30 group-hover:scale-105 transition-transform preserve-theme-color">
              N
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg xl:text-xl tracking-wider text-white uppercase flex items-center gap-1.5">
                SHOW<span className="text-red-600 preserve-theme-color">FLIX</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-tight -mt-1 hidden sm:inline">
                Personal Streaming Tracker
              </span>
            </div>
          </button>

          {/* DESKTOP Navigation Links (lg: >= 1024px) */}
          {sheetConnected && (
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium shrink-0">
            {/* ALL PLATFORMS DROPDOWN MENU */}
            <div
              className="relative"
              ref={platformDropdownRef}
              onMouseEnter={handlePlatformMouseEnter}
              onMouseLeave={handlePlatformMouseLeave}
            >
              <button
                id="nav-platforms-dropdown-btn"
                onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedPlatform !== 'all'
                    ? 'text-white font-semibold bg-red-600/20 border border-red-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Filter by streaming platform"
              >
                <Layers className="w-3.5 h-3.5 text-red-400" />
                <span>
                  {selectedPlatform !== 'all' ? selectedPlatform : 'Platforms'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPlatformMenu ? 'rotate-180' : ''}`} />
              </button>

              {showPlatformMenu && (
                <div
                  id="navbar-platforms-menu"
                  className="absolute left-0 mt-1 w-60 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3"
                >
                  <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">All Streaming Platforms</span>
                    <span className="text-[10px] text-zinc-500">{availablePlatforms.length} platforms</span>
                  </div>

                  <button
                    onClick={() => {
                      onSelectPlatform('all');
                      onSelectFilter('All Titles');
                      setShowPlatformMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                      selectedPlatform === 'all' && activeFilter === 'All Titles'
                        ? 'bg-red-600 text-white font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>All Platforms (Show All Titles)</span>
                    {selectedPlatform === 'all' && activeFilter === 'All Titles' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="my-1 border-t border-zinc-800" />

                  {availablePlatforms.map((p) => {
                    const isSelected = selectedPlatform === p.raw;
                    return (
                      <button
                        key={p.raw}
                        onClick={() => {
                          onSelectPlatform(p.raw);
                          setShowPlatformMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-red-600/30 text-red-200 font-semibold border-l-2 border-red-500'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <span className="truncate">{p.raw}</span>
                        <div className="flex items-center gap-1.5">
                          {p.count > 0 && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                              {p.count}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              id="nav-series"
              onClick={() => onSelectFilter('Series')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === 'Series'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Series
            </button>
            <button
              id="nav-movies"
              onClick={() => onSelectFilter('Movie')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === 'Movie'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Movies
            </button>
            <button
              id="nav-watching"
              onClick={() => onSelectFilter('⏳ Watching')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === '⏳ Watching'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Watching</span>
              {watchingCount > 0 && (
                <span className="text-[11px] bg-red-600/40 text-red-200 font-bold px-1.5 py-0.2 rounded border border-red-500/30 preserve-theme-color">
                  {watchingCount}
                </span>
              )}
            </button>
            <button
              id="nav-watched"
              onClick={() => onSelectFilter('✅ Watched')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === '✅ Watched'
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Watched</span>
              {watchedCount > 0 && (
                <span className="text-[11px] bg-emerald-950 text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-800/40">
                  {watchedCount}
                </span>
              )}
            </button>
            <button
              id="nav-wishlist"
              onClick={() => onSelectFilter('🎁 Wishlist')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                  ? 'text-white font-semibold bg-amber-500/20 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>🎁 Wishlist</span>
              {wishlistCount > 0 && (
                <span className="text-[11px] bg-amber-950 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-700/50">
                  {wishlistCount}
                </span>
              )}
            </button>
          </nav>
        )}
      </div>

        {/* Right Tools (Search, Google Sheets Sync, Add Show, Profile / Mobile Toggle) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Search Toggle / Input */}
          {sheetConnected && (
            <div
              ref={searchContainerRef}
              className="relative flex items-center"
              onMouseEnter={handleSearchMouseEnter}
              onMouseLeave={handleSearchMouseLeave}
            >
              {showSearch ? (
                <div className="relative">
                  <div className="flex items-center bg-[#202020] border border-zinc-700 hover:border-red-500 focus-within:border-red-500 rounded-full px-3 py-1.5 transition-all w-52 sm:w-64 shadow-lg focus-within:ring-1 focus-within:ring-red-500/50">
                    <Search className="w-3.5 h-3.5 text-red-500 mr-1.5 shrink-0" />
                    <input
                      ref={searchInputRef}
                      id="navbar-search-input"
                      type="text"
                      placeholder="Search titles, genres, platforms..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (searchQuery.trim()) {
                            saveRecentSearch(searchQuery);
                          }
                          setIsSearchFocused(false);
                        } else if (e.key === 'Escape') {
                          setIsSearchFocused(false);
                          if (!searchQuery.trim()) setShowSearch(false);
                        }
                      }}
                      autoFocus
                      className="bg-transparent text-xs sm:text-sm text-white focus:outline-none w-full placeholder:text-zinc-500"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSearchChange('');
                          setIsSearchFocused(false);
                          setShowSearch(false);
                        }}
                        className="p-0.5 hover:text-white text-zinc-400 shrink-0 ml-1 rounded-full hover:bg-zinc-700 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchFocused(false);
                          setShowSearch(false);
                        }}
                        className="p-0.5 hover:text-white text-zinc-500 shrink-0 ml-1 rounded-full hover:bg-zinc-700 cursor-pointer"
                        title="Close search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* RECENT SEARCHES & LIVE SHOW RESULTS DROPDOWN (POSTER + INFO) */}
                  {isSearchFocused && (
                    <div
                      id="navbar-recent-searches-dropdown"
                      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#181818] border border-zinc-700 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                      onMouseDown={(e) => {
                        // Keep input focus when clicking inside dropdown
                        e.preventDefault();
                      }}
                    >
                      {searchQuery.trim() ? (
                        /* LIVE MATCHING SHOWS WITH POSTER AND INFO */
                        matchingShows.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 bg-zinc-900/80">
                              <div className="flex items-center gap-1.5 text-zinc-200">
                                <Film className="w-3.5 h-3.5 text-red-500" />
                                <span>Matching Shows & Movies ({matchingShows.length})</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Click to preview
                              </span>
                            </div>

                            <div className="py-1 max-h-80 overflow-y-auto divide-y divide-zinc-800/40">
                              {matchingShows.map((show) => {
                                const isSeries = show.type === 'Series';
                                const poster = show.posterUrl ? getOptimizedPoster(show.posterUrl) : null;
                                return (
                                  <div
                                    key={`${show.id}-${show.rowNumber || 0}`}
                                    className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-zinc-800/90 group transition-all cursor-pointer select-none"
                                    onClick={() => {
                                      saveRecentSearch(show.title);
                                      setIsSearchFocused(false);
                                      if (onOpenDetails) {
                                        onOpenDetails(show);
                                      }
                                    }}
                                  >
                                    {/* Poster Thumbnail */}
                                    <div className="w-12 h-16 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/80 shadow group-hover:border-red-500/80 transition-colors relative">
                                      {poster ? (
                                        <img
                                          src={poster}
                                          alt={show.title}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-500 p-1 text-center">
                                          {isSeries ? (
                                            <Tv className="w-4 h-4 mb-0.5 text-red-500/80" />
                                          ) : (
                                            <Film className="w-4 h-4 mb-0.5 text-amber-500/80" />
                                          )}
                                          <span className="text-[9px] font-black leading-none line-clamp-1">
                                            {show.title.slice(0, 3)}
                                          </span>
                                        </div>
                                      )}
                                      {show.platform && (
                                        <span className="absolute bottom-0 inset-x-0 bg-black/85 backdrop-blur-xs text-[8px] text-zinc-300 text-center py-0.5 font-semibold truncate px-0.5 border-t border-white/10">
                                          {show.platform}
                                        </span>
                                      )}
                                    </div>

                                    {/* Show Metadata Info */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex items-center justify-between gap-1.5">
                                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 transition-colors truncate">
                                          {show.title}
                                        </h4>
                                        {show.rating && (
                                          <span className="text-[10px] font-bold text-amber-400 shrink-0 flex items-center gap-0.5 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.2 rounded">
                                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                            <span>{show.rating}</span>
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap">
                                        <span className="inline-flex items-center gap-1 font-medium text-zinc-300">
                                          {isSeries ? (
                                            <Tv className="w-3 h-3 text-red-400" />
                                          ) : (
                                            <Film className="w-3 h-3 text-amber-400" />
                                          )}
                                          {show.type || 'Show'}
                                        </span>
                                        {show.year && <span>• {show.year}</span>}
                                        {show.genre && (
                                          <span className="truncate max-w-[120px] text-zinc-400">
                                            • {show.genre}
                                          </span>
                                        )}
                                      </div>

                                      {/* Status and Progress Info */}
                                      <div className="flex items-center gap-1.5 text-[10px] flex-wrap pt-0.5">
                                        <span
                                          className={`px-1.5 py-0.2 rounded font-semibold border ${
                                            show.status === '✅ Watched'
                                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
                                              : show.status === '⏳ Watching'
                                              ? 'bg-amber-950/80 text-amber-300 border-amber-700/50'
                                              : show.isWishlist
                                              ? 'bg-purple-950/80 text-purple-300 border-purple-700/50'
                                              : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                          }`}
                                        >
                                          {show.status || 'Tracked'}
                                        </span>

                                        {isSeries && (
                                          <span className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                                            {formatS(show.seasons || show.nextSeasonNum || 'S1')} {formatE(show.episodes || show.nextEpisodeNum || (typeof show.nextEp === 'string' ? show.nextEp : undefined) || 'E1')}
                                            {show.maxEp ? ` / ${formatE(show.maxEp)}` : ''}
                                          </span>
                                        )}

                                        {show.who && (
                                          <span className="text-zinc-500 font-medium">
                                            👤 {show.who}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                saveRecentSearch(searchQuery);
                                setIsSearchFocused(false);
                              }}
                              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-red-400 hover:text-red-300 text-xs font-semibold text-center border-t border-zinc-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>View filtered tracker results ({shows.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || (s.genre && s.genre.toLowerCase().includes(searchQuery.toLowerCase()))).length})</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="p-4 text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                              <Search className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-semibold text-zinc-200">
                              No shows found for "{searchQuery}"
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              Check spelling or explore other genres, platforms, or titles.
                            </p>
                          </div>
                        )
                      ) : (
                        /* RECENT SEARCHES ONLY */
                        filteredRecentSearches.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between px-3.5 py-1.5 text-[11px] font-semibold text-zinc-400 bg-zinc-900/60 border-b border-zinc-800">
                              <div className="flex items-center gap-1.5 text-zinc-300">
                                <History className="w-3.5 h-3.5 text-red-500" />
                                <span>Recent Searches</span>
                              </div>
                              <button
                                type="button"
                                onClick={clearAllRecentSearches}
                                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                                title="Clear search history"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Clear All</span>
                              </button>
                            </div>

                            <div className="py-1 max-h-56 overflow-y-auto divide-y divide-zinc-800/40">
                              {filteredRecentSearches.map((term) => (
                                <div
                                  key={term}
                                  className="flex items-center justify-between px-3.5 py-2 hover:bg-zinc-800/80 group transition-colors cursor-pointer"
                                  onClick={() => {
                                    onSearchChange(term);
                                    saveRecentSearch(term);
                                    setIsSearchFocused(false);
                                  }}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <History className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-500 shrink-0 transition-colors" />
                                    <span className="text-xs text-zinc-200 group-hover:text-white truncate font-medium">
                                      {term}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => removeRecentSearch(term, e)}
                                    className="p-1 rounded-full text-zinc-500 hover:text-red-400 hover:bg-zinc-700/50 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                                    title={`Remove "${term}" from history`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-zinc-500">
                            <History className="w-5 h-5 mx-auto mb-1.5 opacity-40 text-zinc-400" />
                            <p className="font-medium text-zinc-300">No recent searches</p>
                            <p className="text-[11px] text-zinc-500 pt-0.5">
                              Type above to search titles, genres, or platforms
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  id="navbar-search-toggle"
                  onClick={() => setShowSearch(true)}
                  onMouseEnter={handleSearchMouseEnter}
                  className="p-2 text-zinc-300 hover:text-white transition-colors rounded-full hover:bg-white/10 cursor-pointer"
                  title="Search shows"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* DESKTOP-ONLY BUTTONS (xl: >= 1280px) */}
          <div className="hidden xl:flex items-center gap-2.5 2xl:gap-3">
            {/* OFFLINE MODE STATUS BADGE (Desktop) */}
            {!online && (
              <button
                id="nav-offline-mode-badge"
                onClick={onOpenSync}
                type="button"
                className="flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 rounded-md border bg-amber-950/90 border-amber-500/70 text-amber-300 shadow-md shadow-amber-950/50 shrink-0 cursor-pointer hover:bg-amber-900/70 transition-all animate-in fade-in duration-200"
                title="Offline Mode: No internet connection detected. Changes saved locally will automatically sync when back online. Click to view sync status."
              >
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span className="tracking-wide uppercase text-[11px]">Offline Mode</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </button>
            )}

            {/* Sync Status Badge (Syncing / Connected / Error) */}
            <button
              id="nav-sheets-status-badge"
              onClick={onOpenSync}
              type="button"
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-all cursor-pointer shrink-0 ${
                isSyncing
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-md'
                  : sheetConnected
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm hover:bg-emerald-900/60'
                  : 'bg-red-950/80 border-red-500/50 text-red-300 shadow-sm hover:bg-red-900/60'
              }`}
              title={
                isSyncing
                  ? 'Syncing with Google Sheets...'
                  : sheetConnected
                  ? `Connected to Google Sheets${lastSyncedAt ? ` (Last synced: ${lastSyncedAt})` : ''}`
                  : 'Google Sheet Not Connected. Click to connect.'
              }
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="text-[11px] font-bold">Syncing...</span>
                </>
              ) : sheetConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold">Connected</span>
                </>
              ) : (
                <>
                  <Table className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-bold">Connect Sheet</span>
                </>
              )}
            </button>

            {/* Add Title Button */}
            {sheetConnected && shows.length > 0 && (
              <button
                id="nav-add-title-btn"
                onClick={onOpenAdd}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-md shadow-red-900/40 border border-red-500/20 whitespace-nowrap cursor-pointer shrink-0 preserve-theme-color"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add Show</span>
              </button>
            )}

            {/* Surprise Me / Random Picker Button */}
            {sheetConnected && shows.length > 0 && onOpenRandomPicker && (
              <button
                id="nav-random-picker-btn"
                onClick={onOpenRandomPicker}
                className="hidden 2xl:flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors border border-zinc-700 shadow-sm whitespace-nowrap cursor-pointer shrink-0"
                title="Surprise Me: Randomly pick a show to watch next"
              >
                <Shuffle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Surprise Me</span>
              </button>
            )}



            {/* Accessibility Menu */}
            <div className="relative shrink-0" ref={accDropdownRef}>
              <button
                id="acc-settings-btn"
                onClick={() => setShowAccMenu(!showAccMenu)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors cursor-pointer ${
                  accessibilitySettings.contrastMode === 'high'
                    ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-700'
                }`}
                title="Accessibility: Title, Remove, Replace Settings"
                aria-label="Accessibility Settings"
              >
                <Accessibility className="w-4 h-4" />
              </button>

              {showAccMenu && (
                <div
                  id="acc-dropdown-menu"
                  className="absolute right-0 mt-2 w-72 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-zinc-800"
                >
                  <div className="px-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Accessibility className="w-4 h-4 text-zinc-300" />
                      <p className="text-white font-medium">Inclusive Communication</p>
                    </div>
                  </div>

                  {/* 1. Color Contrast (WCAG & Gov.uk standard) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-300 font-medium">Color Contrast</label>
                      <span className="text-[10px] text-zinc-400">
                        {accessibilitySettings.contrastMode === 'high' ? 'High Contrast' : 'Default'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'default' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'default'
                            ? 'bg-[red-600] text-white border-red-500 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        Default Dark
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'high' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'high'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        High Contrast
                      </button>
                    </div>
                  </div>


                  {/* 2. Clear Print / Large Print (16pt+ gov.uk recommendation) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Large / Clear Print</label>
                        <span className="text-[10px] text-zinc-400">16pt+ min for sight loss</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            textSize: accessibilitySettings.textSize === 'large' ? 'standard' : 'large',
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.textSize === 'large'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.textSize === 'large' ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 3. Dyslexia-friendly Clear Font */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Dyslexia-Friendly Text</label>
                        <span className="text-[10px] text-zinc-400">Clear sans font & loose tracking</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            dyslexiaFont: !accessibilitySettings.dyslexiaFont,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.dyslexiaFont
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.dyslexiaFont ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 4. Reduced Motion */}
                  <div className="px-3 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Reduce Motion</label>
                        <span className="text-[10px] text-zinc-400">Disable transitions & shakes</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            reduceMotion: !accessibilitySettings.reduceMotion,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.reduceMotion
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.reduceMotion ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Auth / User Menu */}
            {isSignedIn ? (
              <div
                className="relative shrink-0 flex items-center gap-2 z-50"
                ref={userDropdownRef}
                onMouseEnter={handleUserMouseEnter}
                onMouseLeave={handleUserMouseLeave}
              >
                {activeProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNetflixProfileSwitcher(true);
                    }}
                    className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer hover:scale-105 shadow-sm"
                    style={{
                      backgroundColor: `${getViewerColor(activeProfile, viewerColors)}20`,
                      color: getViewerColor(activeProfile, viewerColors),
                      borderColor: `${getViewerColor(activeProfile, viewerColors)}60`,
                    }}
                    title={`Active Profile: ${activeProfile} (Click to switch profile)`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getViewerColor(activeProfile, viewerColors) }}
                    />
                    <span className="truncate max-w-[85px]">{activeProfile}</span>
                  </button>
                )}

                <button
                  id="user-profile-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-2 transition-all cursor-pointer group ${
                    !online
                      ? 'px-2 py-1 rounded bg-amber-950/40 border border-amber-500/30'
                      : 'p-0.5 rounded hover:bg-white/5'
                  }`}
                  title="Account & Sync Settings"
                  aria-label="Account Profile and Settings"
                >
                <div className="relative border-2 border-white/20 group-hover:border-red-500 rounded-full p-[1px] transition-all">
                  <img
                    id="user-profile-btn-avatar"
                    src={profilePictureUrl}
                    alt={profileDisplayName || 'User Profile Picture'}
                    className="w-8 h-8 rounded-full sm:w-9 sm:h-9 object-cover transition-all shadow-sm"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.src !== GOOGLE_AVATAR_DATA_URI) {
                        e.currentTarget.src = GOOGLE_AVATAR_DATA_URI;
                      }
                    }}
                  />
                  
                  {/* Tiny Status Dot / Sync Light with Ping & Blink */}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    {sheetConnected && online && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isSyncing ? 'bg-emerald-400' : 'bg-emerald-400'
                        } ${accessibilitySettings.reduceMotion ? 'hidden' : ''}`}
                      />
                    )}
                    {!online && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 ${
                          accessibilitySettings.reduceMotion ? 'hidden' : ''
                        }`}
                      />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-[#141414] ${
                        !online
                          ? 'bg-amber-500'
                          : sheetConnected
                          ? isSyncing
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-emerald-500 animate-pulse'
                          : 'bg-zinc-500'
                      }`}
                    />
                  </span>
                </div>
                
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div
                  id="user-dropdown-menu"
                  className="absolute right-0 top-full mt-3 w-72 max-h-[calc(100vh-90px)] bg-[#181818] border border-zinc-800 rounded-xl shadow-2xl py-2 text-sm z-50 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto"
                >
                  <div className="pt-2 mt-1 space-y-2">
                    {/* Profile Picture & Account Header inside dropdown */}
                    <div
                      id="account-dropdown-profile-header"
                      className="p-3.5 bg-zinc-900/50 flex flex-col gap-3 mx-2 rounded-xl"
                    >
                      <a
                        href="https://myaccount.google.com/?pli=1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 min-w-0 group hover:opacity-90 transition-opacity block"
                        title="Manage Google Account"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              id="account-dropdown-profile-pic"
                              src={profilePictureUrl}
                              alt={profileDisplayName || 'Account Profile Picture'}
                              className="w-10 h-10 rounded-full object-cover ring-2 shadow-md"
                              style={{ ['--tw-ring-color' as any]: 'var(--theme-accent)' }}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.currentTarget.src !== GOOGLE_AVATAR_DATA_URI) {
                                  e.currentTarget.src = GOOGLE_AVATAR_DATA_URI;
                                }
                              }}
                            />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#181818]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-white truncate">
                                {profileDisplayName}
                              </p>
                              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-700/40 px-1.5 py-0.5 rounded">
                                Google
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                              {profileEmail}
                            </p>
                          </div>
                        </div>
                      </a>

                      <div className="px-3.5 pb-2">
                        <button
                          id="sync-settings-dropdown-btn"
                          onClick={() => {
                            setShowUserMenu(false);
                            setSettingsModalTab('sync');
                            setShowSettingsCenterModal(true);
                          }}
                          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                        >
                          Sync Settings
                        </button>
                      </div>
                    </div>

                    <button
                      id="user-profile-stats-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenDashboard) onOpenDashboard();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-red-500 preserve-theme-color" />
                        <span>Stats & Analytics</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>

                    <button
                      id="settings-dropdown-btn"
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setSettingsModalTab('all');
                        setShowSettingsCenterModal(true);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-zinc-200 hover:text-white hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-red-500 preserve-theme-color" />
                        <span>Settings</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>

                    <button
                      id="account-dropdown-switch-profile-btn"
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowNetflixProfileSwitcher(true);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-zinc-200 hover:text-white hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-red-500 preserve-theme-color" />
                        <span>Switch Profile</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>

                    <button
                      id="account-dropdown-signout-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition-colors preserve-theme-color"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>

                    {/* App Version Info in Dropdown Footer */}
                    <div className="px-3.5 py-2 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-[10px] text-zinc-500 select-none">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-red-500" />
                        <span>ShowFlix Tracker</span>
                      </span>
                      <span className="font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60 font-semibold">
                        {APP_VERSION}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          </div>

          {/* MOBILE & TABLET (< xl): Quick Accessibility + Quick Add + Hamburger Toggle */}
          <div className="flex xl:hidden items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Offline Mode Badge */}
            {!online && (
              <button
                id="mobile-nav-offline-mode-badge"
                onClick={onOpenSync}
                type="button"
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded border bg-amber-950/90 border-amber-500/60 text-amber-300 shrink-0 cursor-pointer animate-in fade-in"
                title="Offline Mode Active - Click for sync details"
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span className="hidden xs:inline sm:inline">Offline Mode</span>
                <span className="xs:hidden">Offline</span>
              </button>
            )}

            {/* Accessibility Menu for Mobile / Tablet */}
            <div className="relative shrink-0" ref={mobileAccDropdownRef}>
              <button
                id="mobile-acc-settings-btn"
                type="button"
                onClick={() => setShowAccMenu(!showAccMenu)}
                className={`p-2 rounded-md transition-colors border cursor-pointer ${
                  accessibilitySettings.contrastMode === 'high'
                    ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                    : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800'
                }`}
                title="Accessibility & Inclusive Communication"
                aria-label="Accessibility & Inclusive Communication"
              >
                <Accessibility className="w-4 h-4" />
              </button>

              {showAccMenu && (
                <div
                  id="mobile-acc-dropdown-menu"
                  className="absolute right-0 mt-2 w-[calc(100vw-2.5rem)] max-w-xs sm:w-72 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl py-2.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-zinc-800"
                >
                  <div className="px-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Accessibility className="w-4 h-4 text-zinc-300" />
                      <p className="text-white font-medium">Inclusive Communication</p>
                    </div>
                  </div>

                  {/* 1. Color Contrast (WCAG & Gov.uk standard) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-300 font-medium">Color Contrast</label>
                      <span className="text-[10px] text-zinc-400">
                        {accessibilitySettings.contrastMode === 'high' ? 'High Contrast' : 'Default'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'default' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'default'
                            ? 'bg-[red-600] text-white border-red-500 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        Default Dark
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({ ...accessibilitySettings, contrastMode: 'high' })
                        }
                        className={`px-2 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                          accessibilitySettings.contrastMode === 'high'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        High Contrast
                      </button>
                    </div>
                  </div>


                  {/* 2. Clear Print / Large Print (16pt+ gov.uk recommendation) */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Large / Clear Print</label>
                        <span className="text-[10px] text-zinc-400">16pt+ min for sight loss</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            textSize: accessibilitySettings.textSize === 'large' ? 'standard' : 'large',
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.textSize === 'large'
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.textSize === 'large' ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 3. Dyslexia-friendly Clear Font */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Dyslexia-Friendly Text</label>
                        <span className="text-[10px] text-zinc-400">Clear sans font & loose tracking</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            dyslexiaFont: !accessibilitySettings.dyslexiaFont,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.dyslexiaFont
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.dyslexiaFont ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* 4. Reduced Motion */}
                  <div className="px-3 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-zinc-300 font-medium block">Reduce Motion</label>
                        <span className="text-[10px] text-zinc-400">Disable transitions & shakes</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccessibilitySettings({
                            ...accessibilitySettings,
                            reduceMotion: !accessibilitySettings.reduceMotion,
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          accessibilitySettings.reduceMotion
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {accessibilitySettings.reduceMotion ? 'Enabled' : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {sheetConnected && shows.length > 0 && (
              <button
                id="mobile-quick-add-btn"
                onClick={onOpenAdd}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors shadow-md shadow-red-900/30 cursor-pointer preserve-theme-color"
                title="Add Show"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Show</span>
              </button>
            )}

            {/* Hamburger Button for Mobile & Tablet */}
            {sheetConnected && (
              <button
                id="mobile-menu-toggle-btn"
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-2 rounded-md transition-colors border ${
                  isMobileMenuOpen
                    ? 'bg-zinc-800 text-white border-red-500'
                    : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800'
                }`}
                aria-label="Toggle navigation menu"
                title="Menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : (
                  <div className="relative">
                    <Menu className="w-5 h-5" />
                    {sheetConnected && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            online ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        ></span>
                        <span
                          className={`relative inline-flex rounded-full h-2 w-2 ${
                            online ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        ></span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE & TABLET EXPANDED DROPDOWN MENU */}
      {isMobileMenuOpen && (
        <div
          id="mobile-dropdown-panel"
          className="xl:hidden bg-[#141414]/98 border-b border-zinc-800 backdrop-blur-xl shadow-2xl px-4 py-4 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200"
        >
          {/* Offline Mode Alert in Mobile Drawer */}
          {!online && (
            <div className="p-3 rounded-lg bg-amber-950/80 border border-amber-500/50 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <div>
                  <p className="font-bold text-amber-300">Offline Mode Active</p>
                  <p className="text-[10px] text-zinc-400">Actions are stored locally & will sync when online</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenSync();
                }}
                className="text-[10px] font-semibold bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded transition-colors"
              >
                Sync Info
              </button>
            </div>
          )}

          {/* Mobile Search Bar & Recent Search Tags */}
          {sheetConnected && (
            <div className="space-y-2 pb-1 border-b border-zinc-800/80">
              <div className="flex items-center bg-[#202020] border border-zinc-700 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-red-500 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search titles, genres, platforms..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      saveRecentSearch(searchQuery);
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  className="bg-transparent text-xs text-white focus:outline-none w-full placeholder:text-zinc-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Live Matching Shows Preview (Poster & Info) */}
              {searchQuery.trim() && matchingShows.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between px-1 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-zinc-300">
                      <Film className="w-3 h-3 text-red-500" />
                      Results Preview ({matchingShows.length})
                    </span>
                    <span className="text-[10px] text-zinc-500 lowercase">tap to open</span>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {matchingShows.map((show) => {
                      const poster = show.posterUrl ? getOptimizedPoster(show.posterUrl) : null;
                      return (
                        <div
                          key={`mobile-search-${show.id}`}
                          onClick={() => {
                            saveRecentSearch(show.title);
                            setIsMobileMenuOpen(false);
                            if (onOpenDetails) onOpenDetails(show);
                          }}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-red-500/60 transition-colors cursor-pointer"
                        >
                          <div className="w-9 h-12 rounded overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 relative">
                            {poster ? (
                              <img src={poster} alt={show.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500 font-bold">
                                {show.title.slice(0, 3)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h5 className="text-xs font-bold text-white truncate">{show.title}</h5>
                              {show.rating && (
                                <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                                  ⭐ {show.rating}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                              <span>{show.type || 'Show'}</span>
                              {show.type === 'Series' && (show.seasons || show.episodes) && (
                                <span className="font-mono text-zinc-300">
                                  • {formatS(show.seasons || 'S1')} {formatE(show.episodes || 'E1')}
                                </span>
                              )}
                              {show.year ? <span>• {show.year}</span> : null}
                            </p>
                            <span className="text-[9px] font-semibold text-emerald-300">
                              {show.status || 'Tracked'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mobile Recent Searches Quick Chips */}
              {recentSearches.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between px-1 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3 text-red-500" />
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecentSearches}
                      className="text-zinc-500 hover:text-red-400 lowercase text-[10px] cursor-pointer"
                    >
                      clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.slice(0, 6).map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          onSearchChange(term);
                          saveRecentSearch(term);
                          setIsMobileMenuOpen(false);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <History className="w-2.5 h-2.5 text-zinc-500" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. Category Navigation Links */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2">
              Browse Categories
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-1">
              <button
                id="mobile-dropdown-home"
                onClick={() => {
                  onSelectPlatform('all');
                  handleMobileNavClick('all');
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  activeFilter === 'all' && selectedPlatform === 'all'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>🏠 Home</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                id="mobile-dropdown-series"
                onClick={() => handleMobileNavClick('Series')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === 'Series'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Series</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                id="mobile-dropdown-movies"
                onClick={() => handleMobileNavClick('Movie')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === 'Movie'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>Movies</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                id="mobile-dropdown-watching"
                onClick={() => handleMobileNavClick('⏳ Watching')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === '⏳ Watching'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>⏳ Watching</span>
                {watchingCount > 0 && (
                  <span className="text-[10px] bg-black/40 text-amber-200 font-bold px-1.5 py-0.5 rounded">
                    {watchingCount}
                  </span>
                )}
              </button>

              <button
                id="mobile-dropdown-watched"
                onClick={() => handleMobileNavClick('✅ Watched')}
                className={`col-span-2 md:col-span-4 w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === '✅ Watched'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>✅ Watched</span>
                {watchedCount > 0 && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-700/50">
                    {watchedCount}
                  </span>
                )}
              </button>

              <button
                id="mobile-dropdown-wishlist"
                onClick={() => handleMobileNavClick('🎁 Wishlist')}
                className={`col-span-2 md:col-span-4 w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeFilter === '🎁 Wishlist' || activeFilter === 'Wishlist'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>🎁 Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="text-[10px] bg-amber-950 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-700/50">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                id="mobile-dropdown-stats-btn"
                onClick={() => {
                  if (onOpenDashboard) onOpenDashboard();
                  setIsMobileMenuOpen(false);
                }}
                className="col-span-2 md:col-span-4 w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-red-500/60 shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-red-500" />
                  <span>Stats & Analytics Dashboard</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>

          {/* 2. All Streaming Platforms */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-red-500" />
                Streaming Platforms
              </p>
              {selectedPlatform !== 'all' && (
                <button
                  onClick={() => onSelectPlatform('all')}
                  className="text-[10px] text-red-400 hover:text-red-300 underline"
                >
                  Reset Platform
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => {
                  onSelectPlatform('all');
                  handleMobileNavClick('All Titles');
                }}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedPlatform === 'all' && activeFilter === 'All Titles'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                All Platforms (Show All)
              </button>
              {availablePlatforms.map((p) => {
                const isSelected = selectedPlatform === p.raw;
                return (
                  <button
                    key={p.raw}
                    onClick={() => handleMobilePlatformClick(p.raw)}
                    className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white font-bold'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <span>{p.raw}</span>
                    {p.count > 0 && (
                      <span className="text-[10px] opacity-75 font-mono">({p.count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Account / User Profile Section */}
          <div className="pt-2 border-t border-zinc-800 space-y-3">
            {/* Mobile Navigation Drawer Profile Card with Profile Picture */}
            <div
              id="mobile-drawer-profile-card"
              className="p-3 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 shadow-lg"
            >
              <a
                href="https://myaccount.google.com/?pli=1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0 group hover:opacity-90 transition-opacity block flex-1"
                title="Manage Google Account"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      id="mobile-drawer-profile-pic"
                      src={profilePictureUrl}
                      alt={profileDisplayName || 'Mobile Profile Picture'}
                      className="w-10 h-10 rounded-full object-cover ring-2 shadow-sm"
                      style={{ ['--tw-ring-color' as any]: 'var(--theme-accent)' }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (e.currentTarget.src !== GOOGLE_AVATAR_DATA_URI) {
                          e.currentTarget.src = GOOGLE_AVATAR_DATA_URI;
                        }
                      }}
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#141414]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {profileDisplayName}
                      </h4>
                      <span className="text-[9px] bg-emerald-950 text-emerald-300 font-semibold px-1.5 py-0.5 rounded border border-emerald-700/50">
                        Google
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                      {profileEmail}
                    </p>
                  </div>
                </div>
              </a>

              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setSettingsModalTab('sync');
                    setShowSettingsCenterModal(true);
                  }}
                  className="text-[11px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  Sync Settings
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setSettingsModalTab('all');
                  setShowSettingsCenterModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 shrink-0 text-red-500" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowNetflixProfileSwitcher(true);
                }}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 shrink-0 text-red-500" />
                <span>Switch Profile</span>
              </button>

              <button
                id="mobile-signout-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 py-2.5 rounded-lg transition-colors cursor-pointer preserve-theme-color"
              >
                <LogOut className="w-4 h-4 shrink-0 preserve-theme-color" />
                <span>Sign Out</span>
              </button>

              {/* Mobile Drawer Version Footer */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 font-medium select-none border-t border-zinc-800/60 mt-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-red-500" />
                  <span>ShowFlix Tracker Pro</span>
                </span>
                <span className="font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-[10px] font-bold">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Center Modal (3x2 Control Panel matching user's rough sketch) */}
      <SettingsCenterModal
        isOpen={showSettingsCenterModal}
        defaultTab={settingsModalTab}
        onClose={() => {
          setShowSettingsCenterModal(false);
          setSettingsModalTab('all');
        }}
        user={user}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        spreadsheetId={spreadsheetId}
        sheetName={sheetName}
        wishlistSheetName={wishlistSheetName}
        availableTabs={availableTabs}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        isSyncing={Boolean(isSyncing)}
        lastSyncedAt={lastSyncedAt}
        sheetTitle={sheetTitle}
        shows={shows}
        autoSyncEnabled={autoSyncEnabled}
        onToggleAutoSync={onToggleAutoSync}
        syncFrequency={syncFrequency}
        onUpdateSyncFrequency={onUpdateSyncFrequency}
        onTriggerSync={onTriggerSync}
        isOnline={isOnline}
        customViewers={customViewers}
        onUpdateCustomViewers={onUpdateCustomViewers || (() => {})}
        viewerColors={viewerColors}
        onUpdateViewerColors={onUpdateViewerColors}
        alertIntervals={alertIntervals}
        onUpdateAlertIntervals={onUpdateAlertIntervals}
        activeProfile={activeProfile}
        onSwitchProfile={onSwitchProfile}
        accessibilitySettings={accessibilitySettings}
        setAccessibilitySettings={setAccessibilitySettings}
      />

      {/* Netflix-Style "Who's Watching?" Profile Switcher Modal */}
      <NetflixProfileSwitcherModal
        isOpen={showNetflixProfileSwitcher}
        onClose={() => setShowNetflixProfileSwitcher(false)}
        customViewers={customViewers}
        activeProfile={activeProfile}
        onSwitchProfile={onSwitchProfile}
        viewerColors={viewerColors}
        viewerAvatars={viewerAvatars}
        onUpdateViewerAvatars={onUpdateViewerAvatars}
        onUpdateViewerColors={onUpdateViewerColors}
        onUpdateCustomViewers={onUpdateCustomViewers}
        shows={shows}
        onOpenManageProfiles={() => {
          setSettingsModalTab('user');
          setShowSettingsCenterModal(true);
        }}
      />

      {/* Report Issue & Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        userEmail={profileEmail}
        userName={profileDisplayName}
        totalShowsCount={shows.length}
        isOnline={online}
        activeProfile={activeProfile}
      />
    </header>
  );
}
