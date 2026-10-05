import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Play,
  Check,
  Star,
  Tv,
  Calendar,
  Clock,
  RotateCcw,
  Layers,
  FileText,
  User,
  Trash2,
  Save,
  Plus,
  Minus,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Loader2,
  Bell,
  BellRing,
  Film,
} from 'lucide-react';
import { ShowItem, WatchStatus, ShowType, PRESET_PLATFORMS } from '../types';
import { calculateShowProgress } from '../utils/showMetrics';
import ImageUploader from './ImageUploader';
import { normalizeSeasonStr, normalizeEpisodeStr, normalizePlatform, parseGoogleSheetsDate } from '../services/sheetsService';
import { getOptimizedBackdrop } from '../utils/imageOptimizer';
import { autoFetchPoster, getOrFetchImdbUrl } from '../services/posterService';
import { extractDateOnly, extractTimeOnly, combineDateAndTime, formatToDDMMYYYY, formatToYYYYMMDD, formatToLocalDisplay } from '../utils/dateUtils';
import { isNotificationEnabled, toggleShowNotification, isShowOutNow, isFutureRelease, isReleaseDatePast, enableShowNotificationSilent, getEffectiveReleaseInfo } from '../services/notificationService';
import { fetchLiveTvMazeInfo, TvMazeShowInfo, TvMazeEpisode } from '../services/tvMazeService';
import { getPriorityIndicator } from '../utils/priorityUtils';
import { useNotificationContext } from '../context/NotificationContext';

const TvMazeEpisodeCountdown = ({ airstamp }: { airstamp: string }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const target = new Date(airstamp).getTime();
    if (isNaN(target)) return;

    const update = () => {
      const now = Date.now();
      const diff = target - now;

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
  }, [airstamp]);

  if (!timeLeft) {
    return (
      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
        🎉 Airing now or very soon!
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs bg-zinc-950/70 py-1 px-3 rounded-md border border-zinc-800">
      <span className="text-zinc-500 font-sans text-xs uppercase font-bold tracking-wider mr-1">Starts In:</span>
      <span className="text-amber-400 font-bold">{timeLeft.d}d</span>
      <span className="text-zinc-600">:</span>
      <span className="text-amber-400 font-bold">{timeLeft.h}h</span>
      <span className="text-zinc-600">:</span>
      <span className="text-amber-400 font-bold">{timeLeft.m}m</span>
      <span className="text-zinc-600">:</span>
      <span className="text-amber-400 font-bold animate-pulse">{timeLeft.s}s</span>
    </div>
  );
};

interface ShowDetailModalProps {
  show: ShowItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedShow: ShowItem) => void;
  onDelete: (show: ShowItem) => void;
  sheetConnected: boolean;
  sheetPlatforms?: string[];
  sheetViewers?: string[];
  sheetGenres?: string[];
  onMoveToWishlist?: (show: ShowItem) => Promise<void>;
  onMoveToMaster?: (show: ShowItem) => Promise<void>;
  masterSheetName?: string;
  wishlistSheetName?: string;
  viewerColors?: Record<string, string>;
}

const DEFAULT_PLATFORMS = PRESET_PLATFORMS;

const DEFAULT_VIEWERS: string[] = [];

const GENRE_PRESETS = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Family',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'Animation',
  'Documentary',
  'War',
];

export default function ShowDetailModal({
  show,
  isOpen,
  onClose,
  onSave,
  onDelete,
  sheetConnected,
  sheetPlatforms = [],
  sheetViewers = [],
  sheetGenres = [],
  onMoveToWishlist,
  onMoveToMaster,
  masterSheetName = 'MASTER TRACKER',
  wishlistSheetName = 'Wishlist',
  viewerColors,
}: ShowDetailModalProps) {
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const [title, setTitle] = useState(show?.title || '');
  const [type, setType] = useState<ShowType>(show?.type || 'Series');
  const [platform, setPlatform] = useState(normalizePlatform(show?.platform || ''));

  const allPlatforms = useMemo(() => {
    const set = new Set<string>(PRESET_PLATFORMS);
    if (sheetPlatforms && sheetPlatforms.length > 0) {
      sheetPlatforms.forEach((p) => {
        if (p && p.trim()) set.add(p.trim());
      });
    }
    return Array.from(set);
  }, [sheetPlatforms]);
  const [seasons, setSeasons] = useState(show?.seasons || 'S1');
  const [episodes, setEpisodes] = useState(show?.episodes || 'E1');
  const [maxEp, setMaxEp] = useState(show?.maxEp || 'E8');
  const [genre, setGenre] = useState(show?.genre || 'Drama');

  const allGenres = useMemo(() => {
    const set = new Set<string>(GENRE_PRESETS);
    if (sheetGenres && sheetGenres.length > 0) {
      sheetGenres.forEach((g) => {
        if (g && g.trim()) set.add(g.trim());
      });
    }
    return Array.from(set);
  }, [sheetGenres]);
  const [year, setYear] = useState(show?.year ?? new Date().getFullYear().toString());
  const [status, setStatus] = useState<WatchStatus>(show?.status || '⏳ Watching');
  const [ratingNum, setRatingNum] = useState<number>(show?.ratingNum || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [notes, setNotes] = useState(show?.notes || '');
  const [who, setWho] = useState(show?.who || (sheetViewers.length > 0 ? sheetViewers[0] : ''));
  const [isResolvingImdb, setIsResolvingImdb] = useState(false);
  const [isMovingSheet, setIsMovingSheet] = useState(false);

  const handlePerformMoveToMaster = async () => {
    if (isMovingSheet || !onMoveToMaster || !show) return;
    setIsMovingSheet(true);
    try {
      await onMoveToMaster(show);
      onClose();
    } catch (e) {
      console.error('Error moving to master:', e);
      setIsMovingSheet(false);
    }
  };

  const handlePerformMoveToWishlist = async () => {
    if (isMovingSheet || !onMoveToWishlist || !show) return;
    setIsMovingSheet(true);
    try {
      await onMoveToWishlist(show);
      onClose();
    } catch (e) {
      console.error('Error moving to wishlist:', e);
      setIsMovingSheet(false);
    }
  };

  const handleOpenImdb = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (show?.imdbId && show.imdbId.startsWith('tt')) {
      window.open(`https://www.imdb.com/title/${show.imdbId}/`, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsResolvingImdb(true);
    try {
      const url = await getOrFetchImdbUrl(show?.title || title, show?.imdbId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setIsResolvingImdb(false);
    }
  };

  const normalizePriorityLocal = (p?: string): string => {
    if (!p) return '🔴 High';
    const s = p.trim().toLowerCase();
    if (s.includes('high') || s.includes('🔴')) return '🔴 High';
    if (s.includes('medium') || s.includes('mid') || s.includes('🟡')) return '🟡 Medium';
    if (s.includes('low') || s.includes('green') || s.includes('🟢')) return '🟢 Low';
    return '🔴 High';
  };

  const getTodayDDMMYYYY = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const isExpiredRelease = useMemo(() => {
    if (!show || !show.releaseDate) return false;
    return !isFutureRelease(show) && !isShowOutNow(show);
  }, [show]);

  const [priority, setPriority] = useState<string>(normalizePriorityLocal(show?.priority));
  const [dateAdded, setDateAdded] = useState<string>(
    parseGoogleSheetsDate(show?.dateAdded || getTodayDDMMYYYY())
  );
  const [releaseDate, setReleaseDate] = useState<string>(show?.releaseDate || '');
  const [releaseDateOnly, setReleaseDateOnly] = useState<string>(() => extractDateOnly(show?.releaseDate));
  const [releaseTime, setReleaseTime] = useState<string>(() => extractTimeOnly(show?.releaseDate));
  const [releaseNote, setReleaseNote] = useState<string>(show?.releaseNote || '');
  const { isNotificationEnabled, toggleNotification } = useNotificationContext();
  const isNotifActive = show ? isNotificationEnabled(show) : false;

  const handleToggleNotif = async () => {
    if (!show) return;
    await toggleNotification(show);
  };
  const [isWishlistDone, setIsWishlistDone] = useState<boolean>(
    show?.status === '✅ Watched' ||
      String(show?.status || '').toLowerCase().includes('watched') ||
      String(show?.status || '').toUpperCase() === 'DONE'
  );

  const handleReleaseDateChange = (newDate: string) => {
    setReleaseDateOnly(newDate);
    const combined = combineDateAndTime(newDate, releaseTime);
    setReleaseDate(combined);
  };

  const handleReleaseTimeChange = (newTime: string) => {
    setReleaseTime(newTime);
    const combined = combineDateAndTime(releaseDateOnly, newTime);
    setReleaseDate(combined);
  };

  const currentLoadedShowIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (show && show.id !== currentLoadedShowIdRef.current) {
      currentLoadedShowIdRef.current = show.id;
      setTitle(show.title);
      setType(show.type);
      setPlatform(normalizePlatform(show.platform));
      setSeasons(show.seasons);
      setEpisodes(show.episodes);
      setMaxEp(show.maxEp);
      setGenre(show.genre);
      setYear(show.year);
      setStatus(show.status);
      setRatingNum(show.ratingNum || 0);
      setNotes(show.notes);
      setWho(show.who || (sheetViewers.length > 0 ? sheetViewers[0] : ''));
      setPriority(normalizePriorityLocal(show.priority));
      setDateAdded(parseGoogleSheetsDate(show.dateAdded || getTodayDDMMYYYY()));
      setReleaseDate(show.releaseDate || '');
      setReleaseDateOnly(extractDateOnly(show.releaseDate));
      setReleaseTime(extractTimeOnly(show.releaseDate));
      setReleaseNote(show.releaseNote || '');
      setIsWishlistDone(
        show.status === '✅ Watched' ||
          String(show.status).toLowerCase().includes('watched') ||
          String(show.status).toUpperCase() === 'DONE'
      );
      const url = show.posterUrl || show.backdropUrl || '';
      setPosterUrl(url);
      setBackdropUrl(url);
    }
  }, [show?.id]);

  useEffect(() => {
    if (!who && sheetViewers.length > 0) {
      setWho(sheetViewers[0]);
    }
  }, [sheetViewers, who]);

  const [tvMazeInfo, setTvMazeInfo] = useState<TvMazeShowInfo | null>(null);
  const [isLoadingTvMaze, setIsLoadingTvMaze] = useState(false);

  useEffect(() => {
    if (!show || show.type !== 'Series') {
      setTvMazeInfo(null);
      return;
    }

    let isMounted = true;
    const loadTvMazeData = async () => {
      setIsLoadingTvMaze(true);
      try {
        const info = await fetchLiveTvMazeInfo(show.title);
        if (isMounted) {
          setTvMazeInfo(info);
          if (info && info.nextEpisode) {
            const nextEp = info.nextEpisode;
            const fullReleaseDate = nextEp.airstamp || combineDateAndTime(nextEp.airdate, nextEp.airtime || '00:00');
            const noteText = `S${nextEp.season} E${nextEp.number}: ${nextEp.name}`;
            
            setReleaseDateOnly((prev) => prev || nextEp.airdate);
            setReleaseTime((prev) => prev || nextEp.airtime || '00:00');
            setReleaseNote((prev) => prev || noteText);
            setReleaseDate((prev) => prev || fullReleaseDate);
          }
        }
      } catch (err) {
        console.warn('TVMaze fetch failed:', err);
      } finally {
        if (isMounted) {
          setIsLoadingTvMaze(false);
        }
      }
    };

    loadTvMazeData();

    return () => {
      isMounted = false;
    };
  }, [show?.id, show?.title]);

  // Lock body scroll and listen for Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const allViewers = useMemo(() => {
    if (sheetViewers && sheetViewers.length > 0) {
      const seen = new Set<string>();
      const list: string[] = [];
      for (const v of sheetViewers) {
        if (!v) continue;
        const trimmed = v.trim();
        const normalized = trimmed.toLowerCase();
        if (trimmed && !seen.has(normalized)) {
          seen.add(normalized);
          list.push(trimmed);
        }
      }
      return list;
    }
    return who ? [who] : [];
  }, [sheetViewers, who]);

  const initialUrl = show?.posterUrl || show?.backdropUrl || '';
  const [posterUrl, setPosterUrl] = useState<string>(initialUrl);
  const [backdropUrl, setBackdropUrl] = useState<string>(initialUrl);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAutoFetchingArtwork, setIsAutoFetchingArtwork] = useState(false);

  const handleAutoFetchArtwork = async () => {
    if (!title.trim()) return;
    setIsAutoFetchingArtwork(true);
    try {
      const { result } = await autoFetchPoster(title.trim(), type, genre);
      if (result && result.posterUrl) {
        setPosterUrl(result.posterUrl);
        setBackdropUrl(result.backdropUrl || result.posterUrl);
      }
    } catch (e) {
      console.warn('Auto fetch artwork error:', e);
    } finally {
      setIsAutoFetchingArtwork(false);
    }
  };

  if (!isOpen || !show) return null;

  // Parse numerical episode and season info
  const epCurrentNum = parseInt(String(episodes).replace(/[^0-9]/g, '')) || 1;
  const epMaxNum = Math.max(1, parseInt(String(maxEp).replace(/[^0-9]/g, '')) || (type === 'Movie' ? 1 : 8));
  const ssnCurrentNum = parseInt(String(seasons).replace(/[^0-9]/g, '')) || 1;

  const progressPercent = useMemo(() => {
    return calculateShowProgress({
      ...show,
      type,
      status,
      episodes,
      maxEp,
      seasons,
    });
  }, [show, type, status, episodes, maxEp, seasons]);

  const handleStatusChange = (newStatus: WatchStatus) => {
    setStatus(newStatus);
    setIsWishlistDone(newStatus === '✅ Watched');
  };

  const handleStepEpisode = (delta: number) => {
    if (delta > 0 && epCurrentNum >= epMaxNum) {
      if (type === 'Movie' && epMaxNum === 1) {
        setStatus('✅ Watched');
        return;
      }
      // Reached the end of the season! Advance season to next and reset to Episode 1
      const nextSsn = ssnCurrentNum + 1;
      setSeasons(`S${nextSsn}`);
      setEpisodes('E1');
      setStatus('⏳ Watching');
      return;
    }

    if (delta < 0 && epCurrentNum <= 1 && ssnCurrentNum > 1) {
      // Step back into previous season
      const prevSsn = ssnCurrentNum - 1;
      setSeasons(`S${prevSsn}`);
      setEpisodes(`E${epMaxNum}`);
      return;
    }

    const nextVal = Math.max(1, Math.min(epMaxNum, epCurrentNum + delta));
    const nextEpStr = `E${nextVal}`;
    setEpisodes(nextEpStr);
    if (nextVal >= epMaxNum) {
      setStatus('✅ Watched');
    } else if (status === '✅ Watched' && nextVal < epMaxNum) {
      setStatus('⏳ Watching');
    }
  };

  const handleStepSeason = (delta: number) => {
    const nextSsn = Math.max(1, ssnCurrentNum + delta);
    setSeasons(`S${nextSsn}`);
    setEpisodes('E1');
    setStatus('⏳ Watching');
  };

  const handleSave = () => {
    const getRatingText = (num: number): string => {
      if (num === 1) return '⭐ = Poor';
      if (num === 2) return '⭐⭐ = Fair';
      if (num === 3) return '⭐⭐⭐ = Good';
      if (num === 4) return '⭐⭐⭐⭐ = Great';
      if (num === 5) return '⭐⭐⭐⭐⭐ = Excellent';
      return 'Unrated';
    };
    const starsText = ratingNum > 0 ? getRatingText(ratingNum) : (show.isWishlist ? '' : 'Unrated');
    const unifiedUrl = posterUrl.trim() || backdropUrl.trim();
    const finalStatus: WatchStatus = status;

    const isMovie = type === 'Movie';
    const updated: ShowItem = {
      ...show,
      title,
      type,
      platform,
      seasons: isMovie || show.isWishlist ? '' : normalizeSeasonStr(seasons || 'S1'),
      episodes: isMovie || show.isWishlist ? '' : normalizeEpisodeStr(episodes || 'E1'),
      maxEp: isMovie || show.isWishlist ? '' : normalizeEpisodeStr(maxEp || 'E8'),
      genre: genre || 'Drama',
      year,
      status: finalStatus,
      rating: starsText,
      ratingNum,
      notes,
      who: who.trim() || (sheetViewers.length > 0 ? sheetViewers[0] : ''),
      priority: show.isWishlist ? priority : undefined,
      dateAdded: show.isWishlist ? dateAdded : (show.dateAdded || dateAdded || getTodayDDMMYYYY()),
      createdTimestamp: show.createdTimestamp || Date.now(),
      addedTime: show.addedTime || show.createdTimestamp || Date.now(),
      posterUrl: unifiedUrl,
      backdropUrl: unifiedUrl,
      nextEp: isMovie || show.isWishlist ? false : epCurrentNum < epMaxNum,
      nextSsn: false,
      releaseDate: releaseDate ? parseGoogleSheetsDate(releaseDate) : '',
      releaseNote: releaseNote.trim() || '',
    };
    if ((releaseDate && releaseDate.trim()) || (releaseNote && releaseNote.trim()) || tvMazeInfo?.nextEpisode) {
      enableShowNotificationSilent(show.id);
    }
    onSave(updated);
    onClose();
  };

  const activeBackdrop = backdropUrl || posterUrl || show.backdropUrl || show.posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop';
  const priorityIndicator = getPriorityIndicator(priority || show?.priority, show?.isWishlist);
  const effectiveInfo = getEffectiveReleaseInfo(show, tvMazeInfo);

  return (
    <div
      id="show-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md overflow-x-hidden"
      style={{ perspective: '1200px' }}
      onClick={onClose}
    >
      {/* Cinematic Ambient Glow */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] opacity-[0.38] blur-[100px] saturate-200 pointer-events-none transition-all duration-500 select-none"
          style={{
            backgroundImage: `url(${getOptimizedBackdrop(activeBackdrop)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <div
        id="show-detail-modal-card"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 40px 4px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
        }}
        className="relative w-full max-w-3xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col bg-[#181818] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Backdrop Banner */}
        <div className="relative aspect-[16/9] sm:aspect-[2.4/1] w-full shrink-0 overflow-hidden bg-zinc-900">
          <img
            src={getOptimizedBackdrop(activeBackdrop)}
            alt={show.title}
            className="w-full h-full object-cover filter brightness-[0.85] contrast-[1.05]"
            style={{ imageRendering: 'auto' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent" />

          {/* Action buttons top left */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-1.5 flex-wrap">
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
            {(show.releaseDate || show.releaseNote || releaseDate || releaseNote || tvMazeInfo?.nextEpisode || tvMazeInfo?.previousEpisode || show.lastAirTimestamp) && (
              effectiveInfo.isOut ? (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black border border-emerald-400 shadow-md shrink-0 flex items-center gap-1 animate-pulse">
                  🎉 OUT NOW!
                </span>
              ) : (effectiveInfo.isPastWindow && !effectiveInfo.isNextEpisode) ? null : (
                <span
                  className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-black border border-amber-300 shadow-md shrink-0 flex items-center gap-0.5"
                  title={
                    effectiveInfo.isNextEpisode && tvMazeInfo?.nextEpisode
                      ? `Next Episode: S${tvMazeInfo.nextEpisode.season} E${tvMazeInfo.nextEpisode.number} - ${tvMazeInfo.nextEpisode.name} (${formatToDDMMYYYY(tvMazeInfo.nextEpisode.airdate)})`
                      : (releaseDate || show.releaseDate)
                      ? `Release Date: ${formatToDDMMYYYY(releaseDate || show.releaseDate)}`
                      : ''
                  }
                >
                  ⏰ {effectiveInfo.label || effectiveInfo.formattedDateStr || ''}
                </span>
              )
            )}
          </div>

          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 sm:gap-2 z-20">
            <button
              type="button"
              onClick={handleOpenImdb}
              disabled={isResolvingImdb}
              className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-black px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black shadow-xl transition-all cursor-pointer border border-amber-300/60 hover:scale-105 active:scale-95 disabled:opacity-60"
              title="Open Official IMDb Title Page"
            >
              <span>IMDb</span>
              <span className="text-[10px]">↗</span>
            </button>
            <button
              id="detail-top-save-btn"
              onClick={handleSave}
              className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl transition-all cursor-pointer border border-emerald-500/50 hover:scale-105 active:scale-95"
            >
              <Save className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              <span>Save</span>
            </button>
            <button
              id="close-detail-modal-btn"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors border border-zinc-600/50 cursor-pointer shadow-lg"
            >
              <X className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>

          {/* Hero Content Overlay */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 flex flex-col justify-end">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded bg-[red-600] text-white">
                {platform}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-zinc-900/80 text-zinc-300 border border-zinc-700">
                {genre}
              </span>
              <span className="text-[10px] sm:text-xs text-zinc-400">{year}</span>
            </div>

            <h2 className="text-xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-2">
              {title}
            </h2>
          </div>
        </div>

        {/* Image URL Section (Expandable) */}
        {showImageUploader && (
          <div className="p-4 sm:p-6 bg-zinc-950/90 border-b border-zinc-800 space-y-4 animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[red-600]" />
                <h3 className="text-sm font-bold text-white">Web Image URL</h3>
              </div>

            <ImageUploader
              label="Web Image URL (Poster, Cover, Backdrop & Hero)"
              description="Paste a single direct image link to be used identically across cards, modal cover, backdrop & hero billboard"
              currentUrl={posterUrl || backdropUrl}
              aspectRatio="backdrop"
              onImageSelected={(url) => {
                setPosterUrl(url);
                setBackdropUrl(url);
                setShowImageUploader(false); // Auto-hide after selection
              }}
              onImageRemoved={() => {
                setPosterUrl('');
                setBackdropUrl('');
              }}
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          {/* Location & Sheet Move Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Storage Location:</span>
              <div className="flex items-center gap-2">
                {show.isWishlist ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-950/70 border border-amber-800/80 px-2.5 py-1 rounded">
                    <span>🎁 In Wishlist Sheet</span>
                    <span className="hidden sm:inline text-[10px] text-amber-400/80 font-mono">({wishlistSheetName})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-200 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded">
                    <span>📊 In Master Tracker</span>
                    <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono">({masterSheetName})</span>
                  </span>
                )}
              </div>
            </div>

            {show.isWishlist && onMoveToMaster && (
              <button
                type="button"
                id="move-to-master-btn"
                disabled={isMovingSheet}
                onClick={handlePerformMoveToMaster}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-all cursor-pointer shadow"
              >
                {isMovingSheet ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Moving to Master...</span>
                  </>
                ) : (
                  <span>📊 Move to Master Tracker</span>
                )}
              </button>
            )}

            {!show.isWishlist && onMoveToWishlist && (
              <button
                type="button"
                id="move-to-wishlist-btn"
                disabled={isMovingSheet}
                onClick={handlePerformMoveToWishlist}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-all cursor-pointer shadow"
              >
                {isMovingSheet ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Moving to Wishlist...</span>
                  </>
                ) : (
                  <span>🎁 Move to Wishlist</span>
                )}
              </button>
            )}
          </div>

          {/* Release Premiere Info Bar (Identical to Netflix Hover Portal) */}
          {show && (show.releaseDate || show.releaseNote || releaseDate || releaseNote || tvMazeInfo?.nextEpisode || tvMazeInfo?.previousEpisode || show.lastAirTimestamp) && (
            (() => {
              const eff = getEffectiveReleaseInfo(show, tvMazeInfo);
              if (eff.isOut) {
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow">
                    <div className="flex items-center gap-2">
                      <span className="text-base animate-bounce">🎉</span>
                      <span className="font-black text-emerald-200">OUT NOW!</span>
                      <span>
                        {eff.outNowEpisode?.season && eff.outNowEpisode?.number
                          ? `S${eff.outNowEpisode.season} E${eff.outNowEpisode.number}${eff.outNowEpisode.name ? ` • "${eff.outNowEpisode.name}"` : ''}`
                          : ''}
                        {' — Available to stream on '}{show.platform || 'TV'}
                      </span>
                    </div>
                    {eff.upcomingEpisode && (
                      <span className="text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded self-start sm:self-auto">
                        Next: S{eff.upcomingEpisode.season} E{eff.upcomingEpisode.number} ({formatToDDMMYYYY(eff.upcomingEpisode.airdate)})
                      </span>
                    )}
                  </div>
                );
              }

              if (eff.isFuture || isFutureRelease(show) || (!show.releaseDate && (show.releaseNote || releaseNote || tvMazeInfo?.nextEpisode)) || Boolean(tvMazeInfo?.nextEpisode)) {
                return (
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⏰</span>
                      <span>
                        {isReleaseDatePast(releaseDate || show.releaseDate) && tvMazeInfo?.nextEpisode
                          ? `Next Episode Premiere: ${formatToDDMMYYYY(tvMazeInfo.nextEpisode.airdate)}${tvMazeInfo.nextEpisode.airtime ? ` at ${tvMazeInfo.nextEpisode.airtime}` : ''}`
                          : releaseDate || show.releaseDate || tvMazeInfo?.nextEpisode
                          ? `Target Premiere: ${formatToDDMMYYYY(releaseDate || show.releaseDate || (tvMazeInfo?.nextEpisode ? tvMazeInfo.nextEpisode.airdate : ''))}`
                          : 'Upcoming Release'}
                        {isReleaseDatePast(releaseDate || show.releaseDate) && tvMazeInfo?.nextEpisode
                          ? ` (S${tvMazeInfo.nextEpisode.season} E${tvMazeInfo.nextEpisode.number}: ${tvMazeInfo.nextEpisode.name})`
                          : releaseNote || show.releaseNote || tvMazeInfo?.nextEpisode
                          ? ` (${releaseNote || show.releaseNote || (tvMazeInfo?.nextEpisode ? `S${tvMazeInfo.nextEpisode.season} E${tvMazeInfo.nextEpisode.number}: ${tvMazeInfo.nextEpisode.name}` : '')})`
                          : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleNotif}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                        isNotifActive
                          ? 'bg-amber-400 text-black border-amber-300 shadow'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700'
                      }`}
                    >
                      {isNotifActive ? (
                        <>
                          <BellRing className="w-3.5 h-3.5 text-black animate-pulse" />
                          <span>24h Alert On</span>
                        </>
                      ) : (
                        <>
                          <Bell className="w-3.5 h-3.5" />
                          <span>Notify Me 24h Before</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              }

              return null;
            })()
          )}

          {/* Progress & Watch Status Card */}
          <div className="p-4 sm:p-5 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-4">
            {/* Top Row: Watch Status & Current Progress Badge */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${type === 'Series' ? 'pb-3 border-b border-zinc-800' : ''}`}>
              <div className="space-y-1.5 flex-1">
                <label htmlFor="detail-status-select" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                  Watch Status
                </label>
                <select
                  id="detail-status-select"
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as WatchStatus)}
                  className={`w-full sm:w-auto text-base font-semibold px-4 py-2.5 rounded-md border focus:outline-none transition-colors appearance-none cursor-pointer shadow-inner ${
                    status === '✅ Watched'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : status === '⏳ Watching'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                      : status === '⏸️ Paused'
                      ? 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  <option value="✅ Watched">✅ Watched</option>
                  <option value="⏳ Watching">⏳ Watching</option>
                  <option value="⏸️ Paused">⏸️ Paused</option>
                  <option value="❌ Dropped">❌ Dropped</option>
                </select>
              </div>

              {type === 'Series' && (
                <div className="space-y-1.5 sm:text-right">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block sm:mr-1">
                    Current Progress
                  </span>
                  <div
                    id="detail-current-progress-badge"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800/90 border border-zinc-700 rounded-md font-mono text-white text-sm font-bold shadow-inner"
                  >
                    <span>{seasons}</span>
                    <span className="text-zinc-500">•</span>
                    <span>{episodes}</span>
                    <span className="text-zinc-400 font-normal text-xs">of {maxEp}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Steppers Grid & Progress Bar (Series only) */}
            {type === 'Movie' ? (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider ml-0.5">
                  <span>Movie Watch Progress</span>
                  <span className="font-mono text-amber-400 font-bold">{progressPercent}%</span>
                </div>
                <div
                  id="detail-progress-bar-movie"
                  className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700 shadow-inner"
                >
                  <div
                    data-progress-bar="true"
                    data-preserve-theme="true"
                    className={`h-full transition-all duration-300 ${
                      status === '✅ Watched' ? 'bg-emerald-500' : 'bg-[red-600] preserve-theme-color progress-bar-fill'
                    }`}
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: status === '✅ Watched' ? '#10b981' : 'red-600',
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Season Stepper */}
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-800/60 border border-zinc-700/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 pl-2">
                      Season
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        id="season-minus-btn"
                        type="button"
                        onClick={() => handleStepSeason(-1)}
                        disabled={ssnCurrentNum <= 1}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title="Previous Season"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-base text-white">
                        {seasons}
                      </span>
                      <button
                        id="season-plus-btn"
                        type="button"
                        onClick={() => handleStepSeason(1)}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title="Next Season"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Episode Stepper */}
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-800/60 border border-zinc-700/80 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 pl-2">
                      Episode
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        id="episode-minus-btn"
                        type="button"
                        onClick={() => handleStepEpisode(-1)}
                        disabled={epCurrentNum <= 1 && ssnCurrentNum <= 1}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title="Previous Episode"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-base text-white">
                        {episodes}
                      </span>
                      <button
                        id="episode-plus-btn"
                        type="button"
                        onClick={() => handleStepEpisode(1)}
                        className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer border border-zinc-600"
                        title={epCurrentNum >= epMaxNum ? `Advance to Season ${ssnCurrentNum + 1} E1` : 'Next Episode'}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Season Completion Progress Bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider ml-0.5">
                    <span>Season Completion</span>
                    <span className="font-mono text-zinc-200">{progressPercent}%</span>
                  </div>
                  <div
                    id="detail-progress-bar"
                    className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700"
                  >
                    <div
                      data-progress-bar="true"
                      data-preserve-theme="true"
                      className={`h-full transition-all duration-300 ${
                        status === '✅ Watched' ? 'bg-emerald-500' : 'bg-[red-600] preserve-theme-color progress-bar-fill'
                      }`}
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: status === '✅ Watched' ? '#10b981' : 'red-600',
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Fields Unified Container */}
          <div className="space-y-4">
            {/* Title and Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2 space-y-2">
                <label htmlFor="detail-title-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Title *</label>
                <input
                  id="detail-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Severance, Shōgun, Dune..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="detail-type-select" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Format</label>
                <select
                  id="detail-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as ShowType)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                >
                  <option value="Series">Series (TV)</option>
                  <option value="Movie">Movie (Film)</option>
                </select>
              </div>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 block">Platform</label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allPlatforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                      platform === p
                        ? 'bg-red-600 text-white border-red-500 font-semibold'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="detail-genre-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Genre</label>
                <select
                  id="detail-genre-input"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                >
                  {allGenres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="detail-year-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Release Year</label>
                <select
                  id="detail-year-input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 font-mono shadow-inner appearance-none"
                >
                  {Array.from({ length: 45 }, (_, i) => {
                    const y = (new Date().getFullYear() + 1 - i).toString();
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                  {year && !Array.from({ length: 45 }, (_, i) => (new Date().getFullYear() + 1 - i).toString()).includes(String(year)) && (
                    <option value={year}>{year}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Wishlist-specific fields vs Master Tracker fields */}
            {show.isWishlist ? (
              <div className="space-y-5 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="detail-wishlist-priority" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                      Priority
                    </label>
                    <select
                      id="detail-wishlist-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-zinc-500 shadow-inner appearance-none"
                    >
                      <option value="🔴 High">🔴 High</option>
                      <option value="🟡 Medium">🟡 Medium</option>
                      <option value="🟢 Low">🟢 Low</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="detail-wishlist-date" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                      Date Added
                    </label>
                    <div className="relative">
                      <input
                        id="detail-wishlist-date"
                        type="date"
                        value={formatToYYYYMMDD(dateAdded)}
                        onChange={(e) => setDateAdded(formatToDDMMYYYY(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md pl-4 pr-11 py-3 text-base text-white focus:outline-none focus:border-zinc-500 font-mono shadow-inner"
                      />
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        <Calendar className="w-5 h-5 text-zinc-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Seasons, Episodes, Max Ep (If Series) */}
                {type === 'Series' && (
                  <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                    <div className="space-y-2">
                      <label htmlFor="detail-season-input-box" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Season</label>
                      <input
                        id="detail-season-input-box"
                        type="text"
                        value={seasons}
                        onChange={(e) => setSeasons(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner"
                        placeholder="S1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="detail-episode-input-box" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Ep</label>
                      <input
                        id="detail-episode-input-box"
                        type="text"
                        value={episodes}
                        onChange={(e) => setEpisodes(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner text-center"
                        placeholder="E1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="detail-max-ep-input-box" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Max</label>
                      <input
                        id="detail-max-ep-input-box"
                        type="text"
                        value={maxEp}
                        onChange={(e) => setMaxEp(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner text-center"
                        placeholder="E8"
                      />
                    </div>
                  </div>
                )}

                {/* Status & Viewer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="detail-status-select" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Watch Status</label>
                    <select
                      id="detail-status-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as WatchStatus)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-4 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none cursor-pointer"
                    >
                      <option value="✅ Watched">✅ Watched</option>
                      <option value="⏳ Watching">⏳ Watching</option>
                      <option value="⏸️ Paused">⏸️ Paused</option>
                      <option value="❌ Dropped">❌ Dropped</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="detail-who-input" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Viewer (Who)</label>
                    <select
                      id="detail-who-input"
                      value={who}
                      onChange={(e) => setWho(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-4 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                    >
                      {allViewers.length === 0 && (
                        <option value="">No profiles in Lists sheet</option>
                      )}
                      {allViewers.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Rating (Master Tracker only) */}
            {!show.isWishlist && (
              <div className="space-y-1.5 p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold mb-1">
                  <span>Rating</span>
                  <span className="text-amber-400 font-bold">
                    {ratingNum > 0
                      ? `${ratingNum} Stars (${
                          ratingNum === 5
                            ? 'Excellent'
                            : ratingNum === 4
                            ? 'Great'
                            : ratingNum === 3
                            ? 'Good'
                            : ratingNum === 2
                            ? 'Fair'
                            : 'Poor'
                        })`
                      : 'Unrated'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      type="button"
                      onClick={() => setRatingNum(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1 text-zinc-600 cursor-pointer rounded-md hover:bg-zinc-800/50"
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      <motion.div
                        animate={{ scale: (hoverRating || ratingNum) >= star ? [1, 1.2, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            (hoverRating || ratingNum) >= star
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                              : 'text-zinc-600'
                          }`}
                        />
                      </motion.div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Title Artwork & Auto-Fetch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[red-600]" />
                  Title Artwork (Poster / Cover)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoFetchArtwork}
                    disabled={isAutoFetchingArtwork}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-600/50 px-2 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-50"
                    title="Auto-fetch official artwork from TVMaze/iTunes"
                  >
                    {isAutoFetchingArtwork ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Fetching...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>Auto-Detect Official Poster</span>
                      </>
                    )}
                  </button>
                  <button
                    id="toggle-detail-modal-image-btn"
                    type="button"
                    onClick={() => setShowImageUploader(!showImageUploader)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 underline font-medium cursor-pointer"
                  >
                    {showImageUploader ? 'Hide URL' : (posterUrl || backdropUrl) ? 'Custom URL' : '+ Custom URL'}
                  </button>
                </div>
              </div>

              {showImageUploader ? (
                <ImageUploader
                  label="Poster / Backdrop Image Web Link"
                  description="Paste direct image link (e.g. IMDb, TMDB, Amazon) to update artwork"
                  currentUrl={posterUrl || backdropUrl}
                  aspectRatio="backdrop"
                  onImageSelected={(url) => {
                    setPosterUrl(url);
                    setBackdropUrl(url);
                    setShowImageUploader(false);
                  }}
                  onImageRemoved={() => {
                    setPosterUrl('');
                    setBackdropUrl('');
                  }}
                />
              ) : (posterUrl || backdropUrl) ? (
                <div className="flex items-center gap-3 p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg">
                  <img src={posterUrl || backdropUrl} alt="Preview" className="w-10 h-14 object-cover rounded border border-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> High-Resolution Poster Attached
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate font-mono">{posterUrl || backdropUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFetchArtwork}
                    disabled={isAutoFetchingArtwork}
                    className="text-xs text-emerald-400 hover:text-emerald-300 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded border border-zinc-700 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Re-fetch
                  </button>
                </div>
              ) : (
                <div
                  onClick={handleAutoFetchArtwork}
                  className="p-3 border border-dashed border-emerald-600/50 hover:border-emerald-500 rounded-lg text-center cursor-pointer bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors"
                >
                  <p className="text-xs text-emerald-300 flex items-center justify-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Click to auto-fetch official high-res poster from TVMaze / iTunes</span>
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="detail-notes-input" className="text-xs font-semibold text-zinc-300 block">Notes & Thoughts</label>
              <textarea
                id="detail-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why you're watching, thoughts, reminders..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md p-2.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 shadow-inner"
              />
            </div>

            {/* Live Episode Tracker (TVMaze) */}
            {show.type === 'Series' && (isLoadingTvMaze || tvMazeInfo) && (
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500/30" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
                    <span>📡 Live Network Schedule Tracker</span>
                  </span>
                  {(releaseDateOnly || releaseTime || releaseNote || releaseDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setReleaseDateOnly('');
                        setReleaseTime('');
                        setReleaseDate('');
                        setReleaseNote('');
                      }}
                      className="text-[11px] font-semibold text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 hover:border-red-500/40"
                      title="Clear and reset countdown date and time"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear / Reset</span>
                    </button>
                  )}
                </div>

                <div className="pt-2">
                  {isLoadingTvMaze ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400 text-xs animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Querying official global television databases...</span>
                    </div>
                  ) : tvMazeInfo ? (
                    <div className="space-y-3.5">
                      {/* Active OUT NOW Episode (within 24 hours from exact airstamp) */}
                      {tvMazeInfo.outNowEpisode && (
                        <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg space-y-2 shadow-md">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded bg-emerald-500 text-black shadow-sm animate-pulse">
                              🎉 S{tvMazeInfo.outNowEpisode.season} E{tvMazeInfo.outNowEpisode.number} OUT NOW!
                            </span>
                            <span className="text-[11px] font-mono text-emerald-300 font-bold">
                              Aired {tvMazeInfo.outNowEpisode.airstamp ? formatToLocalDisplay(tvMazeInfo.outNowEpisode.airstamp) : `${tvMazeInfo.outNowEpisode.airdate} at ${tvMazeInfo.outNowEpisode.airtime || '20:00'}`}
                            </span>
                          </div>
                          <h5 className="text-xs font-black text-white">
                            &ldquo;{tvMazeInfo.outNowEpisode.name}&rdquo;
                          </h5>
                          <p className="text-[11px] text-emerald-300/90 font-medium">
                            Available now to stream on {show.platform || 'TV'} (Active in 24h release window)
                          </p>
                        </div>
                      )}

                      {tvMazeInfo.nextEpisode ? (
                        <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-lg space-y-2.5">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                S{tvMazeInfo.nextEpisode.season} E{tvMazeInfo.nextEpisode.number} Scheduled
                              </span>
                              <h5 className="text-xs font-black text-white mt-1">
                                &ldquo;{tvMazeInfo.nextEpisode.name}&rdquo;
                              </h5>
                            </div>
                            
                            {/* Real-time Ticking Live Countdown component */}
                            {tvMazeInfo.nextEpisode.airstamp && (
                              <TvMazeEpisodeCountdown airstamp={tvMazeInfo.nextEpisode.airstamp} />
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 flex-wrap gap-2">
                            <p className="text-[11px] text-zinc-400">
                              Airing: <span className="text-zinc-200 font-bold">{new Date(tvMazeInfo.nextEpisode.airdate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span> {tvMazeInfo.nextEpisode.airtime && `at ${tvMazeInfo.nextEpisode.airtime}`}
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                if (tvMazeInfo?.nextEpisode) {
                                  const nextDateOnly = tvMazeInfo.nextEpisode.airdate;
                                  const nextTime = tvMazeInfo.nextEpisode.airtime || '20:00';
                                  setReleaseDateOnly(nextDateOnly);
                                  setReleaseTime(nextTime);
                                  const combined = combineDateAndTime(nextDateOnly, nextTime);
                                  setReleaseDate(combined);
                                  setReleaseNote(`S${tvMazeInfo.nextEpisode.season} E${tvMazeInfo.nextEpisode.number}: ${tvMazeInfo.nextEpisode.name}`);
                                }
                              }}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 transition-all cursor-pointer flex items-center gap-1"
                              title="Set this next episode as the main countdown date"
                            >
                              <span>✨ Set as Countdown Target</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-lg">
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            {tvMazeInfo.status === 'Ended' ? (
                              <span className="flex items-center gap-1.5 text-red-400/90 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                <span>This series is marked as <strong>Ended</strong> by the network. No future episodes are scheduled.</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-zinc-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>Series is active/ongoing, but the next episode's premiere date hasn't been officially scheduled yet.</span>
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Release & Premiere Countdown Setup */}
                <div className="space-y-3.5 pt-3 border-t border-zinc-800/60 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Target Premiere Date */}
                    <div className="space-y-1.5">
                      <label htmlFor="detail-release-date" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        Target Premiere Date
                      </label>
                      <input
                        id="detail-release-date"
                        type="date"
                        value={releaseDateOnly}
                        onChange={(e) => handleReleaseDateChange(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono shadow-inner focus:outline-none focus:border-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Specific Premiere Time */}
                    <div className="space-y-1.5">
                      <label htmlFor="detail-release-time" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        Specify Time (HH:mm)
                      </label>
                      <input
                        id="detail-release-time"
                        type="time"
                        value={releaseTime}
                        onChange={(e) => handleReleaseTimeChange(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono shadow-inner focus:outline-none focus:border-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Premiere / Countdown Note */}
                    <div className="space-y-1.5">
                      <label htmlFor="detail-release-note" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5">
                        Premiere / Countdown Note
                      </label>
                      <input
                        id="detail-release-note"
                        type="text"
                        value={releaseNote}
                        onChange={(e) => setReleaseNote(e.target.value)}
                        placeholder="e.g. Season 2, Final Movie"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white shadow-inner focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              id="delete-show-btn"
              onClick={() => onDelete(show)}
              data-preserve-theme="true"
              className="preserve-theme-color flex items-center gap-1.5 text-xs px-3 py-2 rounded transition-colors cursor-pointer hover:bg-red-500/10"
              style={{ color: '#f87171' }}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete from Tracker</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                id="save-detail-btn"
                onClick={handleSave}
                data-preserve-theme="true"
                className="preserve-theme-color flex items-center gap-1.5 text-white text-xs sm:text-sm font-semibold px-5 py-2 rounded-md transition-all cursor-pointer"
                style={{ backgroundColor: '#E50914', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(185, 28, 28, 0.35)' }}
              >
                <Save className="w-4 h-4" />
                <span>Save Changes {sheetConnected ? 'to Sheets' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
