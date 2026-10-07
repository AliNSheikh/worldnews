import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { Article, Category, HeroSlide, LanguageCode } from '../types';
import { ArticleCard } from './ArticleCard';
import { TrendingList } from './TrendingList';
import { PromotionalHero } from './PromotionalHero';
import { AdSlot } from './AdSlot';
import { getArticleTranslation } from '../utils/articleTranslation';

interface NewsDiscoverHomeProps {
  articles: Article[];
  categories: Category[];
  currentLang: LanguageCode;
  promotionalSlides: HeroSlide[];
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (slug: string) => void;
}

function diversifyByCategory(articles: Article[]): Article[] {
  const queues = new Map<string, Article[]>();
  for (const article of articles) {
    const queue = queues.get(article.category) || [];
    queue.push(article);
    queues.set(article.category, queue);
  }
  const result: Article[] = [];
  while (result.length < articles.length) {
    let added = false;
    for (const queue of queues.values()) {
      const article = queue.shift();
      if (article) {
        result.push(article);
        added = true;
      }
    }
    if (!added) break;
  }
  return result;
}

function sectionLabel(lang: LanguageCode, key: 'main' | 'latest' | 'more' | 'mostRead') {
  const labels = {
    main: {
      ar: 'القصة الرئيسية',
      en: 'Top Story',
      de: 'Top-Thema',
      es: 'Historia principal',
      fr: 'À la une',
    },
    latest: {
      ar: 'آخر الأخبار',
      en: 'Latest News',
      de: 'Neueste Nachrichten',
      es: 'Últimas noticias',
      fr: 'Dernières nouvelles',
    },
    more: {
      ar: 'المزيد من الأخبار',
      en: 'More News',
      de: 'Mehr Nachrichten',
      es: 'Más noticias',
      fr: 'Plus d’actualités',
    },
    mostRead: {
      ar: 'الأكثر قراءة',
      en: 'Most Read',
      de: 'Meistgelesen',
      es: 'Más leído',
      fr: 'Les plus lus',
    },
  } as const;
  return labels[key][lang] || labels[key].en;
}

function relativeTime(date: string, lang: LanguageCode) {
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.max(0, Math.floor(ms / 3600000));
  if (hours < 1) return lang === 'ar' ? 'منذ أقل من ساعة' : 'Less than an hour ago';
  if (hours < 24) return lang === 'ar' ? `قبل ${hours} ساعة` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'ar' ? `قبل ${days} يوم` : `${days}d ago`;
}

export const NewsDiscoverHome: React.FC<NewsDiscoverHomeProps> = ({
  articles,
  categories,
  currentLang,
  promotionalSlides,
  onSelectArticle,
  onSelectCategory,
}) => {
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    const newest = [...articles]
      .filter((article) => article.status === 'published')
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 50);
    return diversifyByCategory(newest);
  }, [articles]);

  useEffect(() => {
    setVisibleCount(Math.min(12, Math.max(sorted.length, 1)));
  }, [sorted.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= sorted.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + 10, sorted.length, 50));
      }
    }, { rootMargin: '300px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, sorted.length]);

  const visibleArticles = sorted.slice(0, visibleCount);
  const main = visibleArticles[0];
  const supporting = visibleArticles.slice(1, 5);
  const latest = visibleArticles.slice(5, 21);
  const mobileMore = visibleArticles.slice(21, 45);

  return (
    <div className="max-w-[1440px] mx-auto px-2.5 sm:px-5 lg:px-7 py-3 sm:py-6 space-y-6 sm:space-y-9">
      {promotionalSlides.length > 0 && (
        <section>
          <PromotionalHero slides={promotionalSlides} currentLang={currentLang} />
        </section>
      )}

      {main && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-red-600 pb-2">
            <span className="w-1.5 h-5 bg-red-600" />
            <h2 className="font-black text-lg sm:text-xl text-slate-950">
              {sectionLabel(currentLang, 'main')}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4">
            <article
              onClick={() => onSelectArticle(main)}
              className="lg:col-span-7 group relative min-h-[245px] sm:min-h-[420px] overflow-hidden bg-slate-950 cursor-pointer"
            >
              <img
                src={main.image}
                alt={getArticleTranslation(main, currentLang).imageAlt || getArticleTranslation(main, currentLang).title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                loading="eager"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 text-white">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCategory(main.category);
                  }}
                  className="text-[11px] sm:text-xs font-bold bg-red-600 px-2 py-1 mb-2"
                >
                  {main.category}
                </button>
                <h1 className="font-black text-xl sm:text-3xl lg:text-4xl leading-tight max-w-3xl">
                  {getArticleTranslation(main, currentLang).title}
                </h1>
                <p className="hidden sm:block mt-2 text-sm text-slate-200 line-clamp-2 max-w-2xl">
                  {getArticleTranslation(main, currentLang).executiveSummary || main.originalDescription}
                </p>
                <div className="flex items-center gap-1.5 mt-3 text-[11px] sm:text-xs text-slate-300">
                  <Clock className="w-3.5 h-3.5" />
                  {relativeTime(main.publishedAt, currentLang)}
                </div>
              </div>
            </article>

            <div className="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3">
              {supporting.map((article) => (
                <article
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  className="group bg-white border-b border-slate-200 pb-3 cursor-pointer grid grid-cols-1 lg:grid-cols-[150px_1fr] gap-2.5 lg:gap-3"
                >
                  <div className="aspect-[16/10] lg:aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={article.image}
                      alt={getArticleTranslation(article, currentLang).title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wide text-red-600 mb-1">
                      {article.category}
                    </div>
                    <h3 className="font-extrabold text-xs sm:text-sm lg:text-base leading-snug text-slate-950 group-hover:text-sky-700 line-clamp-3">
                      {getArticleTranslation(article, currentLang).title}
                    </h3>
                    <div className="mt-1.5 text-[10px] text-slate-400">
                      {relativeTime(article.publishedAt, currentLang)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <AdSlot placement="homepage-after-hero" />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
            <h2 className="font-black text-lg sm:text-xl text-slate-950">
              {sectionLabel(currentLang, 'latest')}
            </h2>
            <span className="text-[10px] sm:text-xs text-slate-400">
              {Math.min(sorted.length, 50)} stories
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:block sm:divide-y sm:divide-slate-200 bg-white sm:border-y sm:border-slate-200">
            {latest.map((article) => (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 sm:gap-3 pb-3 sm:py-3 cursor-pointer group border-b border-slate-200 sm:border-0"
              >
                <div className="aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-slate-100">
                  <img
                    src={article.image}
                    alt={getArticleTranslation(article, currentLang).title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0 pe-2">
                  <div className="text-[10px] font-bold text-red-600 mb-1 uppercase tracking-wide">
                    {article.category}
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-lg leading-snug text-slate-950 group-hover:text-sky-700 line-clamp-2">
                    {getArticleTranslation(article, currentLang).title}
                  </h3>
                  <p className="hidden sm:block mt-1.5 text-xs text-slate-500 line-clamp-2">
                    {getArticleTranslation(article, currentLang).executiveSummary || article.originalDescription}
                  </p>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1.5">
                    {relativeTime(article.publishedAt, currentLang)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-5">
          <div>
            <div className="flex items-center gap-2 border-b-2 border-red-600 pb-2 mb-3">
              <TrendingUp className="w-4 h-4 text-red-600" />
              <h2 className="font-black text-base text-slate-950">
                {sectionLabel(currentLang, 'mostRead')}
              </h2>
            </div>
            <TrendingList
              articles={visibleArticles}
              currentLang={currentLang}
              onSelect={onSelectArticle}
            />
          </div>
          <AdSlot placement="homepage-mid-feed" />
        </aside>
      </section>

      {mobileMore.length > 0 && (
        <section className="lg:hidden">
          <div className="border-b-2 border-slate-900 pb-2 mb-3">
            <h2 className="font-black text-lg text-slate-950">
              {sectionLabel(currentLang, 'more')}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {mobileMore.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                currentLang={currentLang}
                variant="standard"
                onSelect={onSelectArticle}
                onSelectCategory={onSelectCategory}
              />
            ))}
          </div>
        </section>
      )}

      {categories
        .filter((category) => category.isVisible)
        .slice(0, 8)
        .map((category) => {
          const categoryArticles = visibleArticles
            .filter((article) => article.category === category.slug)
            .slice(0, 7);
          if (!categoryArticles.length) return null;

          return (
            <section key={category.id} className="pt-3 border-t border-slate-300">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <button
                  onClick={() => onSelectCategory(category.slug)}
                  className="font-black text-lg sm:text-xl text-slate-950 hover:text-sky-700"
                >
                  {category.names[currentLang] || category.slug}
                </button>
                <button
                  onClick={() => onSelectCategory(category.slug)}
                  className="text-xs font-bold text-red-600 hover:text-red-700"
                >
                  {currentLang === 'ar' ? 'المزيد' : 'View all'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <ArticleCard
                    article={categoryArticles[0]}
                    currentLang={currentLang}
                    variant="secondary"
                    onSelect={onSelectArticle}
                    onSelectCategory={onSelectCategory}
                  />
                </div>
                <div className="md:col-span-6 grid grid-cols-2 gap-2 sm:gap-3">
                  {categoryArticles.slice(1).map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      currentLang={currentLang}
                      variant="horizontal"
                      onSelect={onSelectArticle}
                      onSelectCategory={onSelectCategory}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
    </div>
  );
};
