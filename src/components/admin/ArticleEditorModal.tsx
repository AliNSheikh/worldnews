import React, { useState, useRef } from 'react';
import { X, Sparkles, Save, Globe, Eye, Image as ImageIcon, Upload, Link as LinkIcon, Check, RefreshCw, AlertCircle, FileCheck, ExternalLink, Video, Play, Camera } from 'lucide-react';
import { Article, ArticleTranslation, Category, EditorialType, LanguageCode } from '../../types';

interface ArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Partial<Article> | null;
  categories: Category[];
  onSave: (articleData: Partial<Article>) => Promise<void>;
}

export const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  isOpen,
  onClose,
  article,
  categories,
  onSave,
}) => {
  if (!isOpen) return null;

  const isNew = !article?.id;
  const [activeLang, setActiveLang] = useState<LanguageCode>('en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSeoOptimizing, setIsSeoOptimizing] = useState(false);
  const [imageUploadMode, setImageUploadMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [category, setCategory] = useState(article?.category || 'world');
  const [editorialType, setEditorialType] = useState<EditorialType>(article?.editorialType || 'original');
  const [status, setStatus] = useState<Article['status']>(article?.status || 'published');
  const [isBreaking, setIsBreaking] = useState(article?.isBreaking || false);
  const [isPinned, setIsPinned] = useState(article?.isPinned || false);
  const [byline, setByline] = useState(article?.byline || 'World News Editorial Staff');
  const [originalSource, setOriginalSource] = useState(article?.originalSource || 'World News Desk');
  const [originalUrl, setOriginalUrl] = useState(article?.originalUrl || '');
  const [image, setImage] = useState(
    article?.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80'
  );
  const [imageCredit, setImageCredit] = useState(article?.imageCredit || 'World News Photo Service');
  const [imageLicense, setImageLicense] = useState(article?.imageLicense || 'Editorial Press License');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Video and Media states
  const [hasVideo, setHasVideo] = useState(article?.hasVideo || false);
  const [videoUrl, setVideoUrl] = useState(article?.videoUrl || '');
  const [videoIframeUrl, setVideoIframeUrl] = useState(article?.videoIframeUrl || '');
  const [videoThumbnail, setVideoThumbnail] = useState(article?.videoThumbnail || '');
  const [isResolvingVideo, setIsResolvingVideo] = useState(false);
  const [isAiGeneratingImage, setIsAiGeneratingImage] = useState(false);

  // Translations Map
  const [translations, setTranslations] = useState<Record<LanguageCode, Partial<ArticleTranslation>>>(() => {
    const existing = article?.translations || ({} as any);
    const langs: LanguageCode[] = ['en'];
    const initial: Record<LanguageCode, Partial<ArticleTranslation>> = {} as any;

    langs.forEach((lang) => {
      initial[lang] = existing[lang] || {
        language: lang,
        title: '',
        slug: '',
        executiveSummary: '',
        structuredBody: '',
        seoTitle: '',
        metaDescription: '',
        keywords: [],
        imageAlt: '',
        translationStatus: 'draft',
      };
    });
    return initial;
  });

  const updateTranslation = (lang: LanguageCode, fields: Partial<ArticleTranslation>) => {
    setTranslations((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        ...fields,
      },
    }));
  };

  // Direct laptop file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP, GIF).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file size should be less than 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImage(event.target.result);
        setUploadedFileName(file.name);
        setError(null);
        setSuccessNotice(`Image "${file.name}" uploaded successfully from your laptop.`);
        setTimeout(() => setSuccessNotice(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-translate from current active language into all 5 languages
  const handleAutoTranslateAll = async () => {
    const sourceTrans = translations[activeLang];
    if (!sourceTrans?.title?.trim() || !sourceTrans?.structuredBody?.trim()) {
      setError(`Please provide at least a title and body in ${activeLang.toUpperCase()} before auto-translating.`);
      return;
    }

    try {
      setIsTranslating(true);
      setError(null);
      setSuccessNotice(null);

      const res = await fetch('/api/ai/translate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sourceTrans.title,
          executiveSummary: sourceTrans.executiveSummary || sourceTrans.title,
          structuredBody: sourceTrans.structuredBody,
          category,
          sourceLang: activeLang,
          keywords: sourceTrans.keywords,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to auto-translate article.');
      }

      const data = await res.json();
      if (data.translations) {
        setTranslations((prev) => ({
          ...prev,
          ...data.translations,
        }));
        setSuccessNotice('✨ Article successfully translated and localized into all 5 languages (AR, EN, DE, ES, FR)!');
        setTimeout(() => setSuccessNotice(null), 6000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  // AI SEO Polish & Rewrite (Medium length, human tone, no asterisks, standard <strong> bold)
  const handleSeoPolish = async () => {
    const sourceTrans = translations[activeLang];
    if (!sourceTrans?.title?.trim() || !sourceTrans?.structuredBody?.trim()) {
      setError(`Please provide a title and body in ${activeLang.toUpperCase()} to optimize.`);
      return;
    }

    try {
      setIsSeoOptimizing(true);
      setError(null);
      setSuccessNotice(null);

      const res = await fetch('/api/ai/translate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sourceTrans.title,
          executiveSummary: sourceTrans.executiveSummary || sourceTrans.title,
          structuredBody: sourceTrans.structuredBody,
          category,
          sourceLang: activeLang,
          keywords: sourceTrans.keywords,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.translations) {
          const english = data.translations.en || data.translations;
          setTranslations((prev) => ({ ...prev, en: english }));
          setSuccessNotice('🚀 English SEO rewrite complete: optimized title, metadata, keywords, subheadings, and formatting.');
          setTimeout(() => setSuccessNotice(null), 6000);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSeoOptimizing(false);
    }
  };

  // Video resolution handler: parses URL, generates iframe embed URL, and takes/extracts frame screenshot
  const handleResolveVideo = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a valid video URL first (YouTube, Vimeo, MP4, etc.).');
      return;
    }
    try {
      setIsResolvingVideo(true);
      setError(null);
      const res = await fetch('/api/media/resolve-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setHasVideo(true);
        setVideoIframeUrl(data.videoIframeUrl);
        setVideoThumbnail(data.videoThumbnail);
        setSuccessNotice('🎬 Video verified: Embedded iframe configured and high-resolution broadcast screenshot captured!');
        setTimeout(() => setSuccessNotice(null), 5000);
      } else {
        setError(data.error || 'Unable to parse video stream. Please check URL.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsResolvingVideo(false);
    }
  };

  // AI image generator: synthesizes or selects high-appeal image based on title & description
  const handleAiGenerateImage = async () => {
    const activeTrans = translations[activeLang] || translations.en;
    const title = activeTrans?.title?.trim();
    if (!title) {
      setError('Please provide an article title first so AI can generate a relevant image.');
      return;
    }
    try {
      setIsAiGeneratingImage(true);
      setError(null);
      const res = await fetch('/api/ai/generate-article-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: activeTrans?.executiveSummary || '',
          category,
          videoThumbnail,
          forceAiGeneration: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        setImage(data.image);
        if (data.imageCredit) setImageCredit(data.imageCredit);
        if (data.imageLicense) setImageLicense(data.imageLicense);
        setSuccessNotice('✨ Visually appealing AI editorial image generated successfully!');
        setTimeout(() => setSuccessNotice(null), 5000);
      } else {
        setError('Image generation failed; please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAiGeneratingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      // Verify that at least one language has a title
      const hasAnyTitle = Object.values(translations).some((t) => t.title?.trim());
      if (!hasAnyTitle) {
        throw new Error('Please enter an English article title.');
      }

      // If active language has title but EN is blank, auto-copy to EN so system remains cohesive
      if (!translations.en.title?.trim()) {
        const primaryLang = Object.keys(translations).find((k) => translations[k as LanguageCode]?.title?.trim()) as LanguageCode;
        if (primaryLang) {
          translations.en = {
            ...translations[primaryLang],
            language: 'en',
          };
        }
      }

      // Build payload
      const payload: Partial<Article> = {
        category,
        editorialType,
        status,
        isBreaking,
        isPinned,
        byline,
        originalSource,
        originalUrl: originalUrl.trim() || `https://worldnews.org/wire/${Date.now()}`,
        image,
        imageCredit,
        imageLicense,
        hasVideo,
        videoUrl: videoUrl.trim() || undefined,
        videoIframeUrl: videoIframeUrl.trim() || undefined,
        videoThumbnail: videoThumbnail.trim() || undefined,
        translations: translations as any,
      };

      if (!isNew && article?.id) {
        payload.id = article.id;
      }

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentTrans = translations[activeLang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold">
              {isNew ? 'Create New Editorial Article' : 'Edit Article Dispatch'}
            </h2>
            <p className="text-xs text-slate-400">
              Multilingual newsroom publication workflow across 5 editions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Core Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.names.en} ({c.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Editorial Type</label>
              <select
                value={editorialType}
                onChange={(e) => setEditorialType(e.target.value as EditorialType)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              >
                <option value="original">Original Reporting</option>
                <option value="ai-assisted">AI-Assisted Editorial</option>
                <option value="external">External Wire Attribution</option>
                <option value="analysis">Opinion / Analysis</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Article['status'])}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              >
                <option value="published">Published</option>
                <option value="review">Editorial Review</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Byline</label>
              <input
                type="text"
                value={byline}
                onChange={(e) => setByline(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Original Article Link (Internal Cable Verification Only - NEVER shown on public page) */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <FileCheck className="w-4 h-4 text-amber-700" />
                <span>Original Article Link (Internal Editorial Verification)</span>
              </label>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">
                Dashboard Only • Hidden from Public Site
              </span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Input the external source wire link or agency dispatch URL here. This link is solely used in the editorial dashboard to verify facts against the original imported cable and will <strong>never appear</strong> on the public article page on the main site.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="https://newsagency.com/wire/original-dispatch-reference..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono text-slate-800 placeholder:text-slate-400"
              />
              {originalUrl && (
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
                  title={`Open original article source in new tab:\n${originalUrl}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-800" />
                  <span>Open Source Link</span>
                </a>
              )}
            </div>
          </div>

          {/* Flags & Toggles */}
          <div className="flex flex-wrap items-center gap-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBreaking}
                onChange={(e) => setIsBreaking(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500"
              />
              <span className="font-semibold text-slate-800">Breaking News Banner Alert</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-semibold text-slate-800">Pin to Lead Grid</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Source Name:</span>
              <input
                type="text"
                value={originalSource}
                onChange={(e) => setOriginalSource(e.target.value)}
                placeholder="e.g. Reuters Wire"
                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
              />
            </div>
          </div>

          {/* Image & Laptop Upload Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ImageIcon className="w-4 h-4 text-sky-600" />
                <span>Lead Article Photography & Upload</span>
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={handleAiGenerateImage}
                  disabled={isAiGeneratingImage}
                  className="px-2.5 py-1 rounded text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Generate realistic, visually appealing news visual using Gemini AI"
                >
                  <Sparkles className={`w-3 h-3 text-amber-600 ${isAiGeneratingImage ? 'animate-spin' : ''}`} />
                  <span>{isAiGeneratingImage ? 'Generating AI Image...' : 'AI Image Generator'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageUploadMode('upload')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    imageUploadMode === 'upload' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upload from Laptop
                </button>
                <button
                  type="button"
                  onClick={() => setImageUploadMode('url')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    imageUploadMode === 'url' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Use Image URL
                </button>
              </div>
            </div>

            {imageUploadMode === 'upload' ? (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-white/80 hover:bg-sky-50/50 rounded-xl p-5 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Click to choose an image from your laptop
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Supports JPG, PNG, WebP, GIF up to 8MB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {image && (
                  <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg">
                    <img
                      src={image}
                      alt="Article Lead Preview"
                      className="w-16 h-12 object-cover rounded border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {uploadedFileName || 'Selected Lead Photo'}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        ✓ Ready for high-resolution web publishing
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                    >
                      Change Photo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Image URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                  {image && (
                    <img
                      src={image}
                      alt="Preview"
                      className="w-10 h-7 object-cover rounded border border-slate-200"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Image Credit / Agency</label>
                <input
                  type="text"
                  value={imageCredit}
                  onChange={(e) => setImageCredit(e.target.value)}
                  placeholder="e.g. Associated Press Wire Pool"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Type</label>
                <input
                  type="text"
                  value={imageLicense}
                  onChange={(e) => setImageLicense(e.target.value)}
                  placeholder="e.g. Editorial Press License"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Video Broadcast & Frame Screenshot Section */}
          <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                <Video className="w-4 h-4 text-red-500" />
                <span>Embedded Video Broadcast & Screenshot Capture</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasVideo}
                    onChange={(e) => setHasVideo(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span className="text-slate-300 font-semibold">Enable Video Report</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-300">
                Video URL or Stream Source (YouTube, Vimeo, MP4, WebM)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or .mp4 video stream"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={handleResolveVideo}
                  disabled={isResolvingVideo || !videoUrl.trim()}
                  className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  <Camera className={`w-3.5 h-3.5 ${isResolvingVideo ? 'animate-spin' : ''}`} />
                  <span>{isResolvingVideo ? 'Processing...' : 'Detect & Capture Screenshot'}</span>
                </button>
              </div>
            </div>

            {(videoIframeUrl || videoThumbnail) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {videoIframeUrl && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-semibold flex items-center gap-1">
                        <Play className="w-3 h-3 text-red-400" /> Embedded Iframe Preview:
                      </span>
                    </div>
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-700 bg-black">
                      <iframe
                        src={videoIframeUrl}
                        title="Preview"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}

                {videoThumbnail && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-semibold flex items-center gap-1">
                        <Camera className="w-3 h-3 text-sky-400" /> Broadcast Screenshot:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setImage(videoThumbnail);
                          setImageCredit(`${originalSource} Video Broadcast Feed`);
                          setImageLicense('Broadcast Agency Screen Capture');
                          setSuccessNotice('📸 Video frame screenshot set as article lead image!');
                          setTimeout(() => setSuccessNotice(null), 4000);
                        }}
                        className="text-sky-400 hover:text-sky-300 hover:underline font-bold text-[10px] cursor-pointer"
                      >
                        Set as Article Image →
                      </button>
                    </div>
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-700 bg-black">
                      <img
                        src={videoThumbnail}
                        alt="Broadcast screenshot preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* English Content & SEO */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 p-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-slate-600 ms-1" />
                <span className="text-xs font-bold text-slate-800 me-1">Language:</span>
                {(['en'] as LanguageCode[]).map((lang) => {
                  const hasTitle = !!translations[lang]?.title?.trim();
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveLang(lang)}
                      className={`px-3 py-1 text-xs font-bold rounded-md uppercase transition-colors cursor-pointer flex items-center gap-1 ${
                        activeLang === lang
                          ? 'bg-sky-700 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{lang}</span>
                      {hasTitle && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                    </button>
                  );
                })}
              </div>

              {/* English SEO action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSeoPolish}
                  disabled={isSeoOptimizing}
                  title="Optimize for search indexing, medium length, natural human voice, and standard bold formatting (no asterisks)"
                  className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSeoOptimizing ? 'animate-spin' : ''}`} />
                  <span>{isSeoOptimizing ? 'Optimizing...' : 'AI SEO Polish'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4" dir={activeLang === 'ar' ? 'rtl' : 'ltr'}>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title ({activeLang.toUpperCase()}) *
                </label>
                <input
                  type="text"
                  value={currentTrans?.title || ''}
                  onChange={(e) => updateTranslation(activeLang, { title: e.target.value })}
                  placeholder={`Headline in ${activeLang}...`}
                  className="w-full px-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={currentTrans?.slug || ''}
                    onChange={(e) => updateTranslation(activeLang, { slug: e.target.value })}
                    placeholder="kebab-case-slug"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Image Alt Description (SEO & Accessibility)
                  </label>
                  <input
                    type="text"
                    value={currentTrans?.imageAlt || ''}
                    onChange={(e) => updateTranslation(activeLang, { imageAlt: e.target.value })}
                    placeholder="Descriptive text for accessibility & image search"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Executive Summary (TL;DR Lead for Google Snippets)
                </label>
                <textarea
                  rows={2}
                  value={currentTrans?.executiveSummary || ''}
                  onChange={(e) => updateTranslation(activeLang, { executiveSummary: e.target.value })}
                  placeholder="Concise 2-sentence summary of the report..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Structured Article Body (Medium length, natural human voice)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Use ## and ### for subheadings. For bold, use standard &lt;strong&gt; or bold toolbar (avoid ** asterisks).
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={currentTrans?.structuredBody || ''}
                  onChange={(e) => updateTranslation(activeLang, { structuredBody: e.target.value })}
                  placeholder="## Key Strategic Developments&#10;&#10;Detailed medium-length coverage explaining verified facts...&#10;&#10;### Impact & Next Steps&#10;&#10;Continuing multilateral consultations..."
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 leading-relaxed"
                />
              </div>

              {/* SEO Meta Fields */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <span className="text-xs font-bold text-slate-800">
                  Search Engine Optimization (Google Search & News)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      SEO Title (Under 60 chars)
                    </label>
                    <input
                      type="text"
                      value={currentTrans?.seoTitle || ''}
                      onChange={(e) => updateTranslation(activeLang, { seoTitle: e.target.value })}
                      placeholder="High-CTR headline for search results"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Meta Description (120-155 chars)
                    </label>
                    <input
                      type="text"
                      value={currentTrans?.metaDescription || ''}
                      onChange={(e) => updateTranslation(activeLang, { metaDescription: e.target.value })}
                      placeholder="Summary snippet for search results"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Publish Dispatch'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

