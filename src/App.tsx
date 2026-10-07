import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Article, Category, LanguageCode, NewsSource, SiteSettings, AutomationLog } from './types';
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
import { getArticleTranslation, hasCompleteTranslation } from './utils/articleTranslation';
import { NewsDiscoverHome } from './components/NewsDiscoverHome';

export function App() {
  // Navigation & View States
  const currentLang: LanguageCode = 'en';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCharterOpen, setIsCharterOpen] = useState(false);

  // Data Store States
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingMoreArticles, setIsLoadingMoreArticles] = useState(false);
  const [hasMoreArticles, setHasMoreArticles] = useState(true);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [sources, setSources] = useState<NewsSource[]>(INITIAL_NEWS_SOURCES);
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [logs, setLogs] = useState<AutomationLog[]>(INITIAL_AUTOMATION_LOGS);

  // English is the single public edition.
  useEffect(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    localStorage.removeItem('worldnews_lang');
  }, []);

  // Fetch live articles and settings from server
  const fetchArticles = useCallback(async () => {
    setIsLoadingArticles(true);
    try {
      const res = await fetch('/api/articles?status=published&limit=12&offset=0', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const firstPage = Array.isArray(data) ? data : [];
        setArticles(firstPage);
        setHasMoreArticles(firstPage.length === 12);
      } else {
        setArticles([]);
        setHasMoreArticles(false);
      }
    } catch {
      setArticles([]);
      setHasMoreArticles(false);
    } finally {
      setIsLoadingArticles(false);
    }
  }, []);

  const loadMoreArticles = useCallback(async () => {
    if (isLoadingArticles || isLoadingMoreArticles || !hasMoreArticles || articles.length >= 50) return;
    setIsLoadingMoreArticles(true);
    try {
      const remaining = 50 - articles.length;
      const limit = Math.min(10, remaining);
      const res = await fetch(
        `/api/articles?status=published&limit=${limit}&offset=${articles.length}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        setHasMoreArticles(false);
        return;
      }
      const data = await res.json();
      const page: Article[] = Array.isArray(data) ? data : [];
      setArticles((current) => {
        const seen = new Set(current.map((article) => article.id));
        const merged = [...current, ...page.filter((article) => !seen.has(article.id))];
        return merged.slice(0, 50);
      });
      setHasMoreArticles(page.length === limit && articles.length + page.length < 50);
    } catch {
      setHasMoreArticles(false);
    } finally {
      setIsLoadingMoreArticles(false);
    }
  }, [articles.length, hasMoreArticles, isLoadingArticles, isLoadingMoreArticles]);

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
    fetchArticles();
    fetchCategories();
    fetchSources();
    fetchSettings();
    fetchLogs();
  }, [fetchArticles, fetchCategories, fetchSources, fetchSettings, fetchLogs]);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 900;
      if (nearBottom) loadMoreArticles();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMoreArticles]);


  // Initialize Google Analytics when measurement ID is configured
  useEffect(() => {
    if (settings.googleAnalyticsMeasurementId) {
      analytics.initGoogleAnalytics(settings.googleAnalyticsMeasurementId);
    }
  }, [settings.googleAnalyticsMeasurementId]);

  // Handle URL parsing on load & browser history
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        setIsAdminOpen(true);
        setActiveArticle(null);
        return;
      }
      const parts = path.split('/').filter(Boolean);
      // Preserve old /en/* links by normalizing them to the English-only routes.
      const normalized = parts[0] === 'en' ? parts.slice(1) : parts;
      if (normalized[0] === 'news' && normalized[2]) {
        const slug = normalized[2];
        const found = articles.find((a) => a.translations.en?.slug === slug);
        if (found) {
          setActiveArticle(found);
          setSelectedCategory('all');
          setIsAdminOpen(false);
          return;
        }
      } else if (normalized[0] === 'category' && normalized[1]) {
        setSelectedCategory(normalized[1]);
        setActiveArticle(null);
        setIsAdminOpen(false);
        return;
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    handleUrlChange();
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [articles]);

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
          title: settings.names.en || 'News Discover',
          description: settings.descriptions.en || '24/7 International Digital Newsroom',
          lang: 'en',
          canonicalPath: '/',
          siteSettings: settings,
        });
      } else {
        const catObj = categories.find((c) => c.slug === selectedCategory);
        updatePageSEO({
          title: catObj?.seoTitle || `${catObj?.names.en || selectedCategory} News`,
          description: catObj?.seoDescription || catObj?.descriptions.en || `Latest reports in ${selectedCategory}`,
          lang: 'en',
          canonicalPath: `/category/${selectedCategory}`,
          category: catObj,
          siteSettings: settings,
        });
      }
    }
  }, [activeArticle, isAdminOpen, selectedCategory, currentLang, settings, categories]);

  // User Actions
  const handleLanguageChange = (_lang: LanguageCode) => {
    // Multi-language navigation is intentionally disabled. English is the only edition.
  };

  const handleSelectArticle = (article: Article) => {
    setActiveArticle(article);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const trans = article.translations.en || getArticleTranslation(article, 'en');
    window.history.pushState({}, '', `/news/${article.category}/${trans.slug}`);
  };

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setActiveArticle(null);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (slug === 'all') {
      window.history.pushState({}, '', '/');
    } else {
      window.history.pushState({}, '', `/category/${slug}`);
    }
  };

  const handleHomeClick = () => {
    setActiveArticle(null);
    setSelectedCategory('all');
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.pushState({}, '', '/');
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
          window.history.pushState({}, '', '/');
        }}
        onRefreshArticles={fetchArticles}
        onRefreshCategories={fetchCategories}
        onRefreshSources={fetchSources}
        onRefreshLogs={fetchLogs}
        onUpdateSettings={handleUpdateSettings}
        onSelectArticle={handleSelectArticle}
      />
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
        {isLoadingArticles ? (
          <div className="min-h-[55vh] flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3 text-slate-600" role="status" aria-live="polite">
              <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin" />
              <p className="text-sm font-semibold">Loading the latest articles…</p>
            </div>
          </div>
        ) : activeArticle ? (
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
          />
        )}
        {!isLoadingArticles && isLoadingMoreArticles && (
          <div className="py-5 flex items-center justify-center text-xs font-semibold text-slate-500">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-red-600 animate-spin me-2" />
            Loading more articles…
          </div>
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
