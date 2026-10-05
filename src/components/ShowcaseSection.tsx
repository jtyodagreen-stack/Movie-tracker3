import React, { useMemo } from 'react';
import { Play, Star, ChevronRight, Info, Calendar, Clock, Bell, BellRing, ArrowRight } from 'lucide-react';
import { ShowItem } from '../types';
import { useNotificationContext } from '../context/NotificationContext';
import { getOptimizedPoster } from '../utils/imageOptimizer';
import { calculateShowProgress } from '../utils/showMetrics';
import { isShowOutNow, parseReleaseDateToTimestamp, isReleaseDatePast, getEffectiveReleaseInfo } from '../services/notificationService';
import { getPriorityIndicator } from '../utils/priorityUtils';
import { formatToDDMMYYYY } from '../utils/dateUtils';

interface ShowcaseSectionProps {
  shows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
  isLoading?: boolean;
  onNavigateToFilter?: (filter?: string, sort?: string) => void;
}

export default function ShowcaseSection({
  shows,
  onOpenDetails,
  isLoading = false,
  onNavigateToFilter,
}: ShowcaseSectionProps) {
  const { isNotificationEnabled, toggleNotification } = useNotificationContext();
  const [now, setNow] = React.useState<number>(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000); // Tick every 10 seconds to update release times
    return () => clearInterval(interval);
  }, []);

  const handleToggleNotif = async (e: React.MouseEvent, show: ShowItem) => {
    e.stopPropagation();
    e.preventDefault();
    await toggleNotification(show);
  };

  // Currently Watching in-progress titles sorted High to Low by %
  const inProgressList = useMemo(() => {
    return shows
      .filter((s) => s.status === '⏳ Watching')
      .sort((a, b) => calculateShowProgress(b) - calculateShowProgress(a))
      .slice(0, 10);
  }, [shows]);

  // Top Rated titles (4-5 stars)
  const topRatedList = useMemo(() => {
    return shows
      .filter((s) => {
        const stars = s.ratingNum || (s.rating ? (s.rating.match(/⭐/g) || []).length : 0);
        return stars >= 4 || (s.rating && (s.rating.toLowerCase().includes('excellent') || s.rating.toLowerCase().includes('great')));
      })
      .sort((a, b) => (b.ratingNum || 0) - (a.ratingNum || 0))
      .slice(0, 10);
  }, [shows]);

  // Coming Soon titles with release dates or premiere notes
  const comingSoonList = useMemo(() => {
    return shows
      .filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate || s.nextAirTimestamp))
      .map((s) => ({ ...s, effectiveInfo: getEffectiveReleaseInfo(s) }))
      .filter((s) => !s.effectiveInfo.isPastWindow || s.releaseNote)
      .sort((a, b) => {
        const outNowA = a.effectiveInfo.isOut;
        const outNowB = b.effectiveInfo.isOut;

        // 1. Active "OUT NOW" releases first
        if (outNowA && !outNowB) return -1;
        if (!outNowA && outNowB) return 1;

        // If both are OUT NOW, sort by release time (latest release first)
        if (outNowA && outNowB) {
          const tsA = a.effectiveInfo.timestamp || 0;
          const tsB = b.effectiveInfo.timestamp || 0;
          return tsB - tsA;
        }

        // 2. Upcoming future releases: Sort strictly by NEAREST date/time FIRST (soonest at TOP → furthest at BOTTOM)
        const tsA = a.effectiveInfo.timestamp || 0;
        const tsB = b.effectiveInfo.timestamp || 0;

        if (tsA && tsB) return tsA - tsB; // Soonest countdown (earliest future date/time) first!
        if (tsA) return -1;
        if (tsB) return 1;
        return (a.releaseNote || a.title).localeCompare(b.releaseNote || b.title);
      })
      .slice(0, 10);
  }, [shows, now]);

  if (!isLoading && shows.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-4 pb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Active Watching In-Progress */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 border-b border-zinc-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-500 fill-current" />
                <h3 className="text-sm font-bold text-white tracking-tight">Currently In-Progress Shows</h3>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold self-start sm:self-auto">
                {isLoading ? '...' : inProgressList.length} titles
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="w-10 h-14 bg-zinc-800 rounded animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
                      <div className="h-2 bg-zinc-800 rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : inProgressList.length > 0 ? (
              <div className="space-y-2.5">
                {inProgressList.map((show) => {
                  const cur = parseInt(String(show.episodes).replace(/[^0-9]/g, '')) || 1;
                  const max = parseInt(String(show.maxEp).replace(/[^0-9]/g, '')) || 8;
                  const progress = calculateShowProgress(show);

                  return (
                    <div
                      key={show.id}
                      onClick={() => onOpenDetails(show)}
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex flex-row items-center gap-1 text-[10px] text-zinc-400 mt-0.5 truncate whitespace-nowrap">
                            {show.platform && (
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                                {show.platform}
                              </span>
                            )}
                            <div className="flex flex-row items-center gap-1 shrink-0">
                              {show.isWishlist && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/95 text-black border border-amber-400 shadow-sm shrink-0">
                                  🎁 Wishlist
                                </span>
                              )}
                              {(() => {
                                const p = getPriorityIndicator(show.priority, show.isWishlist);
                                if (!p) return null;
                                return (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded border shrink-0 ${p.className}`} title={p.tooltip}>
                                    {p.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="truncate">{show.type === 'Movie' ? 'Movie' : `${show.seasons} • Ep ${cur}/${max}`}</span>
                          </div>
                          <div className="w-32 bg-zinc-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-full rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-mono font-bold text-amber-400">{progress}%</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">No shows currently marked as Watching</p>
            )}
          </div>

          {onNavigateToFilter && inProgressList.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateToFilter('⏳ Watching', 'progress-desc')}
              className="mt-3.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer w-full group/btn"
            >
              <span>View All Watching Titles</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        {/* Top Rated Titles */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 border-b border-zinc-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Top Rated Titles (4–5 Stars)</h3>
              </div>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-mono font-bold self-start sm:self-auto">
                {topRatedList.length} titles
              </span>
            </div>

            {topRatedList.length > 0 ? (
              <div className="space-y-2.5">
                {topRatedList.map((show) => {
                  let stars = show.ratingNum || 0;
                  if (!stars && show.rating) {
                    if (show.rating.toLowerCase().includes('excellent')) stars = 5;
                    else if (show.rating.toLowerCase().includes('great')) stars = 4;
                    else if (show.rating.toLowerCase().includes('good')) stars = 3;
                    else if (show.rating.toLowerCase().includes('fair')) stars = 2;
                    else if (show.rating.toLowerCase().includes('poor')) stars = 1;
                    else {
                      stars = (show.rating.match(/⭐/g) || []).length;
                    }
                  }
                  if (!stars) stars = 5;

                  return (
                    <div
                      key={show.id}
                      onClick={() => onOpenDetails(show)}
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex flex-row items-center gap-1 text-[10px] text-zinc-400 mt-1 whitespace-nowrap">
                            <div className="flex flex-row items-center gap-1">
                              {show.isWishlist && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/95 text-black border border-amber-400 shadow-sm shrink-0">
                                  🎁 Wishlist
                                </span>
                              )}
                              {(() => {
                                const p = getPriorityIndicator(show.priority, show.isWishlist);
                                if (!p) return null;
                                return (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded border shrink-0 ${p.className}`} title={p.tooltip}>
                                    {p.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-0.5 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                  key={i}
                                  className={`w-2.5 h-2.5 ${
                                    i <= stars
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'fill-zinc-800 text-zinc-700'
                                  }`}
                                />
                              ))}
                              <span className="text-[9px] font-bold text-amber-400 ml-1">
                                {stars === 5 ? '5/5' : `${stars}/5`}
                              </span>
                            </div>
                            {show.genre && <span className="truncate max-w-[120px] sm:max-w-none">• {show.genre}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Info className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">No titles rated 4 or 5 stars yet</p>
            )}
          </div>

          {onNavigateToFilter && topRatedList.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateToFilter('⭐ Top Rated', 'rating')}
              className="mt-3.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors cursor-pointer w-full group/btn"
            >
              <span>View All Top Rated Titles</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        {/* Coming Soon & Premieres Section */}
        <div className="bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 border-b border-zinc-800/80 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                <h3 className="text-sm font-bold text-white tracking-tight">Upcoming Release Dates</h3>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold self-start sm:self-auto">
                {comingSoonList.length} upcoming
              </span>
            </div>

            {comingSoonList.length > 0 ? (
              <div className="space-y-2.5">
                {comingSoonList.map((show: any) => {
                  const outNow = show.effectiveInfo.isOut;
                  const dateStr = outNow ? '🎉 OUT NOW' : (show.effectiveInfo.label || 'Coming Soon');

                  return (
                    <div
                      key={show.id}
                      onClick={() => onOpenDetails(show)}
                      className="group bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 shadow">
                          <img
                            src={getOptimizedPoster(show.posterUrl || show.backdropUrl)}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                            {show.title}
                          </h4>
                          <div className="flex flex-row items-center gap-1.5 text-[10px] whitespace-nowrap">
                            {show.platform && (
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {show.platform}
                              </span>
                            )}
                            <div className="flex flex-row items-center gap-1">
                              {show.isWishlist && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/95 text-black border border-amber-400 shadow-sm shrink-0">
                                  🎁 Wishlist
                                </span>
                              )}
                              {(() => {
                                const p = getPriorityIndicator(show.priority, show.isWishlist);
                                if (!p) return null;
                                return (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded border shrink-0 ${p.className}`} title={p.tooltip}>
                                    {p.label}
                                  </span>
                                );
                              })()}
                            </div>
                            {outNow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-950/90 border border-emerald-600/80 px-2 py-0.5 rounded shadow animate-pulse">
                                🎉 OUT NOW!
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.2 rounded">
                                <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{dateStr}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!outNow && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleNotif(e, show)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isNotificationEnabled(show)
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30 shadow'
                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-white hover:bg-zinc-700'
                            }`}
                            title={isNotificationEnabled(show) ? '24h Release Alert Active (Click to disable)' : 'Alert me 24 hours before release'}
                          >
                            {isNotificationEnabled(show) ? (
                              <BellRing className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center space-y-1 my-auto">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No shows with upcoming release dates</p>
                <p className="text-[10px] text-zinc-600">Add a release date or premiere note to any show to list it here</p>
              </div>
            )}
          </div>

          {onNavigateToFilter && comingSoonList.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateToFilter('⏰ Coming Soon')}
              className="mt-3.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer w-full group/btn"
            >
              <span>View All Upcoming Releases</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
