import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Rss,
  MessageSquare,
  Settings,
  Plus,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Trash2,
  Edit,
  Pin,
  Flame,
  Clock,
  RefreshCw,
  Zap,
  Radio,
  Layers,
  Check,
  ExternalLink,
  Link2,
  X,
} from 'lucide-react';
import { Article, Category, NewsSource, SiteSettings, AutomationLog, LanguageCode } from '../../types';
import { ArticleEditorModal } from './ArticleEditorModal';
import { RssSourcesPanel } from './RssSourcesPanel';
import { CommentModerationPanel } from './CommentModerationPanel';
import { NewsroomSettingsPanel } from './NewsroomSettingsPanel';

interface AdminDashboardProps {
  articles: Article[];
  categories: Category[];
  sources: NewsSource[];
  settings: SiteSettings;
  logs: AutomationLog[];
  currentLang: LanguageCode;
  onClose: () => void;
  onRefreshArticles: () => void;
  onRefreshSources: () => void;
  onRefreshCategories: () => void;
  onRefreshLogs: () => void;
  onUpdateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
  onSelectArticle: (article: Article) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  articles,
  categories,
  sources,
  settings,
  logs,
  currentLang,
  onClose,
  onRefreshArticles,
  onRefreshSources,
  onRefreshCategories,
  onRefreshLogs,
  onUpdateSettings,
  onSelectArticle,
}) => {
  const [activeTab, setActiveTab] = useState<
    'articles' | 'ai-draft' | 'crawler' | 'sources' | 'comments' | 'settings'
  >('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal editing state
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Quick Original Source Link Verification & Editor State
  const [sourceVerificationModal, setSourceVerificationModal] = useState<{
    article: Article;
    url: string;
    source: string;
  } | null>(null);
  const [isSavingSourceUrl, setIsSavingSourceUrl] = useState(false);
  const [sourceUrlSaveSuccess, setSourceUrlSaveSuccess] = useState(false);
  const [isResolvingSingleLink, setIsResolvingSingleLink] = useState(false);
  const [singleLinkResolutionNotice, setSingleLinkResolutionNotice] = useState<string | null>(null);
  const [isVerifyingAllLinks, setIsVerifyingAllLinks] = useState(false);
  const [verifyAllLinksMessage, setVerifyAllLinksMessage] = useState<string | null>(null);

  // Alternative Format Regeneration State
  const [selectedRegenFormat, setSelectedRegenFormat] = useState<
    'executive-brief' | 'investigative' | 'explainer-qa' | 'deep-analysis'
  >('executive-brief');
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [regenProgressMessage, setRegenProgressMessage] = useState<string | null>(null);
  const [regeneratingArticleId, setRegeneratingArticleId] = useState<string | null>(null);

  // Automated Hourly Crawler State
  const [crawlerStatus, setCrawlerStatus] = useState<any | null>(null);
  const [isCrawlerRunning, setIsCrawlerRunning] = useState(false);
  const [crawlerActionMessage, setCrawlerActionMessage] = useState<string | null>(null);

  // AI drafting studio state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategory, setAiCategory] = useState('world');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDraftResult, setAiDraftResult] = useState<any | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  const fetchCrawlerStatus = async () => {
    try {
      const res = await fetch('/api/crawler/status');
      if (res.ok) {
        const data = await res.json();
        setCrawlerStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch crawler status:', err);
    }
  };

  useEffect(() => {
    fetchCrawlerStatus();
    const interval = setInterval(fetchCrawlerStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRunCrawlerNow = async () => {
    setIsCrawlerRunning(true);
    setCrawlerActionMessage('Fetching unique English articles published during the last 60 minutes...');
    let total = 0;
    let cycles = 0;
    let hasMore = true;
    try {
      while (hasMore) {
        cycles += 1;
        const res = await fetch('/api/crawler/run-now?batch=30', { method: 'POST' });
        const raw = await res.text();
        let data: any = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { error: raw || `HTTP ${res.status}` };
        }
        if (!res.ok) {
          throw new Error(data.message || data.error || `Crawler failed with HTTP ${res.status}.`);
        }
        total += Number(data.newArticlesCount || data.count || 0);
        hasMore = Boolean(data.hasMore);
        setCrawlerActionMessage(
          `Batch ${cycles}: persisted ${data.count || 0} article(s). Total this manual run: ${total}.${hasMore ? ' Continuing automatically…' : ' Feed drain complete.'}`
        );
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      onRefreshArticles();
      onRefreshSources();
      onRefreshLogs();
      fetchCrawlerStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCrawlerActionMessage(`Crawl error after ${cycles} batch(es), ${total} persisted: ${msg}`);
    } finally {
      setIsCrawlerRunning(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (
      !confirm(
        `Are you sure you want to regenerate all ${articles.length} articles in the "${selectedRegenFormat}" format? Authentic original source links will be verified first and preserved across all 5 language editions.`
      )
    ) {
      return;
    }

    setIsRegeneratingAll(true);
    setRegenProgressMessage(`Verifying source links and regenerating all articles in "${selectedRegenFormat}" format...`);
    try {
      const res = await fetch('/api/articles/regenerate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: selectedRegenFormat }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegenProgressMessage(
          `Success! Verified source links (repaired: ${data.linksRepairedCount || 0}) and regenerated ${data.updatedCount} articles in "${selectedRegenFormat}" format.`
        );
        onRefreshArticles();
      } else {
        setRegenProgressMessage(`Notice: ${data.message || 'Regeneration complete.'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRegenProgressMessage(`Regeneration error: ${msg}`);
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  const handleRegenerateSingle = async (article: Article) => {
    setRegeneratingArticleId(article.id);
    try {
      const res = await fetch(`/api/articles/${article.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: selectedRegenFormat }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onRefreshArticles();
        const sourceInfo = data.verifiedSourceLink
          ? `\nVerified Source Link: ${data.verifiedSourceLink}`
          : '';
        alert(`Article "${article.id}" regenerated in "${selectedRegenFormat}" format!${sourceInfo}`);
      } else {
        alert(data.error || 'Failed to regenerate article.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setRegeneratingArticleId(null);
    }
  };

  const handleVerifyAllLinks = async () => {
    setIsVerifyingAllLinks(true);
    setVerifyAllLinksMessage('Verifying and retrieving authentic source links for all articles...');
    try {
      const res = await fetch('/api/articles/verify-all-source-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyAllLinksMessage(
          `Verification Complete: ${data.alreadyValidCount} valid, ${data.repairedCount} retrieved & updated with live authentic links.`
        );
        onRefreshArticles();
      } else {
        setVerifyAllLinksMessage(data.error || 'Failed to verify source links.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setVerifyAllLinksMessage(`Error verifying links: ${msg}`);
    } finally {
      setIsVerifyingAllLinks(false);
    }
  };

  // Filtered Articles
  const filteredArticles = articles.filter((art) => {
    if (categoryFilter !== 'all' && art.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && art.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        Object.values(art.translations).some(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.executiveSummary.toLowerCase().includes(q) ||
            t.structuredBody.toLowerCase().includes(q) ||
            t.metaDescription.toLowerCase().includes(q) ||
            (t.keywords || []).some((keyword) => keyword.toLowerCase().includes(q))
        ) ||
        art.byline.toLowerCase().includes(q) ||
        art.originalSource.toLowerCase().includes(q) ||
        art.originalUrl.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleSaveArticle = async (articleData: Partial<Article>) => {
    try {
      if (articleData.id) {
        // Update
        const res = await fetch(`/api/articles/${articleData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articleData),
        });
        if (!res.ok) throw new Error('Failed to update article');
      } else {
        // Create
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articleData),
        });
        if (!res.ok) throw new Error('Failed to create article');
      }
      onRefreshArticles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this article dispatch?')) return;
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (res.ok) onRefreshArticles();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const togglePin = async (art: Article) => {
    await handleSaveArticle({ id: art.id, isPinned: !art.isPinned });
  };

  const toggleBreaking = async (art: Article) => {
    await handleSaveArticle({ id: art.id, isBreaking: !art.isBreaking });
  };

  // AI Generation Studio Handler
  const handleGenerateAiReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    try {
      setAiGenerating(true);
      setAiStatusMessage(null);
      setAiDraftResult(null);

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          category: aiCategory,
          sourceName: 'News Discover Source Desk',
          sourceUrl: `https://newsdiscover.example/wire/${Date.now()}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }

      const draft = await res.json();
      setAiDraftResult(draft);
      setAiStatusMessage('Multilingual draft successfully structured across all 5 editions.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiStatusMessage(`Notice: ${msg}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const publishAiDraft = async () => {
    if (!aiDraftResult) return;
    try {
      const newArticle: Partial<Article> = {
        category: aiDraftResult.category,
        editorialType: 'ai-assisted',
        originalSource: aiDraftResult.originalSource,
        originalUrl: aiDraftResult.originalUrl,
        image: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=1200&q=80',
        imageCredit: 'World News Multilingual Wire Service',
        imageLicense: 'Editorial wire licensing',
        status: 'published',
        isBreaking: false,
        isPinned: true,
        priority: 5,
        views: 45,
        shares: 6,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        byline: 'World News Editorial Wire Desk & Staff Editors',
        translations: aiDraftResult.translations,
      };

      await handleSaveArticle(newArticle);
      setAiStatusMessage('Article successfully published to live editions!');
      setAiDraftResult(null);
      setAiPrompt('');
      setActiveTab('articles');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Publish error: ${msg}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Admin Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>Exit to Public News</span>
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-baseline gap-2">
              <span className="font-black text-lg tracking-tight text-white">WORLD NEWS</span>
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">
                CMS NEWSROOM
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingArticle(null);
                setIsEditorOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Article</span>
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'articles'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Articles ({articles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('crawler')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'crawler'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Automated Hourly Ingest</span>
            {crawlerStatus?.isCurrentlyRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sources'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Rss className="w-4 h-4 text-amber-400" />
            <span>RSS Wire Feeds ({sources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'comments'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Comments Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Governance & Feeds</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* TAB 1: ARTICLES LIST */}
        {activeTab === 'articles' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-sky-800/40 rounded-2xl p-5 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <Rss className="w-5 h-5 text-sky-400 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Source-direct publishing mode</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Automated imports no longer depend on Gemini. News Discover stores source-derived headline, article text, original image metadata, publication date, and automatically generated SEO title/description in Appwrite. Use the search box below to find any article, then edit or delete it directly.
                  </p>
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, body, SEO description, keywords, source or URL..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.names.en}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="review">Review</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>

                <button
                  id="verify-all-source-links-btn"
                  onClick={handleVerifyAllLinks}
                  disabled={isVerifyingAllLinks}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Verify all articles and automatically retrieve genuine, accessible source URLs"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 text-emerald-600 ${isVerifyingAllLinks ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingAllLinks ? 'Verifying Links...' : 'Verify All Source Links'}</span>
                </button>
              </div>
            </div>

            {verifyAllLinksMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{verifyAllLinksMessage}</span>
                </div>
                <button
                  onClick={() => setVerifyAllLinksMessage(null)}
                  className="text-emerald-600 hover:text-emerald-900 text-xs font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Articles Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4 text-start">Article Title & Category</th>
                      <th className="py-3 px-4 text-start">Original Source & Link</th>
                      <th className="py-3 px-4 text-start">Type</th>
                      <th className="py-3 px-4 text-start">Status</th>
                      <th className="py-3 px-4 text-start">Language</th>
                      <th className="py-3 px-4 text-start">Views</th>
                      <th className="py-3 px-4 text-start">Published</th>
                      <th className="py-3 px-4 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredArticles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No articles match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredArticles.map((art) => {
                        const enTitle = art.translations.en?.title || Object.values(art.translations)[0]?.title;
                        const transCount = art.translations.en?.title ? 1 : 0;

                        return (
                          <tr key={art.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 max-w-sm">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                                    {art.category}
                                  </span>
                                  {art.isBreaking && (
                                    <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                      Breaking
                                    </span>
                                  )}
                                  {art.isPinned && (
                                    <span className="bg-sky-100 text-sky-700 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                      Pinned
                                    </span>
                                  )}
                                </div>
                                <h4
                                  onClick={() => onSelectArticle(art)}
                                  className="font-bold text-slate-900 hover:text-sky-700 cursor-pointer line-clamp-1"
                                >
                                  {enTitle}
                                </h4>
                                <div className="flex items-center gap-2 pt-0.5">
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    {art.byline} • {art.originalSource}
                                  </span>
                                  {art.originalUrl && (
                                    <a
                                      href={art.originalUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200 shrink-0"
                                      title={`Verify against original cable: ${art.originalUrl}`}
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                      <span>Verify</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 min-w-[200px]">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[170px]" title={art.originalSource || 'Wire Feed'}>
                                    {art.originalSource || 'Wire Feed'}
                                  </span>
                                </div>

                                {art.originalUrl ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <a
                                      id={`source-btn-${art.id}`}
                                      href={art.originalUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors shadow-2xs group cursor-pointer"
                                      title={`Click to open original article in new tab and verify alignment:\n${art.originalUrl}`}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
                                      <span>Source</span>
                                    </a>

                                    <button
                                      onClick={() => {
                                        setSourceVerificationModal({
                                          article: art,
                                          url: art.originalUrl || '',
                                          source: art.originalSource || '',
                                        });
                                      }}
                                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                      title="Edit / update original article link"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    id={`add-source-btn-${art.id}`}
                                    onClick={() => {
                                      setSourceVerificationModal({
                                        article: art,
                                        url: '',
                                        source: art.originalSource || '',
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                                    title="Add original article link for editorial verification"
                                  >
                                    <Link2 className="w-3.5 h-3.5 text-amber-600" />
                                    <span>+ Add Source Link</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-700">
                                {art.editorialType}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  art.status === 'published'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : art.status === 'review'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {art.status}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px]">
                              <span className="inline-flex items-center gap-1 text-slate-600">
                                <Globe className="w-3 h-3 text-slate-400" />
                                {transCount}/1
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono text-slate-600">
                              {art.views.toLocaleString()}
                            </td>

                            <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                              {new Date(art.publishedAt).toLocaleDateString()}
                            </td>

                            <td className="py-3 px-4 text-end">
                              <div className="flex items-center justify-end gap-1">
                                {art.originalUrl && (
                                  <a
                                    id={`row-action-source-${art.id}`}
                                    href={art.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded hover:bg-sky-50 text-sky-600 hover:text-sky-900 transition-colors"
                                    title={`Open original source cable in new tab:\n${art.originalUrl}`}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                <button
                                  onClick={() => toggleBreaking(art)}
                                  title={art.isBreaking ? 'Remove Breaking Alert' : 'Mark as Breaking News'}
                                  className={`p-1.5 rounded hover:bg-slate-100 cursor-pointer ${
                                    art.isBreaking ? 'text-red-600' : 'text-slate-400'
                                  }`}
                                >
                                  <Flame className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => togglePin(art)}
                                  title={art.isPinned ? 'Unpin from Top' : 'Pin to Top'}
                                  className={`p-1.5 rounded hover:bg-slate-100 cursor-pointer ${
                                    art.isPinned ? 'text-sky-600' : 'text-slate-400'
                                  }`}
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleRegenerateSingle(art)}
                                  disabled={regeneratingArticleId === art.id}
                                  className="p-1.5 rounded hover:bg-sky-50 text-slate-400 hover:text-sky-600 cursor-pointer disabled:opacity-50"
                                  title={`Regenerate in "${selectedRegenFormat}" format while preserving original concept`}
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${regeneratingArticleId === art.id ? 'animate-spin text-sky-600' : ''}`} />
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingArticle(art);
                                    setIsEditorOpen(true);
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 cursor-pointer"
                                  title="Edit full article and translations"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDeleteArticle(art.id)}
                                  className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                                  title="Delete article"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2.5: AUTOMATED HOURLY CRAWLER & RETRIEVAL ENGINE */}
        {activeTab === 'crawler' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <h3 className="font-bold text-lg text-slate-900">
                      Automated Real-Time Article Retrieval Engine
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                      Hourly Source Crawler Active
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                    An Appwrite scheduled function starts automatically every hour. It fetches unique English RSS/Atom stories published during the previous 60 minutes and persists them to Appwrite with source images and SEO metadata.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-center">
                  <button
                    onClick={handleRunCrawlerNow}
                    disabled={isCrawlerRunning}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCrawlerRunning ? 'animate-spin' : ''}`} />
                    <span>{isCrawlerRunning ? 'Crawling Wire Feeds...' : 'Run Hourly Crawl Cycle Now'}</span>
                  </button>

                </div>
              </div>

              {crawlerActionMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{crawlerActionMessage}</span>
                  </div>
                  <button
                    onClick={() => setCrawlerActionMessage(null)}
                    className="text-emerald-700 hover:text-emerald-950 font-semibold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Scheduler Cadence</span>
                  <Clock className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-xl font-black text-slate-900">Every 60 Mins</div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Appwrite scheduled function active</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Total Scraped Ingests</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-black text-slate-900">
                  {crawlerStatus?.totalArticlesIngested ?? 0} Stories
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Latest fetch: {crawlerStatus?.lastImportedCount ?? 0} article(s)
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Last Execution</span>
                  <Radio className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {crawlerStatus?.lastRunTime
                    ? new Date(crawlerStatus.lastRunTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'System Initializing'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {crawlerStatus?.lastRunTime
                    ? `${new Date(crawlerStatus.lastRunTime).toLocaleDateString()} · ${crawlerStatus?.lastImportedCount ?? 0} imported · ${crawlerStatus?.lastRunStatus || 'completed'}`
                    : 'Awaiting scheduled interval'}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Freshness Window</span>
                  <Clock className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-sm font-bold text-slate-900">Last 60 minutes only</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  English-only · canonical URL/title deduplication
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Next Scheduled Ingest</span>
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {crawlerStatus?.nextRunTime
                    ? new Date(crawlerStatus.nextRunTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Hourly cycle active'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Automatic cron trigger</div>
              </div>
            </div>

            {/* Monitored Target Wire Sources */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Target Global Wire Sources (Hourly Scan)</h4>
                  <p className="text-xs text-slate-500">
                    Crawler scans these authorized feeds for un-scraped wire releases every hour
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Deduplication Enabled
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {sources.map((feed, idx) => (
                  <div key={feed.id || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{feed.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          feed.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {feed.isActive ? 'Active Scan' : 'Paused'}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] block">{feed.rssUrl}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 self-start sm:self-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {feed.category}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {feed.lastImport ? new Date(feed.lastImport).toLocaleString() : 'Not fetched yet'}
                      </span>
                    </div>
                  </div>
                ))}             </div>
            </div>

            {/* Live Crawler Activity Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    Real-Time Crawler Execution Stream
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {crawlerStatus?.recentLogs?.length || 0} cycles logged
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto font-mono text-xs text-slate-300">
                {crawlerStatus?.recentLogs && crawlerStatus.recentLogs.length > 0 ? (
                  crawlerStatus.recentLogs.map((log: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-slate-200">{log.message}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                        {log.articlesAdded > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            +{log.articlesAdded} articles
                          </span>
                        )}
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 py-4 text-center">
                    No recent crawler runs recorded yet. Click &quot;Run Hourly Crawl Cycle Now&quot; to execute immediately.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SOURCES */}
        {activeTab === 'sources' && (
          <RssSourcesPanel
            sources={sources}
            categories={categories}
            onRefreshSources={onRefreshSources}
          />
        )}

        {/* TAB 4: COMMENTS */}
        {activeTab === 'comments' && <CommentModerationPanel />}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <NewsroomSettingsPanel
            settings={settings}
            logs={logs}
            categories={categories}
            onUpdateSettings={onUpdateSettings}
            onRefreshCategories={onRefreshCategories}
            onRefreshLogs={onRefreshLogs}
          />
        )}
      </main>

      {/* Quick Original Article Link & Source Verification Modal */}
      {sourceVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                    <ExternalLink className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-base text-slate-900">
                    Original Article Link & Source Verification
                  </h3>
                </div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  Dashboard Only • Hidden from Public Site
                </span>
              </div>
              <button
                onClick={() => {
                  setSourceVerificationModal(null);
                  setSourceUrlSaveSuccess(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This link is provided exclusively in the control panel to allow editors to inspect and verify that imported or translated news stories conform accurately to the original reporting. This URL is <strong>never displayed on the public article page on the main site</strong>.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Article Headline
              </span>
              <p className="text-xs font-bold text-slate-900 line-clamp-2">
                {sourceVerificationModal.article.translations.en?.title ||
                  Object.values(sourceVerificationModal.article.translations)[0]?.title}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Original Source Agency / Wire Name
                </label>
                <input
                  type="text"
                  value={sourceVerificationModal.source}
                  onChange={(e) =>
                    setSourceVerificationModal({
                      ...sourceVerificationModal,
                      source: e.target.value,
                    })
                  }
                  placeholder="e.g. Reuters Global Wire, AP News, Bloomberg"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-sky-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Original Article Link (Source URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={sourceVerificationModal.url}
                    onChange={(e) =>
                      setSourceVerificationModal({
                        ...sourceVerificationModal,
                        url: e.target.value,
                      })
                    }
                    placeholder="https://originalsource.com/article/reference..."
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-sky-500 text-slate-800"
                  />
                  {sourceVerificationModal.url.trim() && (
                    <a
                      href={sourceVerificationModal.url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                      title="Test and open original article link in a new browser tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test Link</span>
                    </a>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={isResolvingSingleLink}
                    onClick={async () => {
                      try {
                        setIsResolvingSingleLink(true);
                        setSingleLinkResolutionNotice(null);
                        const res = await fetch(`/api/articles/${sourceVerificationModal.article.id}/verify-source-link`, {
                          method: 'POST',
                        });
                        const data = await res.json();
                        if (res.ok && data.success && data.verified) {
                          setSourceVerificationModal({
                            ...sourceVerificationModal,
                            url: data.verified.originalUrl,
                            source: data.verified.originalSource,
                          });
                          setSingleLinkResolutionNotice(
                            data.verified.wasUpdated
                              ? `Authentic live link retrieved: ${data.verified.originalSource}`
                              : 'Source link is verified and active.'
                          );
                          onRefreshArticles();
                        } else {
                          setSingleLinkResolutionNotice(data.error || 'Could not auto-retrieve link.');
                        }
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        setSingleLinkResolutionNotice(`Error: ${msg}`);
                      } finally {
                        setIsResolvingSingleLink(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                    title="Automatically verify and retrieve genuine, accessible article link from the official source registry"
                  >
                    <RefreshCw className={`w-3 h-3 ${isResolvingSingleLink ? 'animate-spin' : ''}`} />
                    <span>{isResolvingSingleLink ? 'Retrieving Authentic Link...' : 'Auto-Retrieve Authentic Live Link'}</span>
                  </button>

                  <span className="text-[10px] text-slate-400">
                    Used strictly for editorial verification; never exposed on public readers' pages.
                  </span>
                </div>

                {singleLinkResolutionNotice && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{singleLinkResolutionNotice}</span>
                  </div>
                )}
              </div>
            </div>

            {sourceUrlSaveSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Original article link saved successfully!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSourceVerificationModal(null);
                  setSourceUrlSaveSuccess(false);
                  setSingleLinkResolutionNotice(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingSourceUrl}
                onClick={async () => {
                  try {
                    setIsSavingSourceUrl(true);
                    await handleSaveArticle({
                      id: sourceVerificationModal.article.id,
                      originalUrl: sourceVerificationModal.url.trim(),
                      originalSource:
                        sourceVerificationModal.source.trim() ||
                        sourceVerificationModal.article.originalSource,
                    });
                    setSourceUrlSaveSuccess(true);
                    setTimeout(() => {
                      setSourceVerificationModal(null);
                      setSourceUrlSaveSuccess(false);
                      setSingleLinkResolutionNotice(null);
                    }, 1000);
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    alert(`Error saving original article link: ${msg}`);
                  } finally {
                    setIsSavingSourceUrl(false);
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isSavingSourceUrl ? 'Saving...' : 'Save Source Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <ArticleEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingArticle(null);
        }}
        article={editingArticle}
        categories={categories}
        onSave={handleSaveArticle}
      />
    </div>
  );
};
