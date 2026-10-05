import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Tv, Sparkles, Film } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { ShowItem } from '../types';
import ShowCard from './ShowCard';

export interface ShowRowEmptyState {
  type?: 'continue-watching' | 'recently-added' | 'default';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  badge?: string;
  tipText?: string;
}

interface ShowRowProps {
  id: string;
  title: string;
  subtitle?: string;
  shows: ShowItem[];
  isLoading?: boolean;
  onOpenDetails: (show: ShowItem) => void;
  onIncrementEpisode: (show: ShowItem) => void;
  onToggleStatus: (show: ShowItem) => void;
  onTitleClick?: () => void;
  onHoverEnter?: (show: ShowItem, rect: { top: number; left: number; width: number; height: number }, shelf?: string) => void;
  onHoverLeave?: () => void;
  emptyState?: ShowRowEmptyState;
  viewerColors?: Record<string, string>;
  headerAction?: React.ReactNode;
  titleInlineAction?: React.ReactNode;
  showNewBadge?: boolean;
}

export default function ShowRow({
  id,
  title,
  subtitle,
  shows,
  isLoading = false,
  onOpenDetails,
  onIncrementEpisode,
  onToggleStatus,
  onTitleClick,
  onHoverEnter,
  onHoverLeave,
  emptyState,
  viewerColors,
  headerAction,
  titleInlineAction,
  showNewBadge,
}: ShowRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!isLoading && shows.length === 0 && !emptyState) return null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.75;
    rowRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section id={`row-${id}`} className="relative py-4 group">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div
          className={`flex items-baseline gap-2 flex-wrap ${
            onTitleClick ? 'cursor-pointer group/title' : ''
          }`}
          onClick={onTitleClick}
        >
          <h2
            className={`text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap ${
              onTitleClick ? 'group-hover/title:text-red-500 transition-colors' : ''
            }`}
          >
            <span>{title}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
              {shows.length}
            </span>
            {titleInlineAction}
          </h2>
          {subtitle && (
            <span
              className={`text-xs text-zinc-400 inline ${
                onTitleClick ? 'group-hover/title:text-zinc-300 transition-colors' : ''
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
          {headerAction}
          {onTitleClick && shows.length > 0 && (
            <button
              type="button"
              onClick={onTitleClick}
              className="text-xs font-semibold text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <span>Explore All</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Row Content: Detailed Empty State OR Carousel */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!isLoading && shows.length === 0 && emptyState ? (
          <div className="relative rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-[#181818] via-zinc-900/60 to-zinc-950 p-5 sm:p-6 lg:p-7 overflow-hidden shadow-2xl backdrop-blur-sm">
            {/* Subtle glow decoration */}
            <div
              className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20 ${
                emptyState.type === 'continue-watching'
                  ? 'bg-amber-500'
                  : 'bg-red-600'
              }`}
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Column: Information, Guidance & Direct CTA */}
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm ${
                      emptyState.type === 'continue-watching'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-red-500/15 text-red-300 border-red-500/30'
                    }`}
                  >
                    {emptyState.type === 'continue-watching' ? (
                      <Tv className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-red-400" />
                    )}
                    {emptyState.badge || (emptyState.type === 'continue-watching' ? 'BINGE QUEUE EMPTY' : 'RECENT FEED EMPTY')}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">0 titles currently</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    {emptyState.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300/90 leading-relaxed font-normal">
                    {emptyState.description}
                  </p>
                </div>

                {emptyState.tipText && (
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
                    <span className="text-amber-400 shrink-0">💡</span>
                    <span>{emptyState.tipText}</span>
                  </p>
                )}

                {/* Direct Action Triggers */}
                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  {emptyState.onAction && (
                    <button
                      type="button"
                      onClick={emptyState.onAction}
                      className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-lg shadow-red-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{emptyState.actionLabel || 'Add Show'}</span>
                    </button>
                  )}

                  {emptyState.onSecondaryAction && emptyState.secondaryActionLabel && (
                    <button
                      type="button"
                      onClick={emptyState.onSecondaryAction}
                      className="inline-flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-zinc-700/60 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <Film className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{emptyState.secondaryActionLabel}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Visual Interactive Ghost / Placeholder Slots */}
              {emptyState.onAction && (
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={emptyState.onAction}
                    title="Add a new show to this shelf"
                    className="group/slot flex flex-col items-center justify-center w-40 sm:w-44 lg:w-48 aspect-video rounded-xl border-2 border-dashed border-zinc-700/70 hover:border-red-500/80 bg-zinc-900/50 hover:bg-zinc-850/80 transition-all duration-300 p-3 text-center cursor-pointer shadow-inner hover:scale-[1.02]"
                  >
                    <div className="w-9 h-9 rounded-full bg-zinc-800 group-hover/slot:bg-red-600/20 text-zinc-400 group-hover/slot:text-red-400 flex items-center justify-center mb-2 transition-all shadow-sm">
                      <Plus className="w-4 h-4 group-hover/slot:rotate-90 transition-transform duration-300" />
                    </div>
                    <span className="text-xs font-bold text-zinc-200 group-hover/slot:text-white transition-colors">
                      {emptyState.type === 'continue-watching' ? 'Add To Watch' : 'Add First Show'}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">
                      {emptyState.type === 'continue-watching' ? 'Track next season' : 'New movie or series'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={emptyState.onAction}
                    title="Add another show"
                    className="hidden md:flex group/slot flex-col items-center justify-center w-40 sm:w-44 lg:w-48 aspect-video rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/30 hover:bg-zinc-900/40 opacity-60 hover:opacity-100 transition-all duration-300 p-3 text-center cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-600 group-hover/slot:text-zinc-400 flex items-center justify-center mb-2">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-zinc-400">Queue Slot #2</span>
                    <span className="text-[9px] text-zinc-600 mt-0.5">Ready to track</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Left Arrow */}
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-20 bg-black/70 hover:bg-black/90 text-white rounded-r-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border-y border-r border-zinc-700/60 backdrop-blur-sm shadow-xl"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Scrollable Row */}
            <div
              ref={rowRef}
              className="flex items-start gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-3 px-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {isLoading && shows.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-44 sm:w-56 md:w-64 space-y-2">
                    <Skeleton className="aspect-[16/10] w-full rounded-md" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : (
                shows.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    onOpenDetails={onOpenDetails}
                    onIncrementEpisode={onIncrementEpisode}
                    onToggleStatus={onToggleStatus}
                    onHoverEnter={onHoverEnter}
                    onHoverLeave={onHoverLeave}
                    viewerColors={viewerColors}
                  />
                ))
              )}
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-20 bg-black/70 hover:bg-black/90 text-white rounded-l-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border-y border-l border-zinc-700/60 backdrop-blur-sm shadow-xl"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
