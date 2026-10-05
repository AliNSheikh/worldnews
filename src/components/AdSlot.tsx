import React from 'react';

interface AdSlotProps {
  placement: string;
  className?: string;
}

export const AdSlot: React.FC<AdSlotProps> = ({ placement, className = '' }) => (
  <aside
    className={`min-h-24 rounded-2xl border border-dashed border-slate-300 bg-white/80 flex items-center justify-center px-4 py-6 ${className}`}
    aria-label="Advertisement"
    data-ad-placement={placement}
  >
    <div className="text-center">
      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        Advertisement
      </span>
      <span className="mt-1 block text-xs text-slate-400">
        Reserved ad inventory · {placement}
      </span>
    </div>
  </aside>
);
