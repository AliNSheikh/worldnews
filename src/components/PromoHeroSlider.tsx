import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { HeroSlide } from '../types';

interface PromoHeroSliderProps {
  slides: HeroSlide[];
}

export const PromoHeroSlider: React.FC<PromoHeroSliderProps> = ({ slides }) => {
  const activeSlides = useMemo(() => slides.filter((slide) => slide.isActive && slide.mediaUrl), [slides]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % activeSlides.length), 7000);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  useEffect(() => {
    if (index >= activeSlides.length) setIndex(0);
  }, [activeSlides.length, index]);

  if (!activeSlides.length) return null;

  const slide = activeSlides[index] || activeSlides[0];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 shadow-2xl border border-slate-800 min-h-[420px] md:min-h-[520px]">
      {slide.mediaType === 'video' ? (
        <video
          src={slide.mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <img src={slide.mediaUrl} alt={slide.headline} className="absolute inset-0 w-full h-full object-cover" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20" />
      <div className="relative z-10 min-h-[420px] md:min-h-[520px] flex items-end p-6 sm:p-10 md:p-14">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex items-center rounded-full bg-sky-500/15 border border-sky-400/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
            Featured
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
            {slide.headline}
          </h1>
          {slide.buttonLabel && slide.buttonUrl && (
            <a
              href={slide.buttonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-sky-50 transition-colors"
            >
              {slide.buttonLabel}
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((value) => (value - 1 + activeSlides.length) % activeSlides.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-slate-950/70 text-white border border-white/15 flex items-center justify-center"
            aria-label="Previous hero slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((value) => (value + 1) % activeSlides.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-slate-950/70 text-white border border-white/15 flex items-center justify-center"
            aria-label="Next hero slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </section>
  );
};
