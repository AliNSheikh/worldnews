import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar, Sparkles, Flame, Play, Pause } from 'lucide-react';
import { Article, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface HeroSliderProps {
  articles: Article[];
  currentLang: LanguageCode;
  onSelectArticle: (article: Article) => void;
  onSelectCategory?: (slug: string) => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  articles,
  currentLang,
  onSelectArticle,
  onSelectCategory,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // Take the 3 most recently added articles
  const slides = articles.slice(0, 3);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance slider every 6 seconds
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, slides.length]);

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex] || slides[0];
  const trans = currentSlide.translations[currentLang] || currentSlide.translations.en;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const wordCount = (trans.structuredBody || '' + trans.executiveSummary || '').split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div
      id="hero-slider"
      className="relative w-full rounded-2xl overflow-hidden shadow-xl bg-slate-950 border border-slate-800/80 mb-10 group"
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Latest Top Stories Slider"
    >
      {/* Slide Image Background with Smooth Fade */}
      <div
        className="relative h-[380px] sm:h-[440px] md:h-[500px] w-full cursor-pointer overflow-hidden"
        onClick={() => onSelectArticle(currentSlide)}
      >
        <img
          key={currentSlide.id}
          src={currentSlide.image}
          alt={trans.imageAlt || trans.title}
          className="w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover:scale-105 filter brightness-90"
        />

        {/* Ambient Dark Gradient Layer for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/20" />
        <div className="absolute inset-0 bg-radial from-transparent to-slate-950/50" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="px-3 py-1 text-xs font-black tracking-wider uppercase bg-sky-600 text-white rounded-md shadow-md flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {t.trendingTopic || 'Latest Dispatch'}
            </span>

            {currentSlide.isBreaking && (
              <span className="px-2.5 py-1 text-xs font-black tracking-wider uppercase bg-red-600 text-white rounded-md shadow-md flex items-center gap-1 animate-pulse">
                <Flame className="w-3.5 h-3.5" />
                {t.breakingNews}
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectCategory) onSelectCategory(currentSlide.category);
              }}
              className="px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-slate-900/90 hover:bg-slate-800 text-sky-300 rounded-md border border-slate-700 backdrop-blur-xs transition-colors cursor-pointer"
            >
              {currentSlide.category}
            </button>
          </div>

          {/* Slide Counter & Play/Pause */}
          <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700 text-xs font-semibold text-slate-300">
            <span>
              {currentIndex + 1} / {slides.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(!isPlaying);
              }}
              className="hover:text-white transition-colors cursor-pointer p-0.5"
              aria-label={isPlaying ? 'Pause slider' : 'Play slider'}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Content Box at Bottom of Slide */}
        <div className="absolute bottom-0 inset-x-0 p-5 sm:p-8 md:p-10 z-10 flex flex-col justify-end text-start">
          <div className="max-w-3xl space-y-3">
            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300 font-medium">
              <span className="text-sky-400 font-semibold">World News</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(currentSlide.publishedAt)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {readingTime} {t.minRead}
              </span>
            </div>

            {/* Slide Title */}
            <h2 className="text-xl sm:text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight sm:leading-snug drop-shadow-md hover:text-sky-300 transition-colors">
              {trans.title}
            </h2>

            {/* Executive Summary Teaser */}
            <p className="text-xs sm:text-sm md:text-base text-slate-300 line-clamp-2 leading-relaxed max-w-2xl drop-shadow-sm">
              {trans.executiveSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Arrow Controls */}
      <button
        id="hero-slider-prev"
        onClick={handlePrev}
        aria-label="Previous slide"
        className="absolute top-1/2 -translate-y-1/2 left-3 sm:left-4 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-sky-600 text-white border border-slate-700/80 backdrop-blur-md flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 hover:scale-105 cursor-pointer shadow-lg"
      >
        <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
      </button>

      <button
        id="hero-slider-next"
        onClick={handleNext}
        aria-label="Next slide"
        className="absolute top-1/2 -translate-y-1/2 right-3 sm:right-4 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-sky-600 text-white border border-slate-700/80 backdrop-blur-md flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 hover:scale-105 cursor-pointer shadow-lg"
      >
        <ChevronRight className="w-5 h-5 rtl:rotate-180" />
      </button>

      {/* Dot Indicators */}
      <div className="absolute bottom-3 right-4 sm:right-8 z-20 flex items-center gap-1.5 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            aria-label={`Go to slide ${idx + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              idx === currentIndex
                ? 'w-6 h-2 bg-sky-500'
                : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
