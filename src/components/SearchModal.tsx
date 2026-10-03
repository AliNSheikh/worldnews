import React, { useState, useEffect } from 'react';
import { Search, X, Calendar, ArrowRight } from 'lucide-react';
import { Article, Category, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { analytics } from '../utils/analytics';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  categories: Category[];
  currentLang: LanguageCode;
  onSelectArticle: (article: Article) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  articles,
  categories,
  currentLang,
  onSelectArticle,
}) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter articles based on query and category
  const results = articles.filter((article) => {
    if (article.status !== 'published') return false;
    if (selectedCategory !== 'all' && article.category !== selectedCategory) return false;

    if (!query.trim()) return true;

    const q = query.toLowerCase();
    const trans = article.translations[currentLang] || article.translations.en;

    const titleMatch = trans.title.toLowerCase().includes(q);
    const summaryMatch = trans.executiveSummary.toLowerCase().includes(q);
    const bylineMatch = article.byline.toLowerCase().includes(q);
    const tagsMatch = trans.keywords?.some((k) => k.toLowerCase().includes(q));

    return titleMatch || summaryMatch || bylineMatch || tagsMatch;
  });

  // Track search query after debounce
  useEffect(() => {
    if (query.trim().length > 2) {
      const timer = setTimeout(() => {
        analytics.trackSearch(query.trim(), results.length, currentLang);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [query, results.length, currentLang]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            id="global-search-input"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full text-base sm:text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Pills Filter */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-sky-700 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t.all}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.slug)}
              className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 cursor-pointer ${
                selectedCategory === c.slug
                  ? 'bg-sky-700 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {c.names[currentLang] || c.slug}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {t.searchResults}: {results.length}
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {t.noArticlesFound}
            </div>
          ) : (
            results.map((article) => {
              const trans = article.translations[currentLang] || article.translations.en;
              return (
                <div
                  key={article.id}
                  id={`search-result-${article.id}`}
                  onClick={() => {
                    onSelectArticle(article);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all cursor-pointer group flex items-start gap-3"
                >
                  <div className="w-16 h-14 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                    <img
                      src={article.image}
                      alt={trans.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        {article.category}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(article.publishedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-1">
                      {trans.title}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {trans.executiveSummary}
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 shrink-0 mt-2 rtl:rotate-180" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
