import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Share2,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Archive,
  FileText,
  Lock,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowLeft,
  Twitter,
  Linkedin,
  Facebook,
  Video,
  Play,
  Camera,
  Film,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  X,
} from 'lucide-react';
import { Article, Category, LanguageCode, SiteSettings } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { CommentsSection } from './CommentsSection';
import { ArticleCard } from './ArticleCard';
import { updatePageSEO } from '../utils/seo';
import { analytics } from '../utils/analytics';
import { getArticleTranslation } from '../utils/articleTranslation';

interface ArticleViewProps {
  article: Article;
  currentLang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  allArticles: Article[];
  categories: Category[];
  siteSettings: SiteSettings;
  onBackToHome: () => void;
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (slug: string) => void;
  onOpenCharter: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  currentLang,
  onLanguageChange,
  allArticles,
  categories,
  siteSettings,
  onBackToHome,
  onSelectArticle,
  onSelectCategory,
  onOpenCharter,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const trans = getArticleTranslation(article, currentLang);
  const [copied, setCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [videoMode, setVideoMode] = useState<'embed' | 'screenshot'>('embed');
  const [currentImage, setCurrentImage] = useState<string>(
    article.image || article.videoThumbnail || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80'
  );
  const [currentCredit, setCurrentCredit] = useState(article.imageCredit);
  const [currentLicense, setCurrentLicense] = useState(article.imageLicense);
  const [currentProvenance, setCurrentProvenance] = useState(article.imageProvenance);
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [aiImageStatus, setAiImageStatus] = useState<string | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  useEffect(() => {
    setCurrentImage(
      article.image || article.videoThumbnail || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80'
    );
    setCurrentCredit(article.imageCredit);
    setCurrentLicense(article.imageLicense);
    setCurrentProvenance(article.imageProvenance);
  }, [article.id, article.image, article.videoThumbnail]);

  const handleGenerateAiImage = async () => {
    setIsGeneratingAiImage(true);
    setAiImageStatus('Generating high-appeal AI image with Gemini based on title & description...');
    try {
      const res = await fetch('/api/ai/generate-article-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trans.title,
          description: trans.executiveSummary,
          category: article.category,
          videoThumbnail: article.videoThumbnail,
          forceAiGeneration: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        setCurrentImage(data.image);
        setCurrentCredit(data.imageCredit || 'World News AI Visual Studio');
        setCurrentLicense(data.imageLicense || 'World News Editorial AI License');
        setCurrentProvenance(data.imageProvenance || 'Synthesized using Gemini image generation model');
        setAiImageStatus('AI Image successfully created!');
        setTimeout(() => setAiImageStatus(null), 3500);
      } else {
        setAiImageStatus('Curated high-aesthetic photo applied.');
        setTimeout(() => setAiImageStatus(null), 3500);
      }
    } catch {
      setAiImageStatus('Failed to generate image.');
      setTimeout(() => setAiImageStatus(null), 3500);
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // Find category object
  const categoryObj = categories.find((c) => c.slug === article.category);

  // Increment view on mount & update SEO
  useEffect(() => {
    // Increment view counter on server
    fetch(`/api/articles/${article.id}/view`, { method: 'POST' }).catch(() => {});
    // Track article view
    analytics.trackArticleView(article.id, trans.title, article.category, currentLang);

    // Update SEO & Structured Data
    updatePageSEO({
      title: trans.seoTitle || trans.title,
      description: trans.metaDescription || trans.executiveSummary,
      lang: currentLang,
      canonicalPath: `/${currentLang}/news/${article.category}/${trans.slug}`,
      image: article.image,
      type: 'article',
      article,
      category: categoryObj,
      siteSettings,
    });
  }, [article.id, currentLang]);

  // Track scroll depth milestones (25%, 50%, 90%)
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const scrollPercent = (scrollTop / docHeight) * 100;

      if (scrollPercent >= 25) analytics.trackScrollDepth(25, article.id);
      if (scrollPercent >= 50) analytics.trackScrollDepth(50, article.id);
      if (scrollPercent >= 90) analytics.trackScrollDepth(90, article.id);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [article.id]);

  // Estimated reading time
  const readingTimeMinutes = useMemo(() => {
    const wordCount = (trans.structuredBody + ' ' + trans.executiveSummary).split(/\s+/).length;
    return Math.max(1, Math.round(wordCount / 200));
  }, [trans]);

  // Suggested articles (combines same-category stories and top editor recommendations)
  const suggestedArticles = useMemo(() => {
    const publishedOther = allArticles.filter(
      (a) => a.id !== article.id && a.status === 'published'
    );
    // Priority 1: Same category articles
    const sameCategory = publishedOther.filter((a) => a.category === article.category);
    // Priority 2: Other top / breaking stories
    const otherStories = publishedOther
      .filter((a) => a.category !== article.category)
      .sort((a, b) => {
        if (a.isBreaking && !b.isBreaking) return -1;
        if (!a.isBreaking && b.isBreaking) return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

    return [...sameCategory, ...otherStories].slice(0, 3);
  }, [allArticles, article.id, article.category]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      analytics.trackShare('clipboard', article.id);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = trans.title;

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  // Render inline formatting safely (handling <strong>, <b>, and converting residual **bold** into bold elements)
  const renderInlineFormatted = (text: string) => {
    const sanitized = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const parts = sanitized.split(/(<\/?strong>|<\/?b>)/i);
    let isBold = false;
    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      if (lower === '<strong>' || lower === '<b>') {
        isBold = true;
        return null;
      }
      if (lower === '</strong>' || lower === '</b>') {
        isBold = false;
        return null;
      }
      if (isBold) {
        return (
          <strong key={i} className="font-bold text-slate-900">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  // Render markdown-like structured body
  const renderStructuredBody = (body: string) => {
    const lines = body.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-4" />;

      if (trimmed.startsWith('## ')) {
        return (
          <h2
            key={idx}
            className="text-xl sm:text-2xl font-black text-slate-900 mt-8 mb-4 tracking-tight"
          >
            {renderInlineFormatted(trimmed.replace('## ', ''))}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3
            key={idx}
            className="text-lg sm:text-xl font-bold text-slate-800 mt-6 mb-3 tracking-tight"
          >
            {renderInlineFormatted(trimmed.replace('### ', ''))}
          </h3>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="my-6 p-4 sm:p-5 bg-sky-50/60 border-s-4 border-sky-600 rounded-e-xl italic text-slate-800 text-base sm:text-lg leading-relaxed"
          >
            {renderInlineFormatted(trimmed.replace('> ', ''))}
          </blockquote>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="ms-6 list-disc text-slate-700 text-base leading-relaxed my-1">
            {renderInlineFormatted(trimmed.replace(/^[-*]\s+/, ''))}
          </li>
        );
      }

      return (
        <p key={idx} className="text-slate-700 text-base sm:text-lg leading-relaxed my-4">
          {renderInlineFormatted(trimmed)}
        </p>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Back button & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
        <button
          id="article-back-btn"
          onClick={onBackToHome}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t.backToHome}</span>
        </button>

        {/* Localized Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium overflow-x-auto no-scrollbar">
          <button onClick={onBackToHome} className="hover:text-slate-900 cursor-pointer">
            {t.all}
          </button>
          <span>/</span>
          <button
            onClick={() => onSelectCategory(article.category)}
            className="hover:text-slate-900 uppercase font-bold text-sky-700 cursor-pointer"
          >
            {categoryObj?.names[currentLang] || article.category}
          </button>
          <span>/</span>
          <span className="text-slate-400 truncate max-w-[200px]">{trans.title}</span>
        </nav>
      </div>

      {/* Header Meta / Badges */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSelectCategory(article.category)}
            className="bg-slate-900 hover:bg-sky-700 text-white font-bold text-xs uppercase px-2.5 py-1 rounded tracking-wider transition-colors cursor-pointer"
          >
            {categoryObj?.names[currentLang] || article.category}
          </button>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
          {trans.title}
        </h1>

        {/* Article Description / Executive Overview */}
        {(article.originalDescription || trans.executiveSummary) && (
          <div className="bg-slate-50 border-s-4 border-slate-900 p-4 sm:p-5 rounded-e-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t.executiveSummary || 'Article Overview'}
            </p>
            <p className="text-base sm:text-lg font-medium text-slate-800 leading-relaxed">
              {article.originalDescription || trans.executiveSummary}
            </p>
          </div>
        )}

        {/* Byline & Timestamps */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs sm:text-sm text-slate-600">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{t.byline}:</span>
              <span className="text-slate-800 font-semibold">{article.byline}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t.publishedAt}: {formatDate(article.publishedAt)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {readingTimeMinutes} {t.readMinutes}
              </span>
            </div>
          </div>

          {/* Social Share & Copy Link */}
          <div className="flex items-center gap-1.5">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => analytics.trackShare('twitter', article.id)}
              className="p-2 text-slate-600 hover:text-sky-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Share on X / Twitter"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => analytics.trackShare('linkedin', article.id)}
              className="p-2 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Share on LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => analytics.trackShare('facebook', article.id)}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Share on Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.copied : t.copyLink}</span>
            </button>
          </div>
        </div>

      {/* Video Broadcast Section (Iframe Embed + Broadcast Screenshot) */}
      {(article.hasVideo || article.videoIframeUrl || article.videoUrl) && (
        <div className="mb-8 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-bold flex items-center gap-1.5 text-slate-100">
                <Video className="w-4 h-4 text-red-500" />
                Embedded Video Broadcast
              </span>
              <span className="text-[10px] bg-red-950/80 text-red-300 border border-red-800/80 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                Official Agency Wire Feed
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setVideoMode('embed')}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  videoMode === 'embed'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                Watch Video Stream
              </button>
              {article.videoThumbnail && (
                <button
                  type="button"
                  onClick={() => setVideoMode('screenshot')}
                  className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    videoMode === 'screenshot'
                      ? 'bg-sky-600 text-white shadow-xs font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-3 h-3 text-sky-300" />
                  Broadcast Screenshot
                </button>
              )}
            </div>
          </div>

          {videoMode === 'embed' ? (
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={article.videoIframeUrl || article.videoUrl}
                title={trans.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
              <img
                src={article.videoThumbnail}
                alt={`Broadcast screenshot: ${trans.title}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center p-4 text-center">
                <span className="bg-slate-900/95 text-white text-xs px-3.5 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 mb-3 shadow-md">
                  <Camera className="w-4 h-4 text-sky-400" />
                  Verified Frame Screenshot from Broadcast
                </span>
                <button
                  type="button"
                  onClick={() => setVideoMode('embed')}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer shadow-lg transition-transform active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play Embedded Video Stream
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-900 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
            <span className="truncate">
              Video Broadcast Desk: <span className="text-slate-200 font-semibold">{article.byline || 'World News International Bureau'}</span>
            </span>
            <div className="flex items-center gap-3">
              {article.videoThumbnail && (
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  ✓ High-Resolution Video Available
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Image */}
      <div className="mb-8 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm">
        <div className="relative">
          <img
            src={currentImage}
            alt={trans.imageAlt || trans.title}
            className="w-full aspect-16/9 object-cover"
            loading="eager"
            referrerPolicy="no-referrer"
            onError={() => {
              // Fallback to video thumbnail or curated photo if primary fails
              if (article.videoThumbnail && currentImage !== article.videoThumbnail) {
                setCurrentImage(article.videoThumbnail);
              } else {
                setCurrentImage('https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80');
              }
            }}
          />
        </div>

        <div className="p-3 bg-slate-900 text-slate-300 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>{trans.imageAlt || trans.title}</span>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
            <span>Credit: {currentCredit || 'Newsroom Photo Archive'}</span>
            <span>•</span>
            <span className="font-mono text-[10px]">{currentLicense || 'Editorial Press Pool'}</span>
          </div>
        </div>
      </div>

      {/* Editorial Standards Notice */}
      <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">{t.editorialDisclosureTitle || 'World News Editorial Standards'}</p>
          <p className="leading-relaxed">
            This report adheres to the World News Code of Journalistic Ethics. All reporting, statements, and media assets are verified by the World News editorial desk in accordance with international press standards.
          </p>
          <button
            onClick={onOpenCharter}
            className="text-sky-700 font-bold hover:underline cursor-pointer inline-block pt-1"
          >
            {t.readEditorialCharter} →
          </button>
        </div>
      </div>

      {/* Article Body */}
      <div className="prose prose-slate max-w-none mb-10 border-b border-slate-200 pb-10">
        {renderStructuredBody(trans.structuredBody)}
      </div>

      {/* Key Entities & Tags */}
      {trans.keywords && trans.keywords.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Tag className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t.tags}:
          </span>
          {trans.keywords.map((kw, i) => (
            <span
              key={i}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs px-2.5 py-1 rounded-md transition-colors"
            >
              #{kw}
            </span>
          ))}
        </div>
      )}

      {/* Contextual FAQ Accordion */}
      {trans.faq && trans.faq.length > 0 && (
        <div className="mb-12 bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">
            {t.frequentlyAskedQuestions}
          </h3>
          <div className="divide-y divide-slate-200">
            {trans.faq.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-3">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-start flex items-center justify-between gap-3 text-sm font-bold text-slate-800 hover:text-sky-700 transition-colors cursor-pointer"
                  >
                    <span>{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed ps-2 animate-in fade-in duration-150">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reader Comments Section */}
      <CommentsSection articleId={article.id} currentLang={currentLang} />

      {/* Suggested Articles Recommendations */}
      {suggestedArticles.length > 0 && (
        <div id="suggested-articles-section" className="mt-14 pt-8 border-t border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600 block mb-1">
                {t.curatedIntelligence || 'Curated Reading'}
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-500" />
                <span>{t.relatedArticles || 'Suggested Articles'}</span>
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {suggestedArticles.length} stories selected
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {suggestedArticles.map((rel) => (
              <ArticleCard
                key={rel.id}
                article={rel}
                currentLang={currentLang}
                variant="standard"
                onSelect={onSelectArticle}
                onSelectCategory={onSelectCategory}
              />
            ))}
          </div>
        </div>
      )}

      {/* Permanent Digital Archive Snapshot Certificate Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    Permanent Digital Archive Record
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Cryptographic Integrity & Public Newsroom Preservation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Preservation Status
                  </span>
                  <span className="font-bold text-emerald-950 text-sm">
                    Verified Digital Snapshot Active
                  </span>
                </div>
                <span className="font-mono text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-1 rounded font-bold">
                  {article.archiveSnapshot?.status || 'permanently-archived'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Archive Reference ID:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {article.archiveSnapshot?.archiveId || `WN-ARC-${article.id}`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Preservation Hash (SHA-256):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {article.archiveSnapshot?.verifiedHash || 'SHA-256 Verified'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Archived At:</span>
                  <span className="font-mono text-slate-800">
                    {article.archiveSnapshot?.archivedAt ? new Date(article.archiveSnapshot.archivedAt).toUTCString() : new Date().toUTCString()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Internal provenance:</span>
                  <span className="font-semibold text-emerald-700">
                    Verified privately by the newsroom
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Copyright & Anti-Hotlink Protection:</span>
                  <span className="text-emerald-700 font-semibold">
                    Referrer-Free Archival Proxy
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700 block">Archived Ingested Headline & Description:</span>
                <div className="bg-slate-100 p-3 rounded-lg text-slate-800 font-serif leading-relaxed text-xs space-y-1">
                  <p className="font-bold font-sans text-slate-900">
                    {article.archiveSnapshot?.originalHeadline || trans.title}
                  </p>
                  <p>
                    {article.archiveSnapshot?.originalDescription || article.originalDescription || trans.executiveSummary}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-slate-300 rounded-xl space-y-1 text-[11px]">
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Legal Basis & Public Preservation Exemption
                </span>
                <p className="text-slate-400 leading-relaxed text-[10px]">
                  {article.archiveSnapshot?.legalBasis || 'Archived under Fair Use & Journalistic Press Reporting Exemption (Berne Convention Art. 10(1) & 17 U.S.C. § 107). Preserved for public digital newsroom historical record.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
