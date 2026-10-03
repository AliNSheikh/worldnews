import React from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Article, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface BreakingBarProps {
  articles: Article[];
  currentLang: LanguageCode;
  onSelectArticle: (article: Article) => void;
}

export const BreakingBar: React.FC<BreakingBarProps> = ({ articles, currentLang, onSelectArticle }) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const breakingArticles = articles.filter((a) => a.isBreaking && a.status === 'published');

  if (breakingArticles.length === 0) return null;

  const currentBreaking = breakingArticles[0];
  const trans = currentBreaking.translations[currentLang] || currentBreaking.translations.en;

  return (
    <div className="bg-red-700 text-white text-xs sm:text-sm py-2 px-4 shadow-inner">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <span className="bg-white text-red-700 font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            {t.breakingNews}
          </span>
          <button
            id={`breaking-article-${currentBreaking.id}`}
            onClick={() => onSelectArticle(currentBreaking)}
            className="font-medium hover:underline truncate text-start cursor-pointer text-white"
          >
            {trans.title}
          </button>
        </div>

        <button
          onClick={() => onSelectArticle(currentBreaking)}
          className="shrink-0 flex items-center gap-1 bg-red-800 hover:bg-red-900 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer"
        >
          <span>{t.readMore}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
};
