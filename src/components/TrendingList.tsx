import React from 'react';
import { TrendingUp, Flame } from 'lucide-react';
import { Article, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface TrendingListProps {
  articles: Article[];
  currentLang: LanguageCode;
  onSelect: (article: Article) => void;
}

export const TrendingList: React.FC<TrendingListProps> = ({ articles, currentLang, onSelect }) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // Sort by views descending
  const trending = [...articles]
    .filter((a) => a.status === 'published')
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <TrendingUp className="w-5 h-5 text-red-600" />
        <h3 className="font-extrabold text-base text-slate-900 tracking-tight uppercase">
          {t.trending}
        </h3>
        <Flame className="w-4 h-4 text-amber-500 ms-auto animate-pulse" />
      </div>

      <div className="divide-y divide-slate-100">
        {trending.map((article, idx) => {
          const trans = article.translations[currentLang] || article.translations.en;
          return (
            <div
              key={article.id}
              id={`trending-item-${article.id}`}
              onClick={() => onSelect(article)}
              className="py-3 group cursor-pointer flex items-start gap-3 transition-colors hover:bg-slate-50/80 -mx-2 px-2 rounded"
            >
              <span className="font-serif text-2xl font-black text-slate-300 group-hover:text-sky-600 transition-colors w-6 shrink-0 text-center">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block mb-0.5">
                  {article.category}
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-2 leading-snug">
                  {trans.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="font-mono">{article.views.toLocaleString()} {t.views}</span>
                  <span>•</span>
                  <span>{article.originalSource}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
