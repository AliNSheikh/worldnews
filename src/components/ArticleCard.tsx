import React from 'react';
import { Clock, Globe, Play, Video } from 'lucide-react';
import { Article, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { getArticleTranslation } from '../utils/articleTranslation';

interface ArticleCardProps {
  article: Article;
  currentLang: LanguageCode;
  variant?: 'lead' | 'secondary' | 'standard' | 'compact' | 'horizontal';
  onSelect: (article: Article) => void;
  onSelectCategory?: (slug: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  currentLang,
  variant = 'standard',
  onSelect,
  onSelectCategory,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const trans = getArticleTranslation(article, currentLang);

  // Use video screenshot or reliable lead image
  const displayImage =
    article.image ||
    article.images?.[0]?.url ||
    article.videoThumbnail ||
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80';

  const hasVideoReport = article.hasVideo || !!article.videoUrl || !!article.videoIframeUrl;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  // 1. LEAD HERO VARIANT
  if (variant === 'lead') {
    return (
      <article
        id={`article-lead-${article.id}`}
        className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col lg:flex-row"
      >
        <div className="lg:w-7/12 relative aspect-16/10 sm:aspect-16/9 lg:aspect-auto overflow-hidden bg-slate-900 cursor-pointer" onClick={() => onSelect(article)}>
          <img
            src={displayImage}
            alt={trans.imageAlt || trans.title}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
            loading="eager"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';
            }}
          />
          {hasVideoReport && (
            <div className="absolute top-3 end-3 z-10 flex items-center gap-1.5 bg-red-600/95 text-white font-bold text-xs uppercase px-2.5 py-1 rounded-md shadow-md backdrop-blur-xs">
              <Play className="w-3 h-3 fill-current" />
              <span>Video</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent lg:hidden" />
          <div className="absolute bottom-2 start-2 end-2 text-[11px] text-slate-300 flex justify-between items-center px-2 py-1 bg-slate-950/60 backdrop-blur-xs rounded">
            <span className="truncate">{article.imageCredit}</span>
            <span className="shrink-0 ms-2 font-mono text-[10px]">{article.imageLicense}</span>
          </div>
        </div>

        <div className="lg:w-5/12 p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {onSelectCategory ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCategory(article.category);
                  }}
                  className="bg-slate-900 hover:bg-sky-700 text-white font-bold text-xs uppercase px-2.5 py-0.5 rounded tracking-wider transition-colors cursor-pointer"
                >
                  {article.category}
                </button>
              ) : (
                <span className="bg-slate-900 text-white font-bold text-xs uppercase px-2.5 py-0.5 rounded tracking-wider">
                  {article.category}
                </span>
              )}
              {hasVideoReport && (
                <span className="bg-red-50 text-red-700 border border-red-200 font-bold text-[11px] px-2 py-0.5 rounded flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  <span>Video Report</span>
                </span>
              )}
            </div>

            <h2
              onClick={() => onSelect(article)}
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 group-hover:text-sky-700 transition-colors cursor-pointer leading-tight"
            >
              {trans.title}
            </h2>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">
              {article.originalDescription || trans.executiveSummary}
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{article.byline}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(article.publishedAt)}
              </span>
            </div>

            <div>
              <button
                onClick={() => onSelect(article)}
                className="font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
              >
                {t.readFullStory} →
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // 2. SECONDARY LEAD VARIANT
  if (variant === 'secondary') {
    return (
      <article
        id={`article-secondary-${article.id}`}
        className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
      >
        <div>
          <div className="relative aspect-[4/3] sm:aspect-16/9 overflow-hidden bg-slate-900 cursor-pointer" onClick={() => onSelect(article)}>
            <img
              src={displayImage}
              alt={trans.imageAlt || trans.title}
              className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';
              }}
            />
            <div className="absolute top-2 start-2 flex gap-1">
              <span className="bg-slate-900/90 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded backdrop-blur-xs">
                {article.category}
              </span>
            </div>
            {hasVideoReport && (
              <div className="absolute top-2 end-2 flex items-center gap-1 bg-red-600/90 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded backdrop-blur-xs">
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Video</span>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[10px] sm:text-[11px] text-slate-400">{formatDate(article.publishedAt)}</span>
            </div>

            <h3
              onClick={() => onSelect(article)}
              className="font-bold text-xs sm:text-base md:text-lg text-slate-900 group-hover:text-sky-700 transition-colors cursor-pointer line-clamp-2 leading-snug"
            >
              {trans.title}
            </h3>

            <p className="text-slate-600 text-[11px] sm:text-xs md:text-sm line-clamp-2 leading-relaxed">
              {article.originalDescription || trans.executiveSummary}
            </p>
          </div>
        </div>

        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs text-slate-500">
          <span className="truncate max-w-[120px] sm:max-w-[150px] font-medium text-slate-700">{article.byline}</span>
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400">
              {Object.keys(article.translations).length} langs
            </span>
          </div>
        </div>
      </article>
    );
  }

  // 3. HORIZONTAL / COMPACT VARIANT
  if (variant === 'horizontal') {
    return (
      <article
        id={`article-horizontal-${article.id}`}
        onClick={() => onSelect(article)}
        className="group flex gap-4 p-3 bg-white border border-slate-200 rounded-lg hover:border-sky-300 hover:shadow-xs transition-all cursor-pointer"
      >
        <div className="w-24 sm:w-32 aspect-4/3 shrink-0 rounded overflow-hidden bg-slate-900 relative">
          <img
            src={displayImage}
            alt={trans.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';
            }}
          />
          {hasVideoReport && (
            <div className="absolute bottom-1 end-1 p-1 bg-red-600 text-white rounded-full">
              <Play className="w-2 h-2 fill-current" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                {article.category}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] text-slate-400">{formatDate(article.publishedAt)}</span>
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-2 leading-snug">
              {trans.title}
            </h4>
          </div>
        </div>
      </article>
    );
  }

  // 4. STANDARD CARD (Default Grid Item)
  return (
    <article
      id={`article-card-${article.id}`}
      className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
    >
      <div>
        <div
          className="relative aspect-16/9 overflow-hidden bg-slate-900 cursor-pointer"
          onClick={() => onSelect(article)}
        >
          <img
            src={displayImage}
            alt={trans.imageAlt || trans.title}
            className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';
            }}
          />
          <div className="absolute top-2 start-2">
            <span className="bg-slate-900/90 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded backdrop-blur-xs">
              {article.category}
            </span>
          </div>
          {hasVideoReport && (
            <div className="absolute top-2 end-2 flex items-center gap-1 bg-red-600/90 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded backdrop-blur-xs shadow-xs">
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Video</span>
            </div>
          )}
        </div>

        <div className="p-2.5 sm:p-4 space-y-1 sm:space-y-2.5">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-[10px] sm:text-[11px] text-slate-400">{formatDate(article.publishedAt)}</span>
          </div>

          <h3
            onClick={() => onSelect(article)}
            className="font-extrabold text-[11px] leading-[1.35] sm:text-sm md:text-base text-slate-900 group-hover:text-sky-700 transition-colors cursor-pointer line-clamp-2 leading-snug"
          >
            {trans.title}
          </h3>

          <p className="hidden sm:block text-slate-600 text-xs md:text-sm line-clamp-2 sm:line-clamp-3 leading-relaxed">
            {article.originalDescription || trans.executiveSummary}
          </p>
        </div>
      </div>

      <div className="hidden sm:flex p-3 sm:p-4 pt-1.5 sm:pt-2 border-t border-slate-100 items-center justify-between text-[11px] sm:text-xs text-slate-500">
        <span className="truncate max-w-[90px] sm:max-w-[140px] font-medium text-slate-700">{article.byline}</span>
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-400">
            {Object.keys(article.translations).length} langs
          </span>
        </div>
      </div>
    </article>
  );
};
