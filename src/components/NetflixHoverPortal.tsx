import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Plus, Check, Info, Star, ThumbsUp, Heart, Bell, BellRing, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';
import { getOrFetchImdbUrl } from '../services/posterService';
import { formatToDDMMYYYY, formatToLocalDisplay } from '../utils/dateUtils';
import { calculateShowProgress } from '../utils/showMetrics';
import { isShowOutNow, isFutureRelease, parseReleaseDateToTimestamp, isReleaseDatePast, getEffectiveReleaseInfo } from '../services/notificationService';
import { useNotificationContext } from '../context/NotificationContext';
import { fetchLiveTvMazeInfo, TvMazeEpisode, TvMazeShowInfo } from '../services/tvMazeService';
import { getViewerColor } from '../utils/profileColors';
import { getPriorityIndicator } from '../utils/priorityUtils';

interface NetflixHoverPortalProps {
  show: ShowItem;
  rect: { top: number; left: number; width: number; height: number };
  onClose: () => void;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  onUpdateRating: (show: ShowItem, ratingNum: number) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  viewerColors?: Record<string, string>;
}

export default function NetflixHoverPortal({
  show,
  rect,
  onClose,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  onUpdateRating,
  onMouseEnter,
  onMouseLeave,
  viewerColors,
}: NetflixHoverPortalProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isResolvingImdb, setIsResolvingImdb] = useState(false);
  const { isNotificationEnabled, toggleNotification } = useNotificationContext();
  const isNotifActive = isNotificationEnabled(show);

  const [liveAirstamp, setLiveAirstamp] = useState<string | null>(null);
  const [liveNextEpisode, setLiveNextEpisode] = useState<TvMazeEpisode | null>(null);
  const [liveEpisodeNote, setLiveEpisodeNote] = useState<string | null>(null);
  const [tvMazeInfo, setTvMazeInfo] = useState<TvMazeShowInfo | null>(null);

  const effectiveInfo = useMemo(() => {
    return getEffectiveReleaseInfo(show, tvMazeInfo || liveAirstamp);
  }, [show, tvMazeInfo, liveAirstamp]);

  useEffect(() => {
    const userTs = parseReleaseDateToTimestamp(show.releaseDate);
    const isPast = isReleaseDatePast(show.releaseDate);
    
    // Only skip TVMaze fetch if we have a valid future release date from the user
    if ((userTs && !isPast) || show.type !== 'Series') {
      setLiveAirstamp(null);
      setLiveNextEpisode(null);
      setLiveEpisodeNote(null);
      setTvMazeInfo(null);
      return;
    }

    let isMounted = true;
    fetchLiveTvMazeInfo(show.title).then((info) => {
      if (isMounted && info) {
        setTvMazeInfo(info);
        if (info.nextEpisode) {
          setLiveAirstamp(info.nextEpisode.airstamp);
          setLiveNextEpisode(info.nextEpisode);
          setLiveEpisodeNote(`S${info.nextEpisode.season} E${info.nextEpisode.number}: ${info.nextEpisode.name}`);
        }
      }
    }).catch((err) => console.warn('Hover TVMaze fetch failed:', err));

    return () => {
      isMounted = false;
    };
  }, [show.id, show.title, show.releaseDate]);

  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const targetSource = effectiveInfo.nextEpisodeTimestamp || (effectiveInfo.isFuture ? effectiveInfo.timestamp : null);

    if (!targetSource) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const nowMs = Date.now();
      const diff = targetSource - nowMs;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const d = Math.floor(diff / (24 * 60 * 60 * 1000));
      const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      const s = Math.floor((diff % (60 * 1000)) / 1000);

      setTimeLeft({ d, h, m, s });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [effectiveInfo.timestamp, effectiveInfo.isFuture, effectiveInfo.nextEpisodeTimestamp]);

  const handleToggleNotif = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleNotification(show);
  };

  const handleOpenImdb = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (show.imdbId && show.imdbId.startsWith('tt')) {
      window.open(`https://www.imdb.com/title/${show.imdbId}/`, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsResolvingImdb(true);
    try {
      const url = await getOrFetchImdbUrl(show.title, show.imdbId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setIsResolvingImdb(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cardContentRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  // Mark mounted for transition start and listen for tap outside (critical for mobile/tablet dismiss)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (isMobile) {
        if (cardContentRef.current && !cardContentRef.current.contains(e.target as Node)) {
          onClose();
        }
      } else {
        if (portalRef.current && !portalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [onClose, isMobile]);



  // Safe scale factor based on screen size (subtle 1.2x scale on mobile, full cinematic 1.45x on desktop)
  const scaleFactor = useMemo(() => {
    return isMobile ? 1.2 : 1.45;
  }, [isMobile]);

  // Premium viewport boundary auto-fit math (prevents any visual card bleeding offscreen)
  const placement = useMemo(() => {
    let width = rect.width;
    let height = rect.height;
    let left = rect.left;
    let top = rect.top;

    // Ideal uniform card dimensions to match the main page carousels
    const idealWidth = 256;
    const idealHeight = 144;

    // If the card is scaled or stretched differently (e.g. in a filter page grid view), we normalize it!
    if (Math.abs(width - idealWidth) > 5) {
      const diffX = width - idealWidth;
      left = left + diffX / 2;
      width = idealWidth;
    }
    if (Math.abs(height - idealHeight) > 5) {
      const diffY = height - idealHeight;
      top = top + diffY / 2;
      height = idealHeight;
    }

    // The scale extends the boundaries outward from center
    const expandedWidth = width * scaleFactor;
    const expandedHeight = height * scaleFactor;

    const bleedX = (expandedWidth - width) / 2;
    const bleedY = (expandedHeight - height) / 2;

    const visualLeft = left - bleedX;
    const visualTop = top - bleedY;
    const visualRight = visualLeft + expandedWidth;
    const visualBottom = visualTop + expandedHeight;

    const padding = 10; // 10px safe margin from viewport edge
    let shiftX = 0;
    let shiftY = 0;

    if (typeof window !== 'undefined') {
      // Correct horizontal bleed
      if (visualLeft < padding) {
        shiftX = padding - visualLeft;
      } else if (visualRight > window.innerWidth - padding) {
        shiftX = (window.innerWidth - padding) - visualRight;
      }

      // Correct vertical bleed
      if (visualTop < padding) {
        shiftY = padding - visualTop;
      } else if (visualBottom > window.innerHeight - padding) {
        shiftY = (window.innerHeight - padding) - visualBottom;
      }
    }

    return {
      top: top + window.scrollY + shiftY,
      left: left + window.scrollX + shiftX,
      width,
      height,
    };
  }, [rect, scaleFactor]);

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

  const currentEpNum = parseInt(show.episodes.replace(/[^0-9]/g, '')) || 1;
  const maxEpNum = parseInt(show.maxEp.replace(/[^0-9]/g, '')) || 8;
  const progress = calculateShowProgress(show);

  const isWatched = show.status === '✅ Watched';
  const isWatching = show.status === '⏳ Watching';
  const isMovie = show.type === 'Movie';

  // Visually display all Priority indicator types (🔴 High, 🟡 Medium, 🟢 Low, or custom)
  const priorityIndicator = useMemo(
    () => getPriorityIndicator(show.priority, show.isWishlist),
    [show.priority, show.isWishlist]
  );

  // Calculate high match score dynamically based on title characters & ratings for realism
  const matchScore = useMemo(() => {
    const code = show.title.charCodeAt(0) || 75;
    const ratingBonus = show.ratingNum ? show.ratingNum * 3 : 10;
    return 84 + (code % 11) + ratingBonus;
  }, [show.title, show.ratingNum]);

  // Video quality dynamic resolution based on year/genre for high fidelity
  const qualityBadge = useMemo(() => {
    const yr = parseInt(String(show.year)) || 2024;
    if (yr >= 2021) return '4K Ultra HD';
    if (yr >= 2016) return 'HDR';
    return 'HD';
  }, [show.year]);

  // Suggested age rating based on genre tags
  const ageRating = useMemo(() => {
    const g = show.genre.toLowerCase();
    if (g.includes('action') || g.includes('thriller') || g.includes('crime') || g.includes('horror')) return 'TV-MA';
    if (g.includes('drama') || g.includes('romance') || g.includes('comedy')) return 'TV-14';
    return 'PG';
  }, [show.genre]);

  const containerStyle = useMemo(() => {
    if (isMobile) {
      return {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      };
    }
    return {
      position: 'absolute' as const,
      top: placement.top,
      left: placement.left,
      width: placement.width,
      height: placement.height,
      zIndex: 99999,
      transformOrigin: 'center center',
    };
  }, [isMobile, placement]);

  return createPortal(
    <div
      ref={portalRef}
      style={containerStyle}
      onMouseEnter={isMobile ? undefined : onMouseEnter}
      onMouseLeave={isMobile ? undefined : onMouseLeave}
      className="pointer-events-auto selection:bg-[#E50914] selection:text-white netflix-hover-portal-active relative"
    >
      {/* Ultra-Bright Cinematic Backlight Ambient Glow */}
      {!isMobile && (
        <div 
          className="absolute inset-[-60px] sm:inset-[-80px] z-0 opacity-95 blur-[55px] sm:blur-[70px] saturate-[280%] pointer-events-none transition-all duration-300 select-none rounded-[40px] transform scale-105"
          style={{
            backgroundImage: `url(${getOptimizedPoster(show.backdropUrl || show.posterUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <motion.div
        ref={cardContentRef}
        initial={isMobile ? { scale: 0.9, opacity: 0 } : { scale: 1, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        animate={isMobile ? { scale: 1, opacity: 1 } : {
          scale: scaleFactor,
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.95), 0 0 45px 10px rgba(0, 0, 0, 0.7)',
        }}
        exit={isMobile ? { scale: 0.9, opacity: 0 } : { scale: 1, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className={isMobile 
          ? "w-full max-w-[340px] bg-[#181818] rounded-2xl overflow-hidden border border-zinc-800 flex flex-col pointer-events-auto shadow-2xl relative z-10" 
          : "w-full bg-[#181818] rounded-xl overflow-hidden border border-zinc-800/80 flex flex-col pointer-events-auto relative shadow-2xl z-10"
        }
      >
        {/* Interior Ambient Poster Color Blur */}
        <div 
          className="absolute inset-0 z-0 opacity-20 blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${getOptimizedPoster(show.backdropUrl || show.posterUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Cinematic Media Header */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
          <img
            src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
            alt={show.title}
            className="w-full h-full object-cover object-center filter brightness-95 transform scale-100 animate-kenburns"
            style={{
              animation: 'kenburns-pan-zoom 15s ease-out infinite alternate',
              imageRendering: 'auto',
            }}
          />
          
          {/* Dynamic Scrim & Gradient (Strict ContrastAA Scrim) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/30 to-transparent pointer-events-none" />

          {/* Floating Action Brand Overlay */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between z-20 pointer-events-auto">
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-zinc-200 backdrop-blur-sm border border-zinc-700/50 shadow-md">
                  {show.platform}
                </span>
              </div>
              {(show.isWishlist || priorityIndicator) && (
                <div className="flex items-center gap-1 flex-wrap">
                  {show.isWishlist && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/95 text-black border border-amber-400 shadow-md shrink-0">
                      🎁 Wishlist
                    </span>
                  )}
                  {priorityIndicator && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border shadow-md shrink-0 flex items-center gap-0.5 ${priorityIndicator.className}`}
                      title={`Priority: ${priorityIndicator.tooltip}`}
                    >
                      {priorityIndicator.label}
                    </span>
                  )}
                </div>
              )}
              {(show.releaseDate || liveNextEpisode || liveAirstamp || show.nextAirDate || show.nextAirTimestamp || show.lastAirTimestamp || tvMazeInfo?.previousEpisode) && (
                effectiveInfo.isOut ? (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black border border-emerald-400 shadow-md shrink-0 flex items-center gap-1 animate-pulse font-sans">
                    🎉 OUT NOW!
                  </span>
                ) : (effectiveInfo.isPastWindow && !effectiveInfo.isNextEpisode) ? null : (
                  <span
                    className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-black border border-amber-300 shadow-md shrink-0 flex items-center gap-0.5 font-sans"
                    title={
                      effectiveInfo.isNextEpisode && liveNextEpisode
                        ? `Next Episode: ${liveNextEpisode.name} (${formatToLocalDisplay(liveNextEpisode.airstamp || liveNextEpisode.airdate)})`
                        : show.releaseDate
                        ? `Release Date: ${formatToLocalDisplay(show.releaseDate)}`
                        : ''
                    }
                  >
                    ⏰ {effectiveInfo.label || effectiveInfo.formattedDateStr || ''}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenImdb}
                disabled={isResolvingImdb}
                className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 active:scale-95 text-black shadow-lg transition-all hover:scale-105 cursor-pointer border border-amber-300/80 disabled:opacity-60"
                title="Open Official IMDb Title Page"
              >
                {isResolvingImdb ? '...' : 'IMDb ↗'}
              </button>
              <span className="hidden sm:block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-700 shadow-md">
                {show.genre.split('/')[0].trim()}
              </span>
              {isMobile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-6 h-6 rounded-full bg-black/75 border border-zinc-600/60 backdrop-blur-sm text-zinc-200 flex items-center justify-center hover:bg-black hover:text-white active:scale-90 transition-all cursor-pointer shadow-md shrink-0"
                  aria-label="Close"
                >
                  <span className="text-xs font-bold leading-none">✕</span>
                </button>
              )}
            </div>
          </div>

          {/* Floating Quick Title */}
          <div className="absolute bottom-3 left-3 right-3">
            <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight max-w-full truncate shadow-md">
              {show.title}
            </h4>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        {isWatching && (
          <div className="w-full h-1.5 bg-zinc-800">
            <div
              data-progress-bar="true"
              data-preserve-theme="true"
              className="h-full bg-[#E50914] preserve-theme-color progress-bar-fill transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {isWatched && <div className="w-full h-1.5 bg-emerald-500" />}

        {/* Premium Expanded Metadata & Interactive Controls Panel */}
        <div className="p-3.5 bg-[#181818] space-y-4">
          {/* Primary Action Buttons Row - Perfectly distributed full-width layout with zero wrapping & sleek h-9 height */}
          <div className="flex items-center w-full gap-1.5 flex-nowrap h-9">
            {!isMovie && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrementEpisode(show);
                }}
                className="flex-[2.2] h-full flex items-center justify-center gap-1.5 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs rounded-md transition-all active:scale-95 shadow-lg hover:scale-[1.02] cursor-pointer min-w-0 overflow-hidden"
                title={`Next Episode: Ep ${currentEpNum + 1}`}
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span className="truncate">Play Ep {currentEpNum}</span>
              </button>
            )}

            {/* Quick Watchlist Status Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(show);
              }}
              className={`flex-1 h-full rounded-md border flex items-center justify-center transition-all hover:scale-110 cursor-pointer shadow-md min-w-0 ${
                isWatched
                  ? 'bg-emerald-600/90 border-emerald-500/50 text-white hover:bg-emerald-500'
                  : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-700/60 hover:border-zinc-500 text-white'
              }`}
              title={isWatched ? 'Mark as Watching' : 'Mark as Completed'}
            >
              {isWatched ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>

            {/* Notification Alert Toggle */}
            {(Boolean(show.releaseDate) || Boolean(show.releaseNote) || Boolean(liveAirstamp) || isFutureRelease(show)) && (
              <button
                type="button"
                onClick={handleToggleNotif}
                className={`flex-1 h-full rounded-md border flex items-center justify-center transition-all hover:scale-110 cursor-pointer shadow-md min-w-0 ${
                  isNotifActive
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-zinc-800/90 hover:bg-zinc-700 border-zinc-700/60 hover:border-zinc-500 text-zinc-300'
                }`}
                title={isNotifActive ? '24h Release Alert Active (Click to disable)' : 'Notify me 24 hours before release'}
              >
                {isNotifActive ? (
                  <BellRing className="w-5 h-5 fill-current animate-pulse" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Expand Details Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(show);
                onClose();
              }}
              className="flex-1 h-full rounded-md bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/60 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer shadow-md min-w-0"
              title="More Info Details"
            >
              <Info className="w-5 h-5 text-zinc-300" />
            </button>
          </div>

          {/* Unboxed Micro-Metadata Items (Genre, Year, Series/Movie) */}
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-semibold text-zinc-300 leading-none">
            <span className="text-zinc-100 font-bold truncate max-w-[120px] sm:max-w-none" title={show.genre}>
              {show.genre.split('/')[0].trim()}
            </span>
            <span aria-hidden="true" className="text-zinc-600">•</span>
            <span className="text-zinc-300 font-semibold">{show.year}</span>
            <span aria-hidden="true" className="text-zinc-600">•</span>
            <span className="text-zinc-300 font-semibold">
              {isMovie ? 'Movie' : 'Series'}
            </span>
          </div>

          {/* Viewer Profile Name Indicator */}
          {show.who && (
            <div className="text-xs sm:text-sm text-zinc-300 font-medium flex items-center gap-2 flex-wrap">
              <span>Watching with:</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-xs border shadow-sm"
                style={{
                  backgroundColor: `${getViewerColor(show.who, viewerColors)}20`,
                  color: getViewerColor(show.who, viewerColors),
                  borderColor: `${getViewerColor(show.who, viewerColors)}50`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getViewerColor(show.who, viewerColors) }}
                />
                {show.who}
              </span>
            </div>
          )}

          {/* Release Premiere Info Bar */}
          {(show.releaseDate || show.releaseNote || liveAirstamp || liveEpisodeNote || show.nextAirDate || show.nextAirTimestamp) && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/25 shadow-sm text-xs text-amber-300 font-bold">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-black">
                  <span>⏰</span>
                  <span>Target Premiere</span>
                </span>
                {(show.releaseDate || liveNextEpisode || liveAirstamp || show.nextAirDate || show.nextAirTimestamp) && (
                  <span className="text-zinc-400 font-medium font-mono text-[10px]">
                    {effectiveInfo.formattedDateStr || effectiveInfo.label || ''}
                  </span>
                )}
              </div>

              {/* Ticking Countdown & OUT NOW status */}
              {effectiveInfo.isOut ? (
                <div className="space-y-1.5 pt-1.5 border-t border-emerald-500/20">
                  <div className="text-emerald-400 font-black animate-pulse flex items-center gap-1.5 text-xs">
                    <span>🎉 OUT NOW! WATCH NOW!</span>
                    {effectiveInfo.outNowEpisode?.season && (
                      <span className="text-emerald-300 font-bold">
                        (S{effectiveInfo.outNowEpisode.season} E{effectiveInfo.outNowEpisode.number})
                      </span>
                    )}
                  </div>
                  {timeLeft && effectiveInfo.upcomingEpisode && (
                    <div className="flex items-center gap-1 font-mono text-amber-400 font-bold text-xs pt-1 border-t border-zinc-800">
                      <span className="text-zinc-400 font-sans text-[10px] uppercase font-bold mr-1">
                        Next S{effectiveInfo.upcomingEpisode.season} E{effectiveInfo.upcomingEpisode.number}:
                      </span>
                      <span>{timeLeft.d}d</span>
                      <span className="text-zinc-600 font-sans mx-0.5">:</span>
                      <span>{timeLeft.h}h</span>
                      <span className="text-zinc-600 font-sans mx-0.5">:</span>
                      <span>{timeLeft.m}m</span>
                      <span className="text-zinc-600 font-sans mx-0.5">:</span>
                      <span className="animate-pulse">{timeLeft.s}s</span>
                    </div>
                  )}
                </div>
              ) : timeLeft ? (
                <div className="space-y-1 pt-1.5 border-t border-amber-500/10">
                  <div className="flex items-center gap-1 font-mono text-amber-400 font-black text-sm">
                    <span className="text-zinc-500 font-sans text-[10px] uppercase font-bold tracking-wider mr-1.5">Starts In:</span>
                    <span>{timeLeft.d}d</span>
                    <span className="text-zinc-600 font-sans font-normal mx-0.5">:</span>
                    <span>{timeLeft.h}h</span>
                    <span className="text-zinc-600 font-sans font-normal mx-0.5">:</span>
                    <span>{timeLeft.m}m</span>
                    <span className="text-zinc-600 font-sans font-normal mx-0.5">:</span>
                    <span className="animate-pulse">{timeLeft.s}s</span>
                  </div>
                  {(show.releaseNote || liveEpisodeNote) && (
                    <p className="text-[10px] text-zinc-400 font-medium line-clamp-1 italic">
                      Note: {show.releaseNote || liveEpisodeNote}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-zinc-400 font-medium pt-1 border-t border-amber-500/10">
                  {show.releaseNote || liveEpisodeNote || effectiveInfo.label || 'Airing soon'}
                </div>
              )}
            </div>
          )}

          {/* Synopsis Snippet (Beautifully truncated) */}
          {show.synopsis ? (
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal line-clamp-3">
              {show.synopsis}
            </p>
          ) : show.notes ? (
            <p className="text-xs sm:text-sm text-zinc-200 italic leading-relaxed font-normal line-clamp-3">
              "{show.notes}"
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-zinc-400 italic leading-relaxed font-normal">
              No overview synopsis has been entered. Custom details may be added directly to your Google Sheet or within the detail panel.
            </p>
          )}

          {/* Dedicated Star Rating Row at the very bottom */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-zinc-800/30 px-3 py-1.5 rounded-full border border-zinc-700/30 backdrop-blur-sm shadow-inner" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => {
                return (
                  <motion.button
                    key={star}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateRating(show, star);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-0.5 cursor-pointer"
                    title={`Rate ${star} Stars`}
                  >
                    <motion.div
                      animate={{ scale: (hoverRating || show.ratingNum || 0) >= star ? [1, 1.2, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Star
                        className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors ${
                          (hoverRating || show.ratingNum || 0) >= star
                            ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_2px_rgba(245,158,11,0.6)]'
                            : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                      />
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
