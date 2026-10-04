import { Sparkles } from 'lucide-react';

export default function Badge() {
  return (
    <span
      className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white border border-red-400 shadow-lg shadow-black/80 shrink-0 flex items-center gap-1 animate-pulse pointer-events-auto"
      style={{ backgroundColor: '#E50914', color: '#ffffff', borderColor: '#ff4d4d' }}
      title="New show added within the last 7 days"
    >
      <Sparkles className="w-2.5 h-2.5 text-yellow-300 shrink-0" />
      <span>NEW</span>
    </span>
  );
}
