import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, RefreshCw, Sparkles, AlertCircle, Eye, Tv, ArrowRight, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { ShowItem } from '../types';

interface DecisionWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistShows: ShowItem[];
  onOpenDetails: (show: ShowItem) => void;
  onMarkAsWatching?: (show: ShowItem) => void;
}

const WHEEL_COLORS = [
  '#E50914', // Red
  '#FF9900', // Orange
  '#10B981', // Emerald Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

export default function DecisionWheelModal({
  isOpen,
  onClose,
  wishlistShows,
  onOpenDetails,
  onMarkAsWatching,
}: DecisionWheelModalProps) {
  // Filter out shows without titles
  const validShows = wishlistShows.filter(s => s.title);
  
  // Step state: 'pool' (selection list) -> 'wheel' (spin wheel)
  const [activeStep, setActiveStep] = useState<'pool' | 'wheel'>('pool');
  const [selectedPool, setSelectedPool] = useState<Record<string, boolean>>({});
  const [currentRotation, setCurrentRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<ShowItem | null>(null);
  const [isTickActive, setIsTickActive] = useState(false);

  const wheelRef = useRef<SVGSVGElement | null>(null);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use a ref to track if we have initialized this open session
  const initializedRef = useRef(false);

  // Initialize pool with all valid shows when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!initializedRef.current) {
        const initialPool: Record<string, boolean> = {};
        validShows.forEach(show => {
          initialPool[show.id] = true;
        });
        setSelectedPool(initialPool);
        setWinner(null);
        setCurrentRotation(0);
        setIsSpinning(false);
        setActiveStep('pool');
        initializedRef.current = true;
      }
    } else {
      initializedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Active items for the wheel
  const activeItems = validShows.filter(show => selectedPool[show.id]);
  const numItems = activeItems.length;

  const handleToggleShow = (id: string) => {
    if (isSpinning) return;
    setSelectedPool(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      return updated;
    });
    setWinner(null);
  };

  const handleSelectAll = () => {
    if (isSpinning) return;
    const updated: Record<string, boolean> = {};
    validShows.forEach(show => {
      updated[show.id] = true;
    });
    setSelectedPool(updated);
    setWinner(null);
  };

  const handleDeselectAll = () => {
    if (isSpinning) return;
    setSelectedPool({});
    setWinner(null);
  };

  const handleSpin = () => {
    if (isSpinning || numItems < 2) return;

    setIsSpinning(true);
    setWinner(null);

    // Pick a random index
    const winnerIndex = Math.floor(Math.random() * numItems);
    const chosenShow = activeItems[winnerIndex];

    // Calculate rotation angle using cumulative rotation
    const sliceAngle = 360 / numItems;
    const targetOffset = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2);
    
    // Spin 8 full times for maximum cinematic suspense
    const extraSpins = 360 * 8; 

    const baseAngle = currentRotation - (currentRotation % 360);
    const nextRotation = baseAngle + extraSpins + targetOffset;

    setCurrentRotation(nextRotation);

    // Simulate pointer clicking ticks
    let ticks = 0;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      setIsTickActive(prev => !prev);
      ticks++;
      if (ticks > 25) {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      }
    }, 120);

    // Wait for animation to finish (4 seconds)
    setTimeout(() => {
      setIsSpinning(false);
      setWinner(chosenShow);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      
      // Celebrate with confetti!
      import('canvas-confetti').then((m) => {
        try {
          const confettiFn = m.default;
          if (typeof confettiFn === 'function') {
            confettiFn({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.5 },
              colors: ['#E50914', '#FF9900', '#10B981', '#3B82F6', '#EC4899']
            });
          }
        } catch (e) {
          console.warn('Confetti fail:', e);
        }
      }).catch((e) => {
        console.warn('Confetti load fail:', e);
      });
    }, 4000);
  };

  // Generate SVG slice path data
  const generateSlices = () => {
    if (numItems === 0) return [];

    return activeItems.map((item, index) => {
      const angleStep = 360 / numItems;
      const startAngle = index * angleStep;
      const endAngle = (index + 1) * angleStep;

      const rad1 = ((startAngle - 90) * Math.PI) / 180;
      const rad2 = ((endAngle - 90) * Math.PI) / 180;

      const r = 150;
      const cx = 150;
      const cy = 150;

      const x1 = cx + r * Math.cos(rad1);
      const y1 = cy + r * Math.sin(rad1);
      const x2 = cx + r * Math.cos(rad2);
      const y2 = cy + r * Math.sin(rad2);

      const largeArcFlag = angleStep > 180 ? 1 : 0;

      const pathData = `
        M ${cx} ${cy}
        L ${x1} ${y1}
        A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `;

      const midAngle = startAngle + angleStep / 2 - 90;
      const textRad = (midAngle * Math.PI) / 180;
      const textX = cx + (r * 0.58) * Math.cos(textRad);
      const textY = cy + (r * 0.58) * Math.sin(textRad);

      return {
        pathData,
        color: WHEEL_COLORS[index % WHEEL_COLORS.length],
        textX,
        textY,
        textAngle: midAngle + 90,
        title: item.title,
      };
    });
  };

  const slices = generateSlices();

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      id="decision-wheel-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-hidden"
      onClick={onClose}
    >
      <div
        id="decision-wheel-dialog"
        className="relative w-full max-w-xl bg-[#141414] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col max-h-[95dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0 shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>🎰 ShowFlix Decision Wheel</span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                {activeStep === 'pool'
                  ? 'Step 1: Choose titles for your spin pool'
                  : 'Step 2: Spin the wheel to pick what to watch!'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:border-white text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: SPIN POOL SELECTION LIST */}
        {activeStep === 'pool' && (
          <div className="p-4 sm:p-6 flex flex-col flex-1 min-h-0 space-y-4 animate-in fade-in duration-150 overflow-hidden">
            <div className="flex items-center justify-between gap-2 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-white">
                  Spin Pool Titles ({numItems}/{validShows.length} selected)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Scrollable Checklist */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 max-h-[360px] sm:max-h-[420px]">
              {validShows.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 space-y-2">
                  <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs">No Wishlist titles found to include in the wheel.</p>
                </div>
              ) : (
                validShows.map((show) => {
                  const isChecked = Boolean(selectedPool[show.id]);
                  return (
                    <div
                      key={`pool-item-${show.id}`}
                      onClick={() => handleToggleShow(show.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-zinc-900/90 border-zinc-700 text-white shadow-sm'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {show.posterUrl && (
                          <img
                            src={show.posterUrl}
                            alt=""
                            className="w-7 h-10 rounded object-cover shrink-0"
                          />
                        )}
                        <span className="font-semibold truncate">{show.title}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 border transition-all ${
                          isChecked
                            ? 'bg-red-600 border-red-500 text-white font-bold shadow'
                            : 'border-zinc-700 bg-zinc-900'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Action Button to Proceed to Wheel */}
            <div className="pt-2 border-t border-zinc-800 shrink-0">
              <button
                type="button"
                disabled={numItems < 2}
                onClick={() => setActiveStep('wheel')}
                className="w-full bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm py-3 px-4 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider hover:scale-[1.01] active:scale-95"
              >
                <span>{numItems < 2 ? 'Select at least 2 titles to spin' : `Ready — Go to Spin Wheel (${numItems} Titles)`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SPIN WHEEL DISPLAY */}
        {activeStep === 'wheel' && (
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center flex-1 select-none animate-in fade-in duration-150 overflow-hidden relative">
            <div className="w-full flex items-center justify-between pb-2 mb-2">
              <button
                type="button"
                onClick={() => setActiveStep('pool')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Adjust Selection Pool ({numItems} Selected)</span>
              </button>
            </div>

            {/* Wheel Canvas Container */}
            <div className="relative flex flex-col items-center justify-center my-auto py-2">
              {/* Outer Glow Ring */}
              <div className="absolute inset-x-0 top-2 bottom-2 mx-auto w-[270px] h-[270px] sm:w-[316px] sm:h-[316px] rounded-full bg-gradient-to-tr from-red-600/10 via-amber-500/10 to-transparent blur-md pointer-events-none" />

              {/* Selector Pointer Arrow (Pointing Down at Top Center) */}
              <div 
                className={`absolute top-0 z-30 transform -translate-y-1 transition-transform duration-75 ${
                  isTickActive ? 'rotate-12 scale-110 text-amber-400' : 'rotate-0 text-red-500'
                }`}
              >
                <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-current drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white absolute top-[-18px] left-[-5px] shadow" />
              </div>

              {/* Svg Wheel Canvas */}
              <div className="relative w-[260px] h-[260px] sm:w-[310px] sm:h-[310px] bg-zinc-900 border-8 border-zinc-800 rounded-full shadow-2xl overflow-hidden">
                {numItems >= 2 ? (
                  <svg
                    ref={wheelRef}
                    viewBox="0 0 300 300"
                    className="w-full h-full transform"
                    style={{
                      transform: `rotate(${currentRotation}deg)`,
                      transitionDuration: isSpinning ? '4000ms' : '0ms',
                      transitionTimingFunction: 'cubic-bezier(0.15, 0.85, 0.35, 1)',
                      transitionProperty: 'transform',
                    }}
                  >
                    {slices.map((slice, idx) => (
                      <g key={idx} className="cursor-default">
                        <path
                          d={slice.pathData}
                          fill={slice.color}
                          stroke="#141414"
                          strokeWidth="3"
                          className="hover:opacity-95 transition-opacity"
                        />
                        <text
                          x={slice.textX}
                          y={slice.textY}
                          fill="#ffffff"
                          fontSize={numItems > 8 ? "9px" : "10px"}
                          fontWeight="900"
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          transform={`rotate(${slice.textAngle}, ${slice.textX}, ${slice.textY})`}
                          className="font-sans tracking-wide drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] select-none pointer-events-none uppercase"
                        >
                          {slice.title.length > 11 ? slice.title.slice(0, 9) + '..' : slice.title}
                        </text>
                      </g>
                    ))}
                    
                    <circle cx="150" cy="150" r="16" fill="#18181b" stroke="#3f3f46" strokeWidth="2.5" />
                    <circle cx="150" cy="150" r="6" fill="#ffffff" />
                  </svg>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                    <AlertCircle className="w-10 h-10 text-zinc-600 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider block mb-1">Insufficient Pool</span>
                    <span className="text-[10px] leading-relaxed text-zinc-500">Add or toggle at least 2 shows on the list to spin the wheel!</span>
                  </div>
                )}
              </div>

              {/* Spinner Button */}
              <div className="mt-5 relative z-20">
                <button
                  type="button"
                  disabled={isSpinning || numItems < 2}
                  onClick={handleSpin}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed text-white font-extrabold text-xs sm:text-sm tracking-wider uppercase px-8 py-3 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 border border-red-500/20"
                >
                  <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>{isSpinning ? 'SPINNING...' : 'SPIN THE WHEEL!'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- WINNER POPUP OVERLAY DIRECTLY OVER THE SCREEN FOR EASY MOBILE VIEWING --- */}
        {winner && (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-center animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="relative w-full max-w-sm bg-[#181818] border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-2.5 overflow-hidden my-auto max-h-[92dvh] flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setWinner(null)}
                className="absolute top-3 right-3 p-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-md"
                title="Close overlay"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative pt-1">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-500 mx-auto animate-bounce shadow-lg">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase block">THE WHEEL DECIDED!</span>
                <h3 className="text-base sm:text-lg font-black text-white px-1 leading-tight line-clamp-2">
                  {winner.title}
                </h3>
                {winner.platform && (
                  <span className="inline-block text-[10px] text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full mt-0.5 font-bold">
                    {winner.platform}
                  </span>
                )}
              </div>

              {winner.posterUrl && (
                <div className="w-20 h-28 sm:w-22 sm:h-32 rounded-lg overflow-hidden shadow-lg border border-zinc-800 mx-auto shrink-0">
                  <img
                    src={winner.posterUrl}
                    alt={winner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {winner.notes && (
                <p className="text-[10px] text-zinc-400 line-clamp-2 bg-zinc-900/80 px-2.5 py-1.5 rounded-lg border border-zinc-800 max-w-xs mx-auto leading-relaxed italic">
                  "{winner.notes}"
                </p>
              )}

              <div className="flex flex-col gap-1.5 w-full pt-1">
                {onMarkAsWatching && (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAsWatching(winner);
                      onClose();
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs py-2 rounded-xl cursor-pointer transition-all shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5 hover:scale-102 active:scale-95"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Mark as Watching</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onOpenDetails(winner);
                    onClose();
                  }}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs py-2 rounded-xl cursor-pointer transition-all shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5 border border-zinc-700 hover:scale-102 active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5 text-zinc-300" />
                  <span>View Details & Info</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWinner(null);
                    handleSpin();
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs py-2 rounded-xl cursor-pointer transition-all shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5 hover:scale-102 active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Spin Again!</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWinner(null);
                    setActiveStep('pool');
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs py-1.5 rounded-xl cursor-pointer transition-all"
                >
                  Adjust Selection Pool
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
