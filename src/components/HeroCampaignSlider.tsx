import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import { Article, HeroSlide, LanguageCode } from '../types';
import { HeroSlider } from './HeroSlider';

interface HeroCampaignSliderProps {
  slides?: HeroSlide[];
  articles: Article[];
  currentLang: LanguageCode;
  onSelectArticle: (article: Article) => void;
  onSelectCategory?: (slug: string) => void;
}

export const HeroCampaignSlider: React.FC<HeroCampaignSliderProps> = ({
  slides = [],
  articles,
  currentLang,
  onSelectArticle,
  onSelectCategory,
}) => {
  const activeSlides = useMemo(
    () => slides.filter((slide) => slide.isActive && slide.mediaUrl.trim()).sort((a, b) => a.sortOrder - b.sortOrder),
    [slides]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % activeSlides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [activeSlides.length]);

  useEffect(() => {
    if (index >= activeSlides.length) setIndex(0);
  }, [activeSlides.length, index]);

  if (!activeSlides.length) {
    return (
      <HeroSlider
        articles={articles}
        currentLang={currentLang}
        onSelectArticle={onSelectArticle}
        onSelectCategory={onSelectCategory}
      />
    );
  }

  const slide = activeSlides[index] || activeSlides[0];

  const previous = () =>
    setIndex((value) => (value === 0 ? activeSlides.length - 1 : value - 1));
  const next = () =>
    setIndex((value) => (value + 1) % activeSlides.length);

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-slate-950 min-h-[420px] sm:min-h-[500px] shadow-xl border border-slate-900"
      aria-label="Featured promotion"
    >
      <div className="absolute inset-0">
        {slide.mediaType === 'video' ? (
          <video
            key={slide.id}
            src={slide.mediaUrl}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            key={slide.id}
            src={slide.mediaUrl}
            alt={slide.headline}
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[420px] sm:min-h-[500px] items-end p-6 sm:p-10 lg:p-12">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
            <PlayCircle className="h-3.5 w-3.5" />
            Featured
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white drop-shadow">
            {slide.headline}
          </h1>
          {slide.buttonText && slide.buttonUrl && (
            <a
              href={slide.buttonUrl}
              className="inline-flex items-center justify-center rounded-md bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-white"
            >
              {slide.buttonText}
            </a>
          )}
        </div>
      </div>

      {activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={previous}
            aria-label="Previous promotion"
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2.5 text-white backdrop-blur transition hover:bg-black/65"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next promotion"
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2.5 text-white backdrop-blur transition hover:bg-black/65"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 right-5 z-20 flex gap-1.5">
            {activeSlides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(slideIndex)}
                aria-label={`Open promotion ${slideIndex + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  slideIndex === index ? 'w-8 bg-red-500' : 'w-3 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
