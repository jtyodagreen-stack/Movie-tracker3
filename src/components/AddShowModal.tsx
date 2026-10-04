import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Star, Sparkles, Save, Image as ImageIcon, Loader2, Check, Search, Film, Tv, Calendar, Clock, RotateCcw, Tag, AlertTriangle, ExternalLink } from 'lucide-react';
import { ShowItem, ShowType, WatchStatus, PRESET_PLATFORMS } from '../types';
import { getBackdropForShow, getPosterForShow } from '../data/mediaAssets';
import ImageUploader from './ImageUploader';
import { normalizeSeasonStr, normalizeEpisodeStr, normalizePlatform, parseGoogleSheetsDate } from '../services/sheetsService';
import { autoFetchPoster, searchLiveSuggestions, getImdbSearchUrl, LiveSearchItem, PosterCandidate, PosterSearchResult } from '../services/posterService';
import { fetchLiveTvMazeInfo, TvMazeShowInfo, TvMazeEpisode } from '../services/tvMazeService';
import { extractDateOnly, extractTimeOnly, combineDateAndTime, formatToDDMMYYYY, formatToYYYYMMDD, getTodayDDMMYYYY } from '../utils/dateUtils';
import { enableShowNotificationSilent } from '../services/notificationService';

interface AddShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newShow: ShowItem) => void;
  sheetConnected: boolean;
  defaultViewer?: string;
  sheetPlatforms?: string[];
  sheetViewers?: string[];
  sheetGenres?: string[];
  initialIsWishlist?: boolean;
  masterSheetName?: string;
  wishlistSheetName?: string;
  shows?: ShowItem[];
  onSelectExistingShow?: (show: ShowItem) => void;
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
      const m = Math.floor((diff % (60 * 1000)) / (60 * 1000));
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
    <div translate="no" className="notranslate flex items-center gap-1.5 font-mono text-xs bg-zinc-950/70 py-1 px-3 rounded-md border border-zinc-800">
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

export default function AddShowModal({
  isOpen,
  onClose,
  onAdd,
  sheetConnected,
  defaultViewer = '',
  sheetPlatforms = [],
  sheetViewers = [],
  sheetGenres = [],
  initialIsWishlist = false,
  masterSheetName = 'MASTER TRACKER',
  wishlistSheetName = 'Wishlist',
  shows = [],
  onSelectExistingShow,
  viewerColors,
}: AddShowModalProps) {
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

  const [destination, setDestination] = useState<'master' | 'wishlist'>(
    initialIsWishlist ? 'wishlist' : 'master'
  );
  const [title, setTitle] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  const [duplicateShowItem, setDuplicateShowItem] = useState<ShowItem | null>(null);

  // Dynamic Library Counter
  const totalLibraryShows = shows.length;
  const [type, setType] = useState<ShowType>('Series');
  const [platform, setPlatform] = useState<string>(
    sheetPlatforms.length > 0 ? normalizePlatform(sheetPlatforms[0]) : '📺 Netflix'
  );
  const [seasons, setSeasons] = useState('S1');
  const [episodes, setEpisodes] = useState('E1');
  const [maxEp, setMaxEp] = useState('E8');
  const [genre, setGenre] = useState('Drama');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [status, setStatus] = useState<WatchStatus>('⏳ Watching');
  const [ratingNum, setRatingNum] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [who, setWho] = useState(defaultViewer || (sheetViewers.length > 0 ? sheetViewers[0] : ''));
  const [priority, setPriority] = useState('🔴 High');

  // Auto Poster & IMDb Live Search State
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);
  const [posterResult, setPosterResult] = useState<PosterSearchResult | null>(null);
  const [posterCandidates, setPosterCandidates] = useState<PosterCandidate[]>([]);
  const [selectedPosterUrl, setSelectedPosterUrl] = useState<string>('');
  const [detectedMetadata, setDetectedMetadata] = useState<{ year?: string; genre?: string; synopsis?: string } | null>(null);
  const [imdbId, setImdbId] = useState('');
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // TVMaze Live Tracker State
  const [tvMazeInfo, setTvMazeInfo] = useState<TvMazeShowInfo | null>(null);
  const [isLoadingTvMaze, setIsLoadingTvMaze] = useState(false);

  // Live Suggestion Dropdown State
  const [liveSuggestions, setLiveSuggestions] = useState<LiveSearchItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!who && sheetViewers.length > 0) {
      setWho(sheetViewers[0]);
    }
  }, [sheetViewers, who]);

  // Click outside to dismiss suggestion dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [dateAdded, setDateAdded] = useState(getTodayDDMMYYYY());
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseDateOnly, setReleaseDateOnly] = useState('');
  const [releaseTime, setReleaseTime] = useState('');
  const [releaseNote, setReleaseNote] = useState('');
  const [isWishlistDone, setIsWishlistDone] = useState(false);

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

  const allGenres = useMemo(() => {
    const set = new Set<string>(GENRE_PRESETS);
    if (sheetGenres && sheetGenres.length > 0) {
      sheetGenres.forEach((g) => {
        if (g && g.trim()) set.add(g.trim());
      });
    }
    return Array.from(set);
  }, [sheetGenres]);

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

  const allPlatforms = PRESET_PLATFORMS;

  // Auto-fetch poster, metadata, live suggestions, platform, and episode count as user types Title
  useEffect(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setIsFetchingPoster(false);
      setPosterResult(null);
      setPosterCandidates([]);
      setLiveSuggestions([]);
      setSelectedPosterUrl('');
      setPosterUrl('');
      setBackdropUrl('');
      setDetectedMetadata(null);
      setReleaseDate('');
      setReleaseDateOnly('');
      setReleaseTime('');
      setReleaseNote('');
      setNotes('');
      setTvMazeInfo(null);
      setIsLoadingTvMaze(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsFetchingPoster(true);
    setIsLoadingTvMaze(true);
    
    // Clear notes & release countdown setup fields on new search
    setNotes('');
    setReleaseDate('');
    setReleaseDateOnly('');
    setReleaseTime('');
    setReleaseNote('');

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Fast parallel fetch: live IMDb/TVMaze suggestions, auto poster, and live TVMaze schedule
        const [suggestions, fetchRes, tvMazeSchedule] = await Promise.all([
          searchLiveSuggestions(trimmedTitle, type),
          autoFetchPoster(trimmedTitle, type, genre),
          type === 'Series' ? fetchLiveTvMazeInfo(trimmedTitle) : Promise.resolve(null),
        ]);

        setLiveSuggestions(suggestions);
        const { result, candidates } = fetchRes;
        setPosterResult(result);
        setPosterCandidates(candidates);
        setTvMazeInfo(tvMazeSchedule);

        if (result && result.matchedTitle && (trimmedTitle.includes('imdb.com') || trimmedTitle.match(/tt\d+/i))) {
          setTitle(result.matchedTitle);
        }

        if (result && result.type && (trimmedTitle.includes('imdb.com') || trimmedTitle.match(/tt\d+/i))) {
          setType(result.type);
          if (result.type === 'Movie') {
            setTvMazeInfo(null);
            setReleaseDate('');
            setReleaseDateOnly('');
            setReleaseTime('');
            setReleaseNote('');
          }
        }

        if (result && result.posterUrl) {
          setSelectedPosterUrl(result.posterUrl);
          setPosterUrl(result.posterUrl);
          setBackdropUrl(result.backdropUrl || result.posterUrl);
        }

        if (result && result.imdbId) {
          setImdbId(result.imdbId);
        }

        if (tvMazeSchedule && tvMazeSchedule.nextEpisode) {
          const nextEp = tvMazeSchedule.nextEpisode;
          setReleaseDateOnly(nextEp.airdate);
          setReleaseTime(nextEp.airtime || '00:00');
          setReleaseNote(`S${nextEp.season} E${nextEp.number}: ${nextEp.name}`);
          setReleaseDate(combineDateAndTime(nextEp.airdate, nextEp.airtime || '00:00'));
        }

        if (result && (result.year || result.genre || result.synopsis)) {
          setDetectedMetadata({
            year: result.year,
            genre: result.genre,
            synopsis: result.synopsis,
          });

          // Auto-apply detected synopsis directly into notes field
          if (result.synopsis) {
            setNotes(result.synopsis);
          }

          // Auto-apply detected year
          if (result.year) {
            setYear(result.year);
          }

          // Auto-apply detected genre
          if (result.genre) {
            const matchedGenre = allGenres.find(
              (g) => g.toLowerCase() === result.genre?.toLowerCase() || result.genre?.toLowerCase().includes(g.toLowerCase())
            );
            if (matchedGenre) {
              setGenre(matchedGenre);
            }
          }
        }

        // Auto-detect Season & Total Episodes for TV Series (e.g. S1 and E8 / E10 / E6)
        if (result && type === 'Series' && result.maxEp) {
          setMaxEp(result.maxEp);
          setSeasons('S1');
        }
      } catch (err) {
        console.warn('Auto poster fetch notice:', err);
      } finally {
        setIsFetchingPoster(false);
        setIsLoadingTvMaze(false);
      }
    }, 280);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [title, type]);

  if (!isOpen) return null;

  const handleSelectLiveSuggestion = (item: LiveSearchItem) => {
    setTitle(item.title);
    setType(item.type);

    // Check duplicate upon selecting suggestion
    const cleanCand = item.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentImdb = item.imdbId;
    const dupe = cleanCand.length >= 2 ? shows.find((s) => {
      if (currentImdb && s.imdbId && currentImdb === s.imdbId) return true;
      if (!s.title) return false;
      const cleanExisting = s.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanExisting.length >= 2 && cleanCand === cleanExisting;
    }) : null;

    if (dupe) {
      setDuplicateShowItem(dupe);
      setDuplicateError(
        `🚫 Duplicate Found: "${dupe.title}" is already in your ${dupe.isWishlist ? 'Wishlist' : 'Master Tracker'} (${dupe.status} • ${dupe.platform || 'Tracker'}).`
      );
    } else {
      setDuplicateShowItem(null);
      setDuplicateError('');
    }

    // Clear notes & release countdown setup fields before potential new data
    setNotes(item.synopsis || '');
    setReleaseDate('');
    setReleaseDateOnly('');
    setReleaseTime('');
    setReleaseNote('');

    if (item.posterUrl) {
      setPosterUrl(item.posterUrl);
      setSelectedPosterUrl(item.posterUrl);
      setBackdropUrl(item.backdropUrl || item.posterUrl);
    }
    if (item.year) {
      setYear(item.year);
    }
    if (item.genre) {
      const matchedGenre = allGenres.find(
        (g) => g.toLowerCase() === item.genre?.toLowerCase() || item.genre?.toLowerCase().includes(g.toLowerCase())
      );
      if (matchedGenre) setGenre(matchedGenre);
    }
    if (item.synopsis) {
      setNotes(item.synopsis);
    }
    if (item.imdbId) {
      setImdbId(item.imdbId);
    }
    if (item.type === 'Series' && item.maxEp) {
      setMaxEp(item.maxEp);
      setSeasons('S1');
    }
    if (item.type === 'Series') {
      setIsLoadingTvMaze(true);
      fetchLiveTvMazeInfo(item.title).then((info) => {
        setTvMazeInfo(info);
        if (info && info.nextEpisode) {
          const nextEp = info.nextEpisode;
          setReleaseDateOnly(nextEp.airdate);
          setReleaseTime(nextEp.airtime || '00:00');
          setReleaseNote(`S${nextEp.season} E${nextEp.number}: ${nextEp.name}`);
          setReleaseDate(combineDateAndTime(nextEp.airdate, nextEp.airtime || '00:00'));
        }
      }).catch(err => console.warn(err))
        .finally(() => setIsLoadingTvMaze(false));
    } else {
      setTvMazeInfo(null);
    }
    setShowSuggestions(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || liveSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < liveSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : liveSuggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < liveSuggestions.length) {
        e.preventDefault();
        handleSelectLiveSuggestion(liveSuggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSelectAlternatePoster = (candidate: PosterCandidate) => {
    setSelectedPosterUrl(candidate.posterUrl);
    setPosterUrl(candidate.posterUrl);
    setBackdropUrl(candidate.posterUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Strict Duplicate Title Check upon submission
    const cleanCand = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentImdb = imdbId || posterResult?.imdbId;
    const dupe = cleanCand.length >= 2 ? shows.find((s) => {
      if (currentImdb && s.imdbId && currentImdb === s.imdbId) return true;
      if (!s.title) return false;
      const cleanExisting = s.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanExisting.length >= 2 && cleanCand === cleanExisting;
    }) : null;

    if (dupe) {
      setDuplicateShowItem(dupe);
      setDuplicateError(
        `🚫 Duplicate Found: "${dupe.title}" is already in your ${dupe.isWishlist ? 'Wishlist' : 'Master Tracker'} (${dupe.status} • ${dupe.platform || 'Tracker'}).`
      );
      return;
    }

    const resolvedPlatform = platform;
    const getRatingText = (num: number): string => {
      if (num === 1) return '⭐ = Poor';
      if (num === 2) return '⭐⭐ = Fair';
      if (num === 3) return '⭐⭐⭐ = Good';
      if (num === 4) return '⭐⭐⭐⭐ = Great';
      if (num === 5) return '⭐⭐⭐⭐⭐ = Excellent';
      return 'Unrated';
    };
    const starsText =
      destination === 'wishlist'
        ? ''
        : ratingNum > 0
        ? getRatingText(ratingNum)
        : 'Unrated';
    const finalRatingNum = destination === 'wishlist' ? 0 : ratingNum;
    const id = `show-${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const autoResolvedPoster =
      selectedPosterUrl.trim() ||
      posterUrl.trim() ||
      posterResult?.posterUrl ||
      getPosterForShow(title, genre);

    const autoResolvedBackdrop =
      backdropUrl.trim() ||
      posterResult?.backdropUrl ||
      autoResolvedPoster ||
      getBackdropForShow(title, genre);

    const finalStatus: WatchStatus =
      destination === 'wishlist'
        ? (isWishlistDone ? '✅ Watched' : '⏳ Watching')
        : status;

    const isMovie = type === 'Movie';
    const isWishlist = destination === 'wishlist';

    const newShow: ShowItem = {
      id,
      title: title.trim(),
      type,
      platform: resolvedPlatform,
      seasons: isMovie || isWishlist ? '' : normalizeSeasonStr(seasons.trim() || 'S1'),
      episodes: isMovie || isWishlist ? '' : normalizeEpisodeStr(episodes.trim() || 'E1'),
      maxEp: isMovie || isWishlist ? '' : normalizeEpisodeStr(maxEp.trim() || 'E8'),
      nextEp: isMovie || isWishlist ? false : true,
      nextSsn: false,
      genre: genre.trim() || 'Drama',
      year: year.trim() || new Date().getFullYear().toString(),
      status: finalStatus,
      rating: starsText,
      ratingNum: finalRatingNum,
      notes: notes.trim(),
      who: who.trim() || (sheetViewers.length > 0 ? sheetViewers[0] : ''),
      isWishlist,
      sheetTabName: isWishlist ? (wishlistSheetName || 'Wishlist') : (masterSheetName || 'MASTER TRACKER'),
      priority: isWishlist ? (priority.trim() || 'High') : undefined,
      dateAdded: isWishlist ? (parseGoogleSheetsDate(dateAdded) || getTodayDDMMYYYY()) : undefined,
      backdropUrl: autoResolvedBackdrop,
      posterUrl: autoResolvedPoster,
      imdbId: imdbId || posterResult?.imdbId || undefined,
      releaseDate: releaseDate ? parseGoogleSheetsDate(releaseDate) : undefined,
      releaseNote: releaseNote.trim() || undefined,
      createdTimestamp: Date.now(),
      addedTime: Date.now(),
    };

    // Auto-enable release notification bell by default for newly added titles
    enableShowNotificationSilent(newShow);

    onAdd(newShow);
    setTitle('');
    setImdbId('');
    setNotes('');
    setPosterUrl('');
    setBackdropUrl('');
    setSelectedPosterUrl('');
    setRatingNum(0);
    setReleaseDate('');
    setReleaseNote('');
    onClose();
  };

  const currentEffectivePoster =
    selectedPosterUrl ||
    posterUrl ||
    (title.trim() ? getPosterForShow(title, genre) : '');

  return (
    <div
      id="add-show-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="add-show-modal-dialog"
        className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#181818] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-4px); }
            40%, 80% { transform: translateX(4px); }
          }
          .animate-shake {
            animation: shake 0.4s ease-in-out;
          }
        `}</style>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-[red-600] flex items-center justify-center text-white font-bold shrink-0 shadow-md">
              <Plus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Add New Show or Movie
                </h2>

                {/* Dynamic Library Counter Pill */}
                <div
                  id="add-modal-library-counter"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all duration-200 shadow-sm border bg-zinc-800/90 text-zinc-300 border-zinc-700/80"
                  title={`Your library currently has ${totalLibraryShows} ${totalLibraryShows === 1 ? 'show' : 'shows'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    <strong className="text-white font-mono">{totalLibraryShows}</strong> {totalLibraryShows === 1 ? 'show' : 'shows'} in library
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 truncate mt-0.5">
                Official poster & metadata auto-fetch instantly {sheetConnected ? '& sync with Google Sheets' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="add-show-form"
              id="add-top-save-btn"
              disabled={Boolean(duplicateShowItem && duplicateError)}
              data-preserve-theme="true"
              className="preserve-theme-color flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shadow-md transition-all"
              style={
                Boolean(duplicateShowItem && duplicateError)
                  ? { backgroundColor: '#450a0a', color: '#fca5a5', border: '2px solid #dc2626', cursor: 'not-allowed' }
                  : { backgroundColor: '#059669', color: '#ffffff', border: '1px solid rgba(16, 185, 129, 0.5)', cursor: 'pointer' }
              }
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{Boolean(duplicateShowItem && duplicateError) ? '🚫 Duplicate' : 'Add Title'}</span>
              <span className="sm:hidden">{Boolean(duplicateShowItem && duplicateError) ? 'Duplicate' : 'Add'}</span>
            </button>
            <button
              id="close-add-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form id="add-show-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          {/* Destination Sheet Selector */}
          <div className="space-y-1.5 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">Save Destination</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {destination === 'wishlist' ? `Target Sheet: ${wishlistSheetName || '📋  WISHLIST'}` : `Target Sheet: ${masterSheetName || 'MASTER TRACKER'}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="dest-master-btn"
                onClick={() => setDestination('master')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  destination === 'master'
                    ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm'
                    : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>📊 Master Tracker</span>
              </button>
              <button
                type="button"
                id="dest-wishlist-btn"
                onClick={() => setDestination('wishlist')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  destination === 'wishlist'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500 shadow-sm ring-1 ring-emerald-500/40'
                    : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>📋 Wishlist Sheet</span>
              </button>
            </div>
          </div>

          {/* Title and Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div ref={suggestionContainerRef} className="sm:col-span-2 space-y-2 relative">
              <div className="flex items-center justify-between">
                <label htmlFor="new-show-title" className="text-xs font-bold text-zinc-300 uppercase tracking-widest block ml-1 flex items-center gap-1.5">
                  Title *
                  {isFetchingPoster && (
                    <span className="text-[11px] font-normal text-amber-400 normal-case flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Live IMDb Search...
                    </span>
                  )}
                </label>
                <a
                  href={getImdbSearchUrl(title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                  title="Open IMDb Movies & Series search in new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open IMDb (Movies/Series) ↗</span>
                </a>
              </div>
              <div className="relative">
                <input
                  id="new-show-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDuplicateError('');
                    setDuplicateShowItem(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (liveSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Type title or paste IMDb URL here..."
                  className={`w-full bg-zinc-900 border rounded-md px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none shadow-inner pr-10 transition-colors ${
                    Boolean(duplicateShowItem && duplicateError)
                      ? 'border-red-500 ring-2 ring-red-500/50 animate-shake'
                      : 'border-zinc-700 focus:border-red-500'
                  }`}
                  autoFocus
                  autoComplete="off"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  {isFetchingPoster ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 text-zinc-500" />
                  )}
                </div>

                {/* Live Suggestion Dropdown */}
                {showSuggestions && liveSuggestions.length > 0 && (
                  <div
                    className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-zinc-900/98 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-zinc-800 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin"
                  >
                    <div className="px-3 py-1.5 bg-zinc-950/90 flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800">
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Live Suggestions
                      </span>
                      <span className="text-[10px] text-zinc-500">Click or press Enter to auto-fill</span>
                    </div>
                    {liveSuggestions.map((item, idx) => {
                      const isActive = idx === activeSuggestionIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectLiveSuggestion(item)}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          className={`w-full text-left p-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                            isActive ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/70 text-zinc-200'
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="w-10 h-14 rounded overflow-hidden bg-zinc-950 shrink-0 border border-zinc-700/60 shadow-xs relative">
                            <img
                              src={item.posterUrl || getPosterForShow(item.title, 'Drama')}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getPosterForShow(item.title, 'Drama');
                              }}
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-white truncate">{item.title}</span>
                              {item.year && (
                                <span className="text-xs text-zinc-400 font-mono shrink-0">({item.year})</span>
                              )}
                              <span
                                className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                                  item.type === 'Movie'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                                }`}
                              >
                                {item.type}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-zinc-500 text-xs pr-1">
                            <span className="text-[10px] font-black bg-amber-400 text-black px-1.5 py-0.5 rounded font-mono shadow-xs">
                              IMDb
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {/* Direct IMDb Filtered Search Footer */}
                    <div className="px-3 py-2 bg-zinc-950/95 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Movies &amp; Series only
                      </span>
                      <a
                        href={getImdbSearchUrl(title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Search on IMDb ↗</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="new-show-type" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Format</label>
              <select
                id="new-show-type"
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as ShowType;
                  setType(newType);
                  if (newType === 'Movie') {
                    setTvMazeInfo(null);
                    setReleaseDate('');
                    setReleaseDateOnly('');
                    setReleaseTime('');
                    setReleaseNote('');
                  }
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
              >
                <option value="Series">Series (TV)</option>
                <option value="Movie">Movie (Film)</option>
              </select>
            </div>
          </div>

          {/* Real-time Duplicate Found Warning Indicator */}
          {(() => {
            const activeDuplicate = duplicateShowItem;
            if (!activeDuplicate) return null;
            return (
              <div
                id="duplicate-title-warning-box"
                data-preserve-theme="true"
                className="preserve-theme-color p-4 rounded-xl space-y-3 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
                style={{ backgroundColor: 'rgba(69, 10, 10, 0.95)', border: '2px solid #ef4444' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      data-preserve-theme="true"
                      className="preserve-theme-color w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: 'rgba(127, 29, 29, 0.4)', border: '1px solid #ef4444', color: '#f87171' }}
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-white">
                          Duplicate Found: &ldquo;{activeDuplicate.title}&rdquo;
                        </h4>
                        <span
                          data-preserve-theme="true"
                          className="preserve-theme-color text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white shadow-sm"
                          style={{ backgroundColor: '#dc2626' }}
                        >
                          Already in Library
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(254, 202, 202, 0.95)' }}>
                        This show is already in your <strong>{activeDuplicate.isWishlist ? 'Wishlist' : 'Master Tracker'}</strong> ({activeDuplicate.status} • {activeDuplicate.platform || 'Tracker'}). Duplicate titles cannot be added.
                      </p>
                    </div>
                  </div>

                  {onSelectExistingShow && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectExistingShow(activeDuplicate);
                      }}
                      data-preserve-theme="true"
                      className="preserve-theme-color text-xs text-white font-black px-3.5 py-2 rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer whitespace-nowrap"
                      style={{ backgroundColor: '#dc2626', border: '1px solid rgba(248, 113, 113, 0.6)' }}
                    >
                      Open Existing Show →
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Automatic Live Poster Card & Metadata Assistant */}
          {title.trim().length > 1 && (
            <div className="p-3.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3.5">
                {/* Poster Artwork Preview Box */}
                <div className="relative w-16 sm:w-20 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-950 border border-zinc-700 shadow-md shrink-0">
                  {isFetchingPoster ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-amber-400 p-1 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mb-1 text-amber-400" />
                      <span className="text-[9px] font-mono leading-tight">Fetching poster...</span>
                    </div>
                  ) : currentEffectivePoster ? (
                    <img
                      src={currentEffectivePoster}
                      alt={title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getPosterForShow(title, genre);
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-2 text-center">
                      <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                      <span className="text-[10px]">No Poster</span>
                    </div>
                  )}
                  {posterResult?.source && posterResult.source !== 'fallback' && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-xs py-0.5 text-[8px] text-center text-emerald-300 font-mono font-bold tracking-tighter">
                      {posterResult.source.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info & Detected Metadata */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm font-extrabold text-white truncate">
                        {isFetchingPoster
                          ? 'Searching official database...'
                          : posterResult?.matchedTitle || title || 'Title'}
                      </span>
                    </div>
                    {posterResult && posterResult.source !== 'fallback' && (
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-600/40 px-2 py-0.5 rounded-full shrink-0">
                        Official Match
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                    {detectedMetadata?.synopsis
                      ? detectedMetadata.synopsis
                      : 'Poster & metadata are automatically attached and will sync directly to your Google Sheet.'}
                  </p>

                </div>
              </div>

              {/* Manual URL Override Option */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  {showManualUrlInput ? 'Hide custom URL input' : 'Paste custom image URL instead'}
                </button>
              </div>

              {showManualUrlInput && (
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <ImageUploader
                    label="Custom Web Image URL"
                    description="Paste any custom image link (IMDb, TMDB, Wikipedia, direct URL) to override the auto poster"
                    currentUrl={posterUrl}
                    aspectRatio="poster"
                    onImageSelected={(url) => {
                      setPosterUrl(url);
                      setSelectedPosterUrl(url);
                      setBackdropUrl(url);
                      setShowManualUrlInput(false);
                    }}
                    onImageRemoved={() => {
                      setPosterUrl('');
                      setSelectedPosterUrl('');
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Platform Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 block">Platform</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allPlatforms.map((p) => {
                const isSelected = platform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPlatform(p);
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-all inline-flex items-center cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-500 font-semibold shadow-sm'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <span>{p}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genre & Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="new-show-genre" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Genre</label>
              <select
                id="new-show-genre"
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
              <label htmlFor="new-show-year" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Release Year</label>
              <input
                id="new-show-year"
                type="text"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 1975"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3 text-base text-white focus:outline-none focus:border-red-500 font-mono shadow-inner"
              />
            </div>
          </div>

          {/* Wishlist-specific fields vs Master Tracker fields */}
          {destination === 'wishlist' ? (
            <div className="space-y-5 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="wishlist-priority" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                    Priority
                  </label>
                  <select
                    id="wishlist-priority"
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
                  <label htmlFor="wishlist-date-added" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">
                    Date Added
                  </label>
                  <div className="relative">
                    <input
                      id="wishlist-date-added"
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
                      <label htmlFor="new-show-season" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Season</label>
                      <input
                        id="new-show-season"
                        type="text"
                        value={seasons}
                        onChange={(e) => setSeasons(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner"
                        placeholder="S1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="new-show-episode" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Ep</label>
                      <input
                        id="new-show-episode"
                        type="text"
                        value={episodes}
                        onChange={(e) => setEpisodes(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3.5 text-base text-white font-mono shadow-inner text-center"
                        placeholder="E1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="new-show-max-ep" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block ml-0.5">Max Ep</label>
                      <input
                        id="new-show-max-ep"
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
                  <label htmlFor="new-show-status" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Watch Status</label>
                  <select
                    id="new-show-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WatchStatus)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-4 text-base text-white focus:outline-none focus:border-red-500 shadow-inner appearance-none"
                  >
                    <option value="✅ Watched">✅ Watched</option>
                    <option value="⏳ Watching">⏳ Watching</option>
                    <option value="⏸️ Paused">⏸️ Paused</option>
                    <option value="❌ Dropped">❌ Dropped</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="new-show-who" className="text-xs font-bold text-zinc-400 uppercase tracking-widest block ml-1">Viewer (Who)</label>
                  <select
                    id="new-show-who"
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
          {destination === 'master' && (
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
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingNum(star === ratingNum ? 0 : star)}
                    className="p-1 text-zinc-600 hover:text-amber-400 hover:scale-110 active:scale-95 transition-all cursor-pointer rounded-md hover:bg-zinc-800/50"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-7 h-7 transition-all ${
                        star <= ratingNum
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes & Synopsis */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="new-show-notes" className="text-xs font-semibold text-zinc-300 block flex items-center gap-1.5">
                <span>Notes & Synopsis</span>
                {detectedMetadata?.synopsis && (
                  <span className="text-[10px] text-emerald-400 font-normal">
                    (Auto-filled from official database)
                  </span>
                )}
              </label>
            </div>
            <textarea
              id="new-show-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Synopsis, thoughts, reminders, why you're watching..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md p-2.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 shadow-inner"
            />
          </div>

          {/* Live Network Schedule Tracker (TV Series Only) */}
          {type === 'Series' && title.trim() && (
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3.5 relative overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2">
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

              {/* Live Network Results (Top) */}
              {title.trim() && (isLoadingTvMaze || tvMazeInfo) && (
                <div className="pt-2">
                  {isLoadingTvMaze ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400 text-xs animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Querying official global television databases...</span>
                    </div>
                  ) : tvMazeInfo ? (
                    <div className="space-y-3.5">
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

                          <div className="pt-1.5 border-t border-zinc-800/60">
                            <p className="text-[11px] text-zinc-400">
                              Airing: <span className="text-zinc-200 font-bold">{new Date(tvMazeInfo.nextEpisode.airdate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span> {tvMazeInfo.nextEpisode.airtime && `at ${tvMazeInfo.nextEpisode.airtime}`}
                            </p>
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
              )}

              {/* Manual Personal Countdown Setup (Bottom) */}
              {title.trim() && (
                <div className="space-y-3.5 pt-3 border-t border-zinc-800/60 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Target Premiere Date & Time (Coupled side-by-side) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label htmlFor="new-show-release-date" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          Target Date
                        </label>
                        <input
                          id="new-show-release-date"
                          type="date"
                          value={releaseDateOnly}
                          onChange={(e) => handleReleaseDateChange(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono shadow-inner focus:outline-none focus:border-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="new-show-release-time" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          Specify Time
                        </label>
                        <input
                          id="new-show-release-time"
                          type="time"
                          value={releaseTime}
                          onChange={(e) => handleReleaseTimeChange(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono shadow-inner focus:outline-none focus:border-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Premiere / Countdown Note */}
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <label htmlFor="new-show-release-note" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-zinc-400" />
                        Premiere / Countdown Note
                      </label>
                      <input
                        id="new-show-release-note"
                        type="text"
                        value={releaseNote}
                        onChange={(e) => setReleaseNote(e.target.value)}
                        placeholder="e.g. Season 2, Final Movie, Special..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white shadow-inner focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
