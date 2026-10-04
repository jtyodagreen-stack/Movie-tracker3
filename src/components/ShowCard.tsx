import { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, Sparkles } from 'lucide-react';
import { ShowItem } from '../types';
import { getOptimizedPoster } from '../utils/imageOptimizer';
import { formatToDDMMYYYY } from '../utils/dateUtils';
import { calculateShowProgress } from '../utils/showMetrics';
import { isNotificationEnabled, toggleShowNotification, isShowOutNow, isFutureRelease, isReleaseDatePast } from '../services/notificationService';
import { fetchLiveTvMazeInfo, TvMazeEpisode } from '../services/tvMazeService';
import { getViewerColor } from '../utils/profileColors';
import { getPriorityIndicator } from '../utils/priorityUtils';

interface ShowCardProps {
  show: ShowItem;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  className?: string;
  onHoverEnter?: (show: ShowItem, rect: { top: number; left: number; width: number; height: number }) => void;
  onHoverLeave?: () => void;
  viewerColors?: Record<string, string>;
}

export default function ShowCard({
  show,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  className,
  onHoverEnter,
  onHoverLeave,
  viewerColors,
}: ShowCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isNotifActive, setIsNotifActive] = useState(() => isNotificationEnabled(show));
  const [liveAirstamp, setLiveAirstamp] = useState<string | null>(null);
  const [liveNextEpisode, setLiveNextEpisode] = useState<TvMazeEpisode | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsNotifActive(isNotificationEnabled(show));
    
    const handleNotifChange = (e: any) => {
      if (e.detail.showId === show.id) {
        setIsNotifActive(e.detail.enabled);
      }
    };
    window.addEventListener('notification-changed', handleNotifChange);
    return () => window.removeEventListener('notification-changed', handleNotifChange);
  }, [show.id]);

  useEffect(() => {
    // If show has a future or active releaseDate (within 24h), we don't need liveAirstamp
    const isPast = isReleaseDatePast(show.releaseDate);
    if ((show.releaseDate && !isPast) || show.type !== 'Series') {
      setLiveAirstamp(null);
      setLiveNextEpisode(null);
      return;
    }

    let isMounted = true;
    const delay = Math.random() * 600; // Small staggered delay to prevent TVMaze lookup rate-limits
    const timeout = setTimeout(() => {
      fetchLiveTvMazeInfo(show.title).then((info) => {
        if (isMounted && info && info.nextEpisode) {
          setLiveAirstamp(info.nextEpisode.airstamp);
          setLiveNextEpisode(info.nextEpisode);
        }
      }).catch((err) => console.warn('ShowCard TVMaze fetch failed:', err));
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [show.id, show.title, show.releaseDate, show.status]);

  const handleToggleNotif = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const enabled = await toggleShowNotification(show);
    setIsNotifActive(enabled);
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const handleActivation = (e: React.MouseEvent | React.TouchEvent) => {
    // Instantly clear any pending hover timeouts when activation starts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || !window.matchMedia('(hover: hover)').matches);
    
    if (isMobile) {
      e.preventDefault();
      e.stopPropagation();
      if (onHoverEnter && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        onHoverEnter(show, {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    } else {
      onOpenDetails(show);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Quick tap with under 12px motion (so horizontal scrolling through carousels is smooth)
    if (dx < 12 && dy < 12 && dt < 450) {
      handleActivation(e);
    }
  };

  const isTouchActiveRef = useRef(false);

  const triggerHover = () => {
    if (!onHoverEnter || !cardRef.current || isTouchActiveRef.current) return;
    
    // Check if another portal is already open for seamless glide between cards
    const isAnyPortalActive = typeof document !== 'undefined' && !!document.querySelector('.netflix-hover-portal-active');
    const delay = isAnyPortalActive ? 40 : 320;

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          onHoverEnter(show, {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          });
        }
      }
    }, delay);
  };

  const handleMouseEnter = () => {
    // Only block if pure touch event is actively dragging
    if (isTouchActiveRef.current) return;
    setIsHovered(true);
    triggerHover();
  };

  const handleMouseMove = () => {
    if (isTouchActiveRef.current) return;
    if (!hoverTimeoutRef.current && !isHovered) {
      setIsHovered(true);
      triggerHover();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (onHoverLeave) {
      onHoverLeave();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    handleActivation(e);
  };

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
  const currentSsnNum = parseInt(show.seasons.replace(/[^0-9]/g, '')) || 1;
  const progress = calculateShowProgress(show);

  const isWatched = show.status === '✅ Watched';
  const isWatching = show.status === '⏳ Watching';
  const isMovie = show.type === 'Movie';

  // Visually display all Priority indicator types (🔴 High, 🟡 Medium, 🟢 Low, or custom)
  const priorityIndicator = getPriorityIndicator(show.priority, show.isWishlist);

  return (
    <div
      ref={cardRef}
      id={`show-card-${show.id}`}
      role="button"
      className={`group relative cursor-pointer hover-lift-card focus:outline-none select-none touch-manipulation active:scale-[0.98] transition-transform ${
        className || 'flex-shrink-0 w-44 sm:w-56 md:w-64'
      }`}
      onTouchStart={(e) => {
        isTouchActiveRef.current = true;
        handleTouchStart(e);
      }}
      onTouchEnd={(e) => {
        handleTouchEnd(e);
        setTimeout(() => {
          isTouchActiveRef.current = false;
        }, 500);
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(show);
        }
      }}
    >
      {/* Card Thumbnail */}
      <div className="relative w-full aspect-video rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md transition-all">
        <img
          src={getOptimizedPoster(show.backdropUrl || show.posterUrl)}
          alt={show.title}
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-95"
          style={{ imageRendering: 'auto' }}
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 pointer-events-none z-10">
          <div className="flex flex-col gap-1 items-start min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap max-w-full">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-zinc-200 backdrop-blur-sm border border-zinc-700/50 truncate max-w-full">
                {show.platform}
              </span>
            </div>
            {(show.isWishlist || priorityIndicator) && (
              <div className="flex items-center gap-1 flex-nowrap max-w-full">
                {show.isWishlist && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/95 text-black border border-amber-400 shadow-sm shrink-0">
                    🎁 Wishlist
                  </span>
                )}
                {priorityIndicator && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-0.5 ${priorityIndicator.className}`}
                    title={`Priority: ${priorityIndicator.tooltip}`}
                  >
                    {priorityIndicator.label}
                  </span>
                )}
              </div>
            )}
            {(show.releaseDate || liveNextEpisode || liveAirstamp) && (
              isShowOutNow(show) ? (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black border border-emerald-400 shadow-md shrink-0 flex items-center gap-1 animate-pulse">
                  🎉 OUT NOW!
                </span>
              ) : isReleaseDatePast(show.releaseDate) && !liveNextEpisode && !liveAirstamp ? null : (
                <div className="flex items-center gap-1 pointer-events-auto">
                  <span
                    className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-black border border-amber-300 shadow-sm shrink-0 flex items-center gap-0.5"
                    title={
                      isReleaseDatePast(show.releaseDate) && liveNextEpisode
                        ? `Next Episode: S${liveNextEpisode.season} E${liveNextEpisode.number} - ${liveNextEpisode.name} (${formatToDDMMYYYY(liveNextEpisode.airdate)})`
                        : show.releaseDate
                        ? `Release Date: ${formatToDDMMYYYY(show.releaseDate)}`
                        : ''
                    }
                  >
                    ⏰ {isReleaseDatePast(show.releaseDate) && liveNextEpisode?.airdate
                      ? formatToDDMMYYYY(liveNextEpisode.airdate)
                      : show.releaseDate 
                        ? formatToDDMMYYYY(show.releaseDate) 
                        : liveNextEpisode?.airdate
                          ? formatToDDMMYYYY(liveNextEpisode.airdate)
                          : liveAirstamp 
                            ? formatToDDMMYYYY(new Date(liveAirstamp))
                            : ''}
                  </span>
                </div>
              )
            )}
          </div>
          {show.genre && (
            <span
              className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-700/80 shrink-0 whitespace-nowrap shadow-md max-w-[50%] truncate"
              title={show.genre}
            >
              {show.genre.includes('/') ? show.genre.split('/')[0].trim() : show.genre.split(',')[0].trim()}
            </span>
          )}
        </div>

        {/* Bottom Progress Bar */}
        {isWatching && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
            <div
              data-progress-bar="true"
              data-preserve-theme="true"
              className="h-full bg-[#E50914] preserve-theme-color progress-bar-fill transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {isWatched && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        )}
      </div>

      {/* Under-Card Information */}
      <div className="mt-2 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
            {show.title}
          </h3>
          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
            {show.year}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 gap-1.5">
          <span className="flex items-center gap-1 font-medium text-[11px] truncate">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isWatched
                  ? 'bg-emerald-500'
                  : isWatching
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="truncate">{show.status.replace(/[^a-zA-Z\s]/g, '').trim()}</span>
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {show.who && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-1 max-w-[85px] truncate"
                style={{
                  backgroundColor: `${getViewerColor(show.who, viewerColors)}20`,
                  color: getViewerColor(show.who, viewerColors),
                  borderColor: `${getViewerColor(show.who, viewerColors)}50`,
                }}
                title={`Viewer: ${show.who}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: getViewerColor(show.who, viewerColors) }}
                />
                <span className="truncate">{show.who}</span>
              </span>
            )}
            <span className="text-[11px] text-zinc-500">
              {show.type === 'Series' ? `${formatS(show.seasons)} • ${formatE(show.episodes)}` : 'Movie'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
