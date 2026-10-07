import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Article, Category, LanguageCode, NewsSource, SiteSettings, AutomationLog } from './types';
import { TRANSLATIONS } from './data/translations';
import {
  INITIAL_CATEGORIES,
  INITIAL_NEWS_SOURCES,
  INITIAL_SITE_SETTINGS,
  INITIAL_AUTOMATION_LOGS,
} from './data/initialData';
import { Header } from './components/Header';
import { BreakingBar } from './components/BreakingBar';
import { ArticleView } from './components/ArticleView';
import { CategoryView } from './components/CategoryView';
import { Footer } from './components/Footer';
import { SearchModal } from './components/SearchModal';
import { EditorialCharterModal } from './components/EditorialCharterModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLoginGate } from './components/AdminLoginGate';
import { updatePageSEO } from './utils/seo';
import { analytics } from './utils/analytics';
import { getArticleTranslation } from './utils/articleTranslation';
import { NewsDiscoverHome } from './components/NewsDiscoverHome';

export function App() {
  // Navigation & View States — English is the only public edition.
  const [currentLang] = useState<LanguageCode>('en');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCharterOpen, setIsCharterOpen] = useState(false);

  // Data Store States
  const [articles, setArticles] = useState<Article[]>([]);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [isLoadingMoreArticles, setIsLoadingMoreArticles] = useState(false);
  const [publicHasMore, setPublicHasMore] = useState(true);
  const publicOffsetRef = useRef(0);
  const publicHasMoreRef = useRef(true);
  const publicLoadingRef = useRef(false);
  const publicContextRef = useRef('all');
  const PUBLIC_PAGE_SIZE = 10;
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [sources, setSources] = useState<NewsSource[]>(INITIAL_NEWS_SOURCES);
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [logs, setLogs] = useState<AutomationLog[]>(INITIAL_AUTOMATION_LOGS);

  // English-only document metadata.
  useEffect(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    if (typeof window !== 'undefined') localStorage.removeItem('worldnews_lang');
  }, []);

  // Fetch live articles in small pages so the browser does not download 50 full
  // article bodies on first paint. Public feeds stop at 50 loaded stories.
  const fetchPublicArticles = useCallback(async (category = 'all', reset = false) => {
    if (publicLoadingRef.current) return;
    if (!reset && !publicHasMoreRef.current) return;

    const offset = reset ? 0 : publicOffsetRef.current;
    const remaining = 50 - offset;
    if (remaining <= 0) {
      publicHasMoreRef.current = false;
      setPublicHasMore(false);
      return;
    }

    const limit = Math.min(PUBLIC_PAGE_SIZE, remaining);
    publicLoadingRef.current = true;
    publicContextRef.current = category;
    if (reset) setIsArticlesLoading(true);
    else setIsLoadingMoreArticles(true);

    try {
      const params = new URLSearchParams({
        status: 'published',
        limit: String(limit),
        offset: String(offset),
      });
      if (category !== 'all') params.set('category', category);

      const res = await fetch(`/api/articles?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = res.ok ? await res.json() : [];
      const page: Article[] = Array.isArray(data) ? data : [];

      setArticles((current) => {
        if (reset) return page;
        const map = new Map(current.map((article) => [article.id, article]));
        page.forEach((article) => map.set(article.id, article));
        return [...map.values()];
      });

      publicOffsetRef.current = offset + page.length;
      const hasMore = page.length === limit && publicOffsetRef.current < 50;
      publicHasMoreRef.current = hasMore;
      setPublicHasMore(hasMore);
    } catch {
      if (reset) setArticles([]);
      publicHasMoreRef.current = false;
      setPublicHasMore(false);
    } finally {
      publicLoadingRef.current = false;
      setIsArticlesLoading(false);
      setIsLoadingMoreArticles(false);
    }
  }, []);

  const fetchAllArticlesForAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/articles?limit=500&offset=0', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {}
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch {}
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchPublicArticles('all', true);
    fetchCategories();
    fetchSources();
    fetchSettings();
    fetchLogs();
  }, [fetchPublicArticles, fetchCategories, fetchSources, fetchSettings, fetchLogs]);

  useEffect(() => {
    if (isAdminAuthenticated) fetchAllArticlesForAdmin();
  }, [isAdminAuthenticated, fetchAllArticlesForAdmin]);

  // Initialize Google Analytics when measurement ID is configured
  useEffect(() => {
    if (settings.googleAnalyticsMeasurementId) {
      analytics.initGoogleAnalytics(settings.googleAnalyticsMeasurementId);
    }
  }, [settings.googleAnalyticsMeasurementId]);

  // Handle URL parsing on load & browser history. Direct article URLs are resolved
  // from Appwrite even when the article is older than the currently loaded feed page.
  useEffect(() => {
    const handleUrlChange = async () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        setIsAdminOpen(true);
        setActiveArticle(null);
        return;
      }

      const parts = path.split('/').filter(Boolean);
      if (parts[0] && ['ar', 'de', 'es', 'fr'].includes(parts[0])) {
        parts[0] = 'en';
        window.history.replaceState({}, '', '/' + parts.join('/'));
      }

      if (parts[0] === 'en' && parts[1] === 'news' && parts[3]) {
        const slug = parts[3];
        const found = articles.find((article) => article.translations?.en?.slug === slug);
        if (found) {
          setActiveArticle(found);
          setSelectedCategory('all');
          setIsAdminOpen(false);
          return;
        }
        try {
          const response = await fetch(`/api/articles/${encodeURIComponent(slug)}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (response.ok) {
            const article = await response.json();
            setArticles((current) =>
              current.some((item) => item.id === article.id) ? current : [...current, article]
            );
            setActiveArticle(article);
            setSelectedCategory('all');
            setIsAdminOpen(false);
          }
        } catch {}
        return;
      }

      if (parts[0] === 'en' && parts[1] === 'category' && parts[2]) {
        const category = parts[2];
        setSelectedCategory(category);
        setActiveArticle(null);
        setIsAdminOpen(false);
        if (publicContextRef.current !== category) {
          fetchPublicArticles(category, true);
        }
        return;
      }

      setSelectedCategory('all');
      setActiveArticle(null);
      if (publicContextRef.current !== 'all') fetchPublicArticles('all', true);
    };

    window.addEventListener('popstate', handleUrlChange);
    handleUrlChange();
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [articles, fetchPublicArticles]);

  // Keyboard shortcut: Cmd+K / Ctrl+K opens search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update SEO for Home page or Category page
  useEffect(() => {
    if (!activeArticle && !isAdminOpen) {
      if (selectedCategory === 'all') {
        updatePageSEO({
          title: settings.names[currentLang] || 'News Discover',
          description: settings.descriptions[currentLang] || '24/7 International Digital Newsroom',
          lang: currentLang,
          canonicalPath: `/${currentLang}`,
          siteSettings: settings,
        });
      } else {
        const catObj = categories.find((c) => c.slug === selectedCategory);
        updatePageSEO({
          title: catObj?.seoTitle || `${catObj?.names.en || selectedCategory} News`,
          description: catObj?.seoDescription || catObj?.descriptions.en || `Latest reports in ${selectedCategory}`,
          lang: currentLang,
          canonicalPath: `/${currentLang}/category/${selectedCategory}`,
          category: catObj,
          siteSettings: settings,
        });
      }
    }
  }, [activeArticle, isAdminOpen, selectedCategory, currentLang, settings, categories]);

  // User Actions
  const handleLanguageChange = (_lang: LanguageCode) => {
    // English is the only public edition.
  };

  const handleSelectArticle = (article: Article) => {
    setActiveArticle(article);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const trans = getArticleTranslation(article, 'en');
    window.history.pushState({}, '', `/en/news/${article.category}/${trans.slug}`);
  };

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setActiveArticle(null);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (slug === 'all') {
      window.history.pushState({}, '', '/en');
      fetchPublicArticles('all', true);
    } else {
      window.history.pushState({}, '', `/en/category/${slug}`);
      fetchPublicArticles(slug, true);
    }
  };

  const handleHomeClick = () => {
    setActiveArticle(null);
    setSelectedCategory('all');
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.pushState({}, '', '/en');
    fetchPublicArticles('all', true);
  };

  const handleLoadMoreArticles = () => {
    fetchPublicArticles(selectedCategory, false);
  };

  const handleUpdateSettings = async (newSettings: Partial<SiteSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Settings update error:', err);
    }
  };

  // Published articles
  const publishedArticles = useMemo(() => {
    return articles.filter((a) => a.status === 'published');
  }, [articles]);

  // Lead stories calculation
  const leadArticles = useMemo(() => {
    const pinned = publishedArticles.filter((a) => a.isPinned);
    const nonPinned = publishedArticles.filter((a) => !a.isPinned);
    const sorted = [...pinned, ...nonPinned];
    return {
      primary: sorted[0],
      secondary1: sorted[1],
      secondary2: sorted[2],
      feed: sorted.slice(3),
    };
  }, [publishedArticles]);

  // Hero Slider: 3 most recently published articles
  const heroArticles = useMemo(() => {
    return [...publishedArticles]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 3);
  }, [publishedArticles]);

  const promotionalHeroSlides = useMemo(
    () => (settings.heroSlides || []).filter((slide) => slide.enabled && slide.mediaUrl),
    [settings.heroSlides]
  );

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // Render CMS newsroom view (protected by AdminLoginGate)
  if (isAdminOpen) {
    if (!isAdminAuthenticated) {
      return (
        <AdminLoginGate
          currentLang={currentLang}
          onAuthenticated={() => setIsAdminAuthenticated(true)}
          onReturnToSite={() => {
            setIsAdminOpen(false);
            window.history.pushState({}, '', '/');
          }}
        />
      );
    }

    return (
      <AdminDashboard
        articles={articles}
        categories={categories}
        sources={sources}
        settings={settings}
        logs={logs}
        currentLang={currentLang}
        onClose={() => {
          setIsAdminOpen(false);
          setIsAdminAuthenticated(false);
          setSelectedCategory('all');
          window.history.pushState({}, '', '/en');
          fetchPublicArticles('all', true);
        }}
        onRefreshArticles={fetchAllArticlesForAdmin}
        onRefreshSources={fetchSources}
        onRefreshCategories={fetchCategories}
        onRefreshLogs={fetchLogs}
        onUpdateSettings={handleUpdateSettings}
        onSelectArticle={handleSelectArticle}
      />
    );
  }

  if (isArticlesLoading && !isAdminOpen && articles.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-700">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin" />
          <div className="text-sm font-bold">Loading the latest News Discover stories…</div>
          <div className="text-xs text-slate-400">Fetching fresh articles from the database</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Sticky Header with Language Switcher */}
      <Header
        currentLang={currentLang}
        onLanguageChange={handleLanguageChange}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        categories={categories}
        siteSettings={settings}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenCharter={() => setIsCharterOpen(true)}
        onHomeClick={handleHomeClick}
      />

      {/* Breaking News alert banner */}
      <BreakingBar
        articles={publishedArticles}
        currentLang={currentLang}
        onSelectArticle={handleSelectArticle}
      />

      {/* Body View Container */}
      <main className="flex-1">
        {activeArticle ? (
          /* ARTICLE DETAIL VIEW */
          <ArticleView
            article={activeArticle}
            currentLang={currentLang}
            onLanguageChange={handleLanguageChange}
            allArticles={publishedArticles}
            categories={categories}
            siteSettings={settings}
            onBackToHome={handleHomeClick}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
            onOpenCharter={() => setIsCharterOpen(true)}
          />
        ) : selectedCategory !== 'all' ? (
          /* DEDICATED CATEGORY VIEW */
          <CategoryView
            categorySlug={selectedCategory}
            categories={categories}
            articles={publishedArticles}
            currentLang={currentLang}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
            hasMore={publicHasMore}
            isLoadingMore={isLoadingMoreArticles}
            onLoadMore={handleLoadMoreArticles}
          />
        ) : (
          /* FRONT PAGE (HOMEPAGE) */
          <NewsDiscoverHome
            articles={publishedArticles}
            categories={categories}
            currentLang={currentLang}
            promotionalSlides={promotionalHeroSlides}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
            hasMore={publicHasMore}
            isLoadingMore={isLoadingMoreArticles}
            onLoadMore={handleLoadMoreArticles}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        currentLang={currentLang}
        onLanguageChange={handleLanguageChange}
        categories={categories}
        siteSettings={settings}
        onSelectCategory={handleSelectCategory}
        onOpenCharter={() => setIsCharterOpen(true)}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        articles={publishedArticles}
        categories={categories}
        currentLang={currentLang}
        onSelectArticle={handleSelectArticle}
      />

      {/* Editorial Charter Modal */}
      <EditorialCharterModal
        isOpen={isCharterOpen}
        onClose={() => setIsCharterOpen(false)}
        currentLang={currentLang}
      />
    </div>
  );
}
export default App;
