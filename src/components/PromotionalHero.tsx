import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from 'lucide-react';
import { HeroSlide, LanguageCode } from '../types';

interface PromotionalHeroProps {
  slides: HeroSlide[];
  currentLang: LanguageCode;
}

function localized(
  value: Partial<Record<LanguageCode, string>> | undefined,
  lang: LanguageCode,
  fallback = ''
): string {
  return value?.[lang] || value?.en || Object.values(value || {}).find(Boolean) || fallback;
}

export const PromotionalHero: React.FC<PromotionalHeroProps> = ({ slides, currentLang }) => {
  const ordered = useMemo(
    () => [...slides].filter((slide) => slide.enabled && slide.mediaUrl).sort((a, b) => a.sortOrder - b.sortOrder),
    [slides]
  );
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (index >= ordered.length) setIndex(0);
  }, [index, ordered.length]);

  useEffect(() => {
    if (!playing || ordered.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ordered.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [playing, ordered.length]);

  if (ordered.length === 0) return null;

  const slide = ordered[index];
  const headline = localized(slide.headline, currentLang, 'Featured');
  const buttonLabel = localized(slide.buttonLabel, currentLang, 'Learn more');

  const openLink = () => {
    if (!slide.buttonUrl) return;
    window.open(slide.buttonUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 shadow-xl min-h-[360px] sm:min-h-[460px] border border-slate-800">
      <div className="absolute inset-0">
        {slide.mediaType === 'video' ? (
          <video
            key={slide.mediaUrl}
            src={slide.mediaUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={slide.mediaUrl}
            alt={headline}
            className="w-full h-full object-cover"
            loading="eager"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
      </div>

      <div className="relative z-10 min-h-[360px] sm:min-h-[460px] flex flex-col justify-end p-6 sm:p-10">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white backdrop-blur">
            Featured
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-white">
            {headline}
          </h1>
          {slide.buttonUrl && (
            <button
              type="button"
              onClick={openLink}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition"
            >
              <span>{buttonLabel}</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {ordered.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous featured slide"
            onClick={() => setIndex((current) => (current - 1 + ordered.length) % ordered.length)}
            className="absolute z-20 left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-slate-950/70 text-white border border-white/15 flex items-center justify-center hover:bg-slate-900"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next featured slide"
            onClick={() => setIndex((current) => (current + 1) % ordered.length)}
            className="absolute z-20 right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-slate-950/70 text-white border border-white/15 flex items-center justify-center hover:bg-slate-900"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label={playing ? 'Pause featured slider' : 'Play featured slider'}
            onClick={() => setPlaying((value) => !value)}
            className="absolute z-20 right-4 top-4 h-9 w-9 rounded-full bg-slate-950/70 text-white border border-white/15 flex items-center justify-center hover:bg-slate-900"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </>
      )}
    </section>
  );
};
