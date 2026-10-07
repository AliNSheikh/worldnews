import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { Article, Category, EditorialType, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { ArticleCard } from './ArticleCard';

interface CategoryViewProps {
  categorySlug: string;
  categories: Category[];
  articles: Article[];
  currentLang: LanguageCode;
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (slug: string) => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  categorySlug,
  categories,
  articles,
  currentLang,
  onSelectArticle,
  onSelectCategory,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [filterType, setFilterType] = useState<EditorialType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const currentCategory = categories.find((c) => c.slug === categorySlug);
  const categoryName = currentCategory?.names[currentLang] || categorySlug;
  const categoryDesc = currentCategory?.descriptions[currentLang] || `Comprehensive international coverage on ${categorySlug}.`;

  const filteredArticles = useMemo(() => {
    let list = articles.filter((a) => a.category === categorySlug && a.status === 'published');

    if (filterType !== 'all') {
      list = list.filter((a) => a.editorialType === filterType);
    }

    if (sortBy === 'popular') {
      list.sort((a, b) => b.views - a.views);
    } else {
      list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }

    return list;
  }, [articles, categorySlug, filterType, sortBy]);

  useEffect(() => {
    setVisibleCount(12);
  }, [categorySlug, filterType, sortBy]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= filteredArticles.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + 12, filteredArticles.length));
      }
    }, { rootMargin: '300px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, filteredArticles.length]);

  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const leadArticle = visibleArticles[0];
  const gridArticles = visibleArticles.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Category Hero Header */}
      <div className="border-b border-slate-200 pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-sky-700 uppercase tracking-widest block mb-1">
              {t.categories}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {categoryName}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl">
              {categoryDesc}
            </p>
          </div>

          {/* Filtering & Sorting Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by editorial type */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 ms-1" />
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.all}
              </button>
              <button
                onClick={() => setFilterType('original')}
                className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  filterType === 'original' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.originalReporting}
              </button>
              <button
                onClick={() => setFilterType('ai-assisted')}
                className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  filterType === 'ai-assisted' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.aiAssisted}
              </button>
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 ms-1" />
              <button
                onClick={() => setSortBy('latest')}
                className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  sortBy === 'latest' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.latest}
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  sortBy === 'popular' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.mostRead}
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredArticles.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-slate-500 font-medium">No published articles found in this category.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Lead Article if available */}
          {leadArticle && (
            <div>
              <ArticleCard
                article={leadArticle}
                currentLang={currentLang}
                variant="lead"
                onSelect={onSelectArticle}
                onSelectCategory={onSelectCategory}
              />
            </div>
          )}

          {/* Grid of Remaining Articles */}
          {gridArticles.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
              {gridArticles.map((art) => (
                <ArticleCard
                  key={art.id}
                  article={art}
                  currentLang={currentLang}
                  variant="standard"
                  onSelect={onSelectArticle}
                  onSelectCategory={onSelectCategory}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {visibleCount < filteredArticles.length && (
        <div ref={loadMoreRef} className="py-8 flex items-center justify-center" aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-sky-600 animate-spin" />
            Loading more {categoryName} stories…
          </div>
        </div>
      )}
    </div>
  );
};
