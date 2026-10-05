import { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShowItem } from '../types';
import { getOptimizedPoster, getOptimizedBackdrop } from '../utils/imageOptimizer';
import { parseAnyDate, formatToDDMMYYYY, formatToLocalDisplay } from '../utils/dateUtils';
import { checkAndTrigger24hNotifications, getEffectiveReleaseInfo, isShowOutNow } from '../services/notificationService';

interface MainPageReleaseRadarBannerProps {
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
}

export default function MainPageReleaseRadarBanner({
  shows,
  onOpenDetails,
}: MainPageReleaseRadarBannerProps) {
  const [now, setNow] = useState<Date>(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    // Check notifications on tick
    checkAndTrigger24hNotifications(shows);

    const interval = setInterval(() => {
      setNow(new Date());
      checkAndTrigger24hNotifications(shows);
    }, 1000);
    return () => clearInterval(interval);
  }, [shows]);

  // Helper to parse date string into Date object
  const parseShowDate = (dateStr?: string): Date | null => {
    return parseAnyDate(dateStr);
  };

  // Compile all upcoming shows with release dates or premiere notes
  const upcomingList = useMemo(() => {
    if (!shows || shows.length === 0) return [];

    const nowMs = now.getTime();

    const parsed = shows
      .filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate || s.nextAirTimestamp || s.lastAirTimestamp))
      .map((s) => {
        const eff = getEffectiveReleaseInfo(s);
        const targetDate = eff.isOut && eff.upcomingEpisode?.timestamp
          ? new Date(eff.upcomingEpisode.timestamp)
          : (eff.date || parseShowDate(eff.formattedDateStr || s.releaseDate || s.nextAirDate));
        return {
          ...s,
          effectiveInfo: eff,
          parsedDate: targetDate,
          effectiveFormattedDate: eff.formattedDateStr,
        };
      })
      .filter((s) => {
        // Keep titles that have an active/future date OR an unexpired "OUT NOW" window OR a custom note
        if (!s.effectiveInfo.timestamp && s.releaseNote) return true;
        if (!s.effectiveInfo.timestamp && !s.effectiveInfo.outNowTimestamp) return false;
        if (s.effectiveInfo.isPastWindow) return false; // Filter out expired dates
        return true;
      });

    return parsed.sort((a, b) => {
      const aIsOut = a.effectiveInfo.isOut;
      const bIsOut = b.effectiveInfo.isOut;

      // 1. Active "OUT NOW" releases first
      if (aIsOut && !bIsOut) return -1;
      if (!aIsOut && bIsOut) return 1;

      // If both are OUT NOW, sort by release time (latest release first)
      if (aIsOut && bIsOut) {
        const tsA = a.effectiveInfo.outNowTimestamp || a.effectiveInfo.timestamp || 0;
        const tsB = b.effectiveInfo.outNowTimestamp || b.effectiveInfo.timestamp || 0;
        return tsB - tsA;
      }

      // 2. Upcoming future releases: Sort strictly by NEAREST date/time FIRST (soonest at TOP → furthest at BOTTOM)
      const timeA = a.effectiveInfo.timestamp ?? (nowMs + 86400000 * 365);
      const timeB = b.effectiveInfo.timestamp ?? (nowMs + 86400000 * 365);
      return timeA - timeB;
    });
  }, [shows, now]);

  const activeIndex = useMemo(() => {
    if (upcomingList.length === 0) return 0;
    return currentIndex % upcomingList.length;
  }, [upcomingList.length, currentIndex]);

  const activeShow = useMemo(() => {
    if (upcomingList.length === 0) return null;
    return upcomingList[activeIndex] || null;
  }, [upcomingList, activeIndex]);

  // Reset index to 0 when the top upcoming item changes (e.g. new soonest release added or sorted)
  const firstItemId = upcomingList[0]?.id;
  useEffect(() => {
    setCurrentIndex(0);
  }, [firstItemId]);

  // Auto-slideshow for Countdown Banner (12 seconds per slide, pausing on hover/interaction)
  useEffect(() => {
    if (upcomingList.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % upcomingList.length);
    }, 12000);

    return () => clearInterval(timer);
  }, [upcomingList.length, isPaused]);

  // Countdown clock calculation
  const getCountdownClock = (targetDate: Date) => {
    const total = targetDate.getTime() - now.getTime();
    if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds, isPast: false };
  };

  const isFeaturedShowReleased = useMemo(() => {
    if (!activeShow) return false;
    if (activeShow.effectiveInfo?.isOut) return true;
    if (!activeShow.parsedDate) return false;
    return activeShow.parsedDate.getTime() - now.getTime() <= 0;
  }, [activeShow, now]);

  if (!activeShow) return null;

  const handlePrev = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : upcomingList.length - 1));
  };

  const handleNext = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % upcomingList.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Horizontal swipe gesture for mobile slide change
    if (absX > 30 && absX > absY * 1.1) {
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
      return;
    }

    // Clean tap
    if (absX < 12 && absY < 12 && dt < 450) {
      const target = e.target as HTMLElement;
      if (target.closest('button')) {
        return;
      }
      onOpenDetails(activeShow);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStartRef.current = null;
          setIsPaused(false);
        }}
        className={`relative rounded-2xl overflow-hidden border shadow-2xl p-4 sm:p-6 transition-all duration-500 group touch-pan-y ${
          isFeaturedShowReleased 
            ? 'border-emerald-500/50 bg-gradient-to-r from-zinc-950 via-emerald-950/20 to-zinc-950 animate-banner-out-now' 
            : 'border-amber-500/40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950'
        }`}
      >
        {/* Background Backdrop Glow */}
        <div
          key={activeShow.id + '-backdrop'}
          className="absolute inset-0 opacity-20 bg-cover bg-center blur-lg pointer-events-none transition-opacity duration-700 animate-fadeIn"
          style={{
            backgroundImage: `url(${getOptimizedBackdrop(
              activeShow.backdropUrl || activeShow.posterUrl
            )})`,
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 px-1 sm:px-4">
          {/* Left Title & Info */}
          <div className="flex items-center gap-4 sm:gap-5 w-full lg:w-auto">
            <div className="relative shrink-0 group/poster">
              <img
                key={activeShow.id + '-poster'}
                src={getOptimizedPoster(activeShow.posterUrl)}
                alt={activeShow.title}
                className="w-16 sm:w-20 aspect-[2/3] object-cover rounded-xl border border-zinc-700 shadow-xl cursor-pointer hover:scale-105 transition-transform duration-300"
                onClick={() => onOpenDetails(activeShow)}
              />
            </div>

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {activeShow.effectiveInfo.isOut ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-500 text-black uppercase tracking-wider flex items-center gap-1 shadow animate-pulse">
                    🎉 Episode Out Now!
                  </span>
                ) : (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-black uppercase tracking-wider flex items-center gap-1 shadow">
                    <Clock className="w-3 h-3" /> Live Premiere Countdown
                  </span>
                )}

                {activeShow.platform && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {activeShow.platform}
                  </span>
                )}
              </div>

              <h3
                key={activeShow.id + '-title'}
                onClick={() => onOpenDetails(activeShow)}
                className="text-lg sm:text-2xl font-black text-white tracking-tight line-clamp-1 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {activeShow.title}
              </h3>

              {activeShow.effectiveInfo.isOut ? (
                <p className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {activeShow.effectiveInfo.outNowEpisode?.season && activeShow.effectiveInfo.outNowEpisode?.number
                      ? `S${activeShow.effectiveInfo.outNowEpisode.season} E${activeShow.effectiveInfo.outNowEpisode.number}${activeShow.effectiveInfo.outNowEpisode.name ? ` • ${activeShow.effectiveInfo.outNowEpisode.name}` : ''} — OUT NOW!`
                      : `Aired ${activeShow.effectiveFormattedDate || (activeShow.parsedDate ? formatToLocalDisplay(activeShow.parsedDate) : '')} — OUT NOW!`}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-amber-300/90 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {activeShow.effectiveFormattedDate
                      ? `Target Premiere: ${activeShow.effectiveFormattedDate}`
                      : activeShow.releaseNote ||
                        (activeShow.parsedDate
                          ? `Target Premiere: ${formatToLocalDisplay(activeShow.parsedDate)}`
                          : 'Airing Soon')}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Right Live Countdown Ticker */}
          <div className="flex items-center w-full lg:w-auto justify-center lg:justify-end">
            {activeShow.parsedDate ? (
              (() => {
                const isOut = activeShow.effectiveInfo.isOut;
                const hasUpcoming = Boolean(activeShow.effectiveInfo.upcomingEpisode?.timestamp);
                const clock = getCountdownClock(activeShow.parsedDate);

                if (isOut && !hasUpcoming) {
                  return (
                    <div className="flex items-center gap-2.5 bg-zinc-950/90 px-5 py-3.5 rounded-2xl border border-emerald-500/50 animate-out-now-flash shadow-xl">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-pulse" />
                      <span className="text-base sm:text-xl font-black text-emerald-300 uppercase tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                        OUT NOW ON {activeShow.platform || 'Streaming'}!
                      </span>
                    </div>
                  );
                }

                if (clock.isPast && !hasUpcoming) {
                  return (
                    <div className="flex items-center gap-2.5 bg-zinc-950/90 px-5 py-3.5 rounded-2xl border border-emerald-500/50 animate-out-now-flash shadow-xl">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-pulse" />
                      <span className="text-base sm:text-xl font-black text-emerald-300 uppercase tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                        OUT NOW ON {activeShow.platform || 'Streaming'}!
                      </span>
                    </div>
                  );
                }

                const upcomingEp = activeShow.effectiveInfo.upcomingEpisode;

                return (
                  <div className="flex flex-col items-center lg:items-end gap-2 w-full lg:w-auto">
                    {isOut && (
                      <div className="flex items-center gap-2 bg-zinc-950/95 px-3 sm:px-4 py-1.5 rounded-xl border border-emerald-500/50 shadow-md">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                        <span className="text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wider">
                          OUT NOW ON {activeShow.platform || 'Streaming'}!
                        </span>
                        {upcomingEp?.season && upcomingEp?.number && (
                          <span className="text-[11px] font-bold text-amber-400 border-l border-zinc-700 pl-2">
                            Next: S{upcomingEp.season} E{upcomingEp.number}
                          </span>
                        )}
                      </div>
                    )}

                    <div translate="no" className="notranslate flex items-center gap-2 sm:gap-3 md:gap-4 bg-zinc-950/90 px-3 sm:px-5 py-3 sm:py-3.5 rounded-2xl border border-amber-500/30 shadow-xl">
                      <div className="flex flex-col items-center px-1.5 sm:px-3">
                        <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-400 font-mono tracking-tight">
                          {String(clock.days).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Days</span>
                      </div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-600 pb-3">:</span>
                      <div className="flex flex-col items-center px-1.5 sm:px-3">
                        <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
                          {String(clock.hours).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Hours</span>
                      </div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-600 pb-3">:</span>
                      <div className="flex flex-col items-center px-1.5 sm:px-3">
                        <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
                          {String(clock.minutes).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] sm:text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Mins</span>
                      </div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-600 pb-3">:</span>
                      <div className="flex flex-col items-center px-1.5 sm:px-3">
                        <span className="text-3xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight animate-pulse" style={{ color: '#ef4444' }}>
                          {String(clock.seconds).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-wider" style={{ color: '#f87171' }}>Secs</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <button
                type="button"
                onClick={() => onOpenDetails(activeShow)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer hover:scale-105"
              >
                View Premiere Details
              </button>
            )}
          </div>
        </div>

        {/* Explicit Navigation Arrows (Visible on mobile & tablet, hover reveal on desktop) */}
        {upcomingList.length > 1 && (
          <>
            <button
              type="button"
              id="countdown-nav-prev"
              onClick={handlePrev}
              onTouchEnd={handlePrev}
              aria-label="Previous Premiere Show"
              title="Previous Premiere Show"
              className="flex items-center justify-center absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/80 hover:bg-black text-white/90 hover:text-white border border-white/25 hover:border-amber-400 shadow-2xl backdrop-blur-md opacity-80 lg:opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              id="countdown-nav-next"
              onClick={handleNext}
              onTouchEnd={handleNext}
              aria-label="Next Premiere Show"
              title="Next Premiere Show"
              className="flex items-center justify-center absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/80 hover:bg-black text-white/90 hover:text-white border border-white/25 hover:border-amber-400 shadow-2xl backdrop-blur-md opacity-80 lg:opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </>
        )}

        {/* Amber Bottom Indicator Track */}
        {upcomingList.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-2 border-t border-zinc-800/60">
            {upcomingList.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`Jump to premiere slide ${idx + 1}: ${item.title}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === activeIndex
                    ? 'w-6 h-1.5 bg-amber-400 shadow-md shadow-amber-950/50'
                    : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
