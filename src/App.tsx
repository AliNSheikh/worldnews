import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Article, Category, LanguageCode, NewsSource, SiteSettings, AutomationLog } from './types';
import { TRANSLATIONS } from './data/translations';
import {
  INITIAL_ARTICLES,
  INITIAL_CATEGORIES,
  INITIAL_NEWS_SOURCES,
  INITIAL_SITE_SETTINGS,
  INITIAL_AUTOMATION_LOGS,
} from './data/initialData';
import { Header } from './components/Header';
import { HeroSlider } from './components/HeroSlider';
import { PromoHeroSlider } from './components/PromoHeroSlider';
import { BreakingBar } from './components/BreakingBar';
import { ArticleCard } from './components/ArticleCard';
import { TrendingList } from './components/TrendingList';
import { ArticleView } from './components/ArticleView';
import { CategoryView } from './components/CategoryView';
import { Footer } from './components/Footer';
import { SearchModal } from './components/SearchModal';
import { EditorialCharterModal } from './components/EditorialCharterModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLoginGate } from './components/AdminLoginGate';
import { updatePageSEO } from './utils/seo';
import { analytics } from './utils/analytics';
import { ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';

export function App() {
  // Navigation & View States
  const [currentLang, setCurrentLang] = useState<LanguageCode>(() => {
    if (typeof window !== 'undefined') {
      const pathLang = window.location.pathname.split('/')[1] as LanguageCode;
      if (['ar', 'en', 'de', 'es', 'fr'].includes(pathLang)) return pathLang;
      const stored = localStorage.getItem('worldnews_lang') as LanguageCode;
      if (['ar', 'en', 'de', 'es', 'fr'].includes(stored)) return stored;
    }
    return 'en';
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCharterOpen, setIsCharterOpen] = useState(false);

  // Data Store States
  const [articles, setArticles] = useState<Article[]>(INITIAL_ARTICLES);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [sources, setSources] = useState<NewsSource[]>(INITIAL_NEWS_SOURCES);
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [logs, setLogs] = useState<AutomationLog[]>(INITIAL_AUTOMATION_LOGS);

  // Sync Language direction (RTL / LTR)
  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    if (typeof window !== 'undefined') {
      localStorage.setItem('worldnews_lang', currentLang);
    }
  }, [currentLang]);

  // Fetch live articles and settings from server
  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch {
      // Keep initial data if offline or dev startup
    }
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
    fetchArticles();
    fetchCategories();
    fetchSources();
    fetchSettings();
    fetchLogs();
  }, [fetchArticles, fetchCategories, fetchSources, fetchSettings, fetchLogs]);

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
      if (parts[0] && ['ar', 'en', 'de', 'es', 'fr'].includes(parts[0])) {
        setCurrentLang(parts[0] as LanguageCode);
        if (parts[1] === 'news' && parts[3]) {
          const slug = parts[3];
          const found = articles.find((a) =>
            Object.values(a.translations).some((t) => t.slug === slug)
          );
          if (found) {
            setActiveArticle(found);
            setSelectedCategory('all');
            setIsAdminOpen(false);
            return;
          }
        } else if (parts[1] === 'category' && parts[2]) {
          setSelectedCategory(parts[2]);
          setActiveArticle(null);
          setIsAdminOpen(false);
          return;
        }
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
          title: settings.names[currentLang] || 'World News',
          description: settings.descriptions[currentLang] || '24/7 International Digital Newsroom',
          lang: currentLang,
          canonicalPath: `/${currentLang}`,
          siteSettings: settings,
        });
      } else {
        const catObj = categories.find((c) => c.slug === selectedCategory);
        updatePageSEO({
          title: `${catObj?.names[currentLang] || selectedCategory} News`,
          description: catObj?.descriptions[currentLang] || `Latest reports in ${selectedCategory}`,
          lang: currentLang,
          canonicalPath: `/${currentLang}/category/${selectedCategory}`,
          category: catObj,
          siteSettings: settings,
        });
      }
    }
  }, [activeArticle, isAdminOpen, selectedCategory, currentLang, settings, categories]);

  // User Actions
  const handleLanguageChange = (lang: LanguageCode) => {
    const from = currentLang;
    setCurrentLang(lang);
    analytics.trackLanguageChange(from, lang);

    if (activeArticle) {
      const trans = activeArticle.translations[lang] || activeArticle.translations.en;
      window.history.pushState({}, '', `/${lang}/news/${activeArticle.category}/${trans.slug}`);
    } else if (selectedCategory !== 'all') {
      window.history.pushState({}, '', `/${lang}/category/${selectedCategory}`);
    } else {
      window.history.pushState({}, '', `/${lang}`);
    }
  };

  const handleSelectArticle = (article: Article) => {
    setActiveArticle(article);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const trans = article.translations[currentLang] || article.translations.en;
    window.history.pushState({}, '', `/${currentLang}/news/${article.category}/${trans.slug}`);
  };

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setActiveArticle(null);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (slug === 'all') {
      window.history.pushState({}, '', `/${currentLang}`);
    } else {
      window.history.pushState({}, '', `/${currentLang}/category/${slug}`);
    }
  };

  const handleHomeClick = () => {
    setActiveArticle(null);
    setSelectedCategory('all');
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.pushState({}, '', `/${currentLang}`);
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
          window.history.pushState({}, '', '/');
        }}
        onRefreshArticles={fetchArticles}
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
          />
        ) : (
          /* FRONT PAGE (HOMEPAGE) */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-12">
            {/* Manual promotional slider takes precedence; latest articles are the fallback. */}
            {settings.heroSlides?.some((slide) => slide.isActive && slide.mediaUrl) ? (
              <PromoHeroSlider slides={settings.heroSlides} />
            ) : heroArticles.length > 0 ? (
              <section id="hero-slider-section">
                <HeroSlider
                  articles={heroArticles}
                  currentLang={currentLang}
                  onSelectArticle={handleSelectArticle}
                  onSelectCategory={handleSelectCategory}
                />
              </section>
            ) : null}

            {/* Lead Grid Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Primary Lead Story & Secondary leads */}
              <div className="lg:col-span-8 space-y-8">
                {leadArticles.primary && (
                  <ArticleCard
                    article={leadArticles.primary}
                    currentLang={currentLang}
                    variant="lead"
                    onSelect={handleSelectArticle}
                    onSelectCategory={handleSelectCategory}
                  />
                )}

                {/* Secondary Stories Row */}
                <div className="grid grid-cols-2 gap-3.5 sm:gap-6">
                  {leadArticles.secondary1 && (
                    <ArticleCard
                      article={leadArticles.secondary1}
                      currentLang={currentLang}
                      variant="secondary"
                      onSelect={handleSelectArticle}
                      onSelectCategory={handleSelectCategory}
                    />
                  )}
                  {leadArticles.secondary2 && (
                    <ArticleCard
                      article={leadArticles.secondary2}
                      currentLang={currentLang}
                      variant="secondary"
                      onSelect={handleSelectArticle}
                      onSelectCategory={handleSelectCategory}
                    />
                  )}
                </div>
              </div>

              {/* Sidebar: Trending & Editorial Standards */}
              <aside className="lg:col-span-4 space-y-6">
                <TrendingList
                  articles={publishedArticles}
                  currentLang={currentLang}
                  onSelect={handleSelectArticle}
                />

                {/* Editorial Charter callout banner */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm tracking-tight">
                      {t.editorialGuidelines}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Transparent reporting standards. Learn how World News distinguishes original journalism, AI assistance, and verified wire attribution.
                  </p>
                  <button
                    onClick={() => setIsCharterOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    <span>{t.readEditorialCharter}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>
              </aside>
            </section>

            {/* In-depth Category Showcases */}
            {categories
              .filter((c) => c.isVisible && ['world', 'economy', 'technology', 'climate'].includes(c.slug))
              .map((cat) => {
                const catArticles = publishedArticles.filter((a) => a.category === cat.slug);
                if (catArticles.length === 0) return null;

                return (
                  <section key={cat.id} className="pt-8 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-sky-700 rounded-sm"></span>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                          {cat.names[currentLang] || cat.slug}
                        </h2>
                      </div>
                      <button
                        onClick={() => handleSelectCategory(cat.slug)}
                        className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{t.seeAll}</span>
                        <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5 lg:gap-6">
                      {catArticles.slice(0, 3).map((art) => (
                        <ArticleCard
                          key={art.id}
                          article={art}
                          currentLang={currentLang}
                          variant="standard"
                          onSelect={handleSelectArticle}
                          onSelectCategory={handleSelectCategory}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
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
