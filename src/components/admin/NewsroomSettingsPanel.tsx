import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Clock,
  ExternalLink,
  Save,
  Check,
  Search,
  BarChart3,
  Mail,
  Phone,
  Send,
  MessageCircle,
  MapPin,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Image as ImageIcon,
  Code2,
  Gauge,
} from 'lucide-react';
import { SiteSettings, AutomationLog } from '../../types';
import { HeroSliderManager } from './HeroSliderManager';

interface NewsroomSettingsPanelProps {
  settings: SiteSettings;
  logs: AutomationLog[];
  onUpdateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
  onRefreshLogs: () => void;
}

export const NewsroomSettingsPanel: React.FC<NewsroomSettingsPanelProps> = ({
  settings,
  logs,
  onUpdateSettings,
  onRefreshLogs,
}) => {
  const [commentMod, setCommentMod] = useState(settings.commentModeration);
  const [autoIngest, setAutoIngest] = useState(settings.autoIngestEnabled);
  // Contact Info State
  const [deskEmail, setDeskEmail] = useState(settings.contactInfo.email || '');
  const [deskPhone, setDeskPhone] = useState(settings.contactInfo.phone || '');
  const [deskAddress, setDeskAddress] = useState(settings.contactInfo.address || '');
  const [telegram, setTelegram] = useState(settings.socialLinks?.telegram || '');
  const [whatsapp, setWhatsapp] = useState(settings.socialLinks?.whatsapp || '');

  // Canonical domain, Google Search Console & Google Analytics
  const [siteUrl, setSiteUrl] = useState(settings.siteUrl || '');
  const [gscToken, setGscToken] = useState(settings.googleSearchConsoleVerification || '');
  const [gaId, setGaId] = useState(settings.googleAnalyticsMeasurementId || '');
  const [logoImage, setLogoImage] = useState(settings.logoImage || '');
  const [faviconImage, setFaviconImage] = useState(settings.faviconImage || '');
  const [homepageSeoTitle, setHomepageSeoTitle] = useState(settings.homepageSeoTitle || '');
  const [homepageSeoDescription, setHomepageSeoDescription] = useState(settings.homepageSeoDescription || '');
  const [homepageSeoKeywords, setHomepageSeoKeywords] = useState(
    (settings.homepageSeoKeywords || []).join(', ')
  );
  const [adsenseHeadCode, setAdsenseHeadCode] = useState(settings.adsenseHeadCode || '');
  const [adsenseBodyCode, setAdsenseBodyCode] = useState(settings.adsenseBodyCode || '');
  const [articlesPerSourcePerHour, setArticlesPerSourcePerHour] = useState(
    Math.max(1, Math.min(20, Number(settings.articlesPerSourcePerHour || 3)))
  );

  const handleImageUpload = (
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<string>>,
    maxBytes: number
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > maxBytes) {
      alert(`Image is too large. Maximum size is ${Math.round(maxBytes / 1024)} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  // UI State
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onUpdateSettings({
        commentModeration: commentMod,
        autoIngestEnabled: autoIngest,
        aiAssistanceEnabled: false,
        defaultLanguage: 'en',
        enabledLanguages: ['en'],
        contactInfo: {
          ...settings.contactInfo,
          email: deskEmail.trim(),
          phone: deskPhone.trim(),
          address: deskAddress.trim(),
        },
        socialLinks: {
          ...settings.socialLinks,
          telegram: telegram.trim(),
          whatsapp: whatsapp.trim(),
        },
        siteUrl: siteUrl.trim().replace(/\/$/, ''),
        googleSearchConsoleVerification: gscToken.trim(),
        googleAnalyticsMeasurementId: gaId.trim(),
        logoImage,
        faviconImage,
        homepageSeoTitle: homepageSeoTitle.trim(),
        homepageSeoDescription: homepageSeoDescription.trim(),
        homepageSeoKeywords: homepageSeoKeywords
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .slice(0, 30),
        adsenseHeadCode,
        adsenseBodyCode,
        articlesPerSourcePerHour: Math.max(1, Math.min(20, Number(articlesPerSourcePerHour || 3))),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-700" />
            <h3 className="font-bold text-base text-slate-900">
              Newsroom Governance & External Integrations
            </h3>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving...' : savedSuccess ? 'Saved' : 'Save All Settings'}</span>
          </button>
        </div>

        {/* Branding & Homepage SEO */}
        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-700" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-950">
              Branding & Homepage SEO
            </h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-amber-200 rounded-lg p-3.5 space-y-2">
              <label className="text-xs font-bold text-slate-800">Homepage Logo</label>
              {logoImage && <img src={logoImage} alt="Current site logo" className="h-12 max-w-full object-contain" />}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => handleImageUpload(e.target.files?.[0], setLogoImage, 1024 * 1024)}
                className="block w-full text-xs"
              />
              <div className="flex gap-2">
                <input
                  value={logoImage}
                  onChange={(e) => setLogoImage(e.target.value)}
                  placeholder="Or paste a logo image URL"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                {logoImage && (
                  <button type="button" onClick={() => setLogoImage('')} className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Uploads are stored in site settings. Keep the logo under 1 MB.</p>
            </div>

            <div className="bg-white border border-amber-200 rounded-lg p-3.5 space-y-2">
              <label className="text-xs font-bold text-slate-800">Site Icon / Favicon</label>
              {faviconImage && <img src={faviconImage} alt="Current favicon" className="w-10 h-10 object-contain" />}
              <input
                type="file"
                accept="image/png,image/x-icon,image/svg+xml,image/webp"
                onChange={(e) => handleImageUpload(e.target.files?.[0], setFaviconImage, 256 * 1024)}
                className="block w-full text-xs"
              />
              <div className="flex gap-2">
                <input
                  value={faviconImage}
                  onChange={(e) => setFaviconImage(e.target.value)}
                  placeholder="Or paste a favicon URL"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                {faviconImage && (
                  <button type="button" onClick={() => setFaviconImage('')} className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Recommended: square PNG, ICO, SVG, or WebP under 256 KB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <input
              value={homepageSeoTitle}
              onChange={(e) => setHomepageSeoTitle(e.target.value)}
              maxLength={80}
              placeholder="Homepage SEO title"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <textarea
              value={homepageSeoDescription}
              onChange={(e) => setHomepageSeoDescription(e.target.value)}
              maxLength={180}
              rows={3}
              placeholder="Homepage meta description"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <input
              value={homepageSeoKeywords}
              onChange={(e) => setHomepageSeoKeywords(e.target.value)}
              placeholder="world news, international news, breaking news"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Google Search Console & Google Analytics Section */}
        <div className="p-4 bg-sky-50/60 border border-sky-200/80 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-700" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-sky-950">
              Google Search Console & Google Analytics 4 Integrations
            </h4>
          </div>
          <p className="text-xs text-sky-900 leading-relaxed">
            Configure the canonical News Discover domain, Search Console verification token, and GA4 measurement ID. The site exposes live Turso-backed sitemap, news sitemap, robots.txt, and RSS endpoints for compliant crawling.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3.5 border border-sky-200 rounded-lg space-y-1.5 md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                <span>Canonical Site URL / Google Search Console Property</span>
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://your-news-discover-domain.com"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-500">
                Used by the dynamic sitemap, robots.txt, RSS feed, canonical URLs, and Search Console property setup.
              </p>
            </div>
            <div className="bg-white p-3.5 border border-sky-200 rounded-lg space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Search className="w-3.5 h-3.5 text-sky-600" />
                <span>Google Search Console Verification Token</span>
              </label>
              <input
                type="text"
                value={gscToken}
                onChange={(e) => setGscToken(e.target.value)}
                placeholder="e.g. google-site-verification token or code..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-500">
                Injected automatically as &lt;meta name="google-site-verification" content="..."&gt; on all pages.
              </p>
            </div>

            <div className="bg-white p-3.5 border border-sky-200 rounded-lg space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Analytics 4 Measurement ID</span>
              </label>
              <input
                type="text"
                value={gaId}
                onChange={(e) => setGaId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Automatically loads gtag.js and streams real-time pageviews, shares, and search telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Official English Edition */}
        <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-700" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-950">
              Official Site Language
            </h4>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white border border-indigo-200 rounded-lg">
            <span className="text-lg">🇬🇧</span>
            <div>
              <div className="text-sm font-bold text-slate-900">English</div>
              <div className="text-xs text-slate-500">
                English is the only public and generated edition. Automatic translation is disabled.
              </div>
            </div>
          </div>
        </div>

        {/* Contact Details Section */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-700" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Newsroom Contact Details & Messaging Platforms
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            These contact details and messaging platform links are displayed with corresponding icons across the website footer and newsroom pages for readers and sources.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <Mail className="w-3.5 h-3.5 text-sky-600" />
                <span>Editorial Desk Email</span>
              </label>
              <input
                type="email"
                value={deskEmail}
                onChange={(e) => setDeskEmail(e.target.value)}
                placeholder="editorial@worldnews.org"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Press Hotline / Phone</span>
              </label>
              <input
                type="tel"
                value={deskPhone}
                onChange={(e) => setDeskPhone(e.target.value)}
                placeholder="+1 (202) 555-0199"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <Send className="w-3.5 h-3.5 text-sky-500" />
                <span>Telegram Channel / Dispatch</span>
              </label>
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="https://t.me/newsdiscover or @newsdiscover"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>WhatsApp Tips Hotline</span>
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="https://wa.me/12025550199 or number"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>Physical Headquarters / Press Bureau Address</span>
              </label>
              <input
                type="text"
                value={deskAddress}
                onChange={(e) => setDeskAddress(e.target.value)}
                placeholder="Press Hall, 500 Global Media Plaza, Washington, DC"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* AdSense & Custom Ad Code */}
        <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-700" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-950">
              Google AdSense / Custom Ad Code
            </h4>
          </div>
          <p className="text-xs text-emerald-900">
            Paste only trusted code from Google AdSense or another verified advertising provider. Head code is injected into &lt;head&gt;; body code is injected near the end of &lt;body&gt;.
          </p>
          <textarea
            value={adsenseHeadCode}
            onChange={(e) => setAdsenseHeadCode(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={'<script async src="https://pagead2.googlesyndication.com/..."></script>'}
            className="w-full px-3 py-2 text-xs font-mono border border-emerald-300 rounded-lg bg-white"
          />
          <textarea
            value={adsenseBodyCode}
            onChange={(e) => setAdsenseBodyCode(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={'<ins class="adsbygoogle" ...></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>'}
            className="w-full px-3 py-2 text-xs font-mono border border-emerald-300 rounded-lg bg-white"
          />
        </div>

        {/* Hourly Fetch Limit */}
        <div className="p-4 bg-violet-50/60 border border-violet-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-violet-700" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-violet-950">
              Articles Per Source Per Hour
            </h4>
          </div>
          <p className="text-xs text-violet-900">
            Controls the maximum number of fresh articles imported from each active source during one hourly crawl. The crawler still ignores articles older than 60 minutes and duplicates.
          </p>
          <input
            type="number"
            min={1}
            max={20}
            value={articlesPerSourcePerHour}
            onChange={(e) => setArticlesPerSourcePerHour(Math.max(1, Math.min(20, Number(e.target.value || 1))))}
            className="w-32 px-3 py-2 text-sm font-bold border border-violet-300 rounded-lg bg-white"
          />
        </div>

        {/* Governance & Automation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Moderation Policy */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Reader Comment Policy
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="commentMod"
                  value="strict_approval"
                  checked={commentMod === 'strict_approval'}
                  onChange={() => setCommentMod('strict_approval')}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Strict Pre-Approval</span>
                  <span className="text-[11px] text-slate-500">
                    All reader submissions are held in queue until manually reviewed and approved by an editor.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="commentMod"
                  value="auto_approve"
                  checked={commentMod === 'auto_approve'}
                  onChange={() => setCommentMod('auto_approve')}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Automated Spam Filter</span>
                  <span className="text-[11px] text-slate-500">
                    Non-spam comments publish instantly with post-moderation capability.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Automation Toggles */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Automation Toggles
            </label>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <label className="flex items-center justify-between cursor-pointer text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">RSS Scheduled Ingest</span>
                  <span className="text-[11px] text-slate-500">Allow background cron jobs to fetch wire feeds</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoIngest}
                  onChange={(e) => setAutoIngest(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
              </label>

            </div>
          </div>
        </div>
      </form>

      <HeroSliderManager settings={settings} onUpdateSettings={onUpdateSettings} />

      {/* Source-derived SEO metadata */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-sky-800/40 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-sky-400" />
          <h3 className="font-bold text-base">Automatic source-derived SEO metadata</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Gemini is no longer required for automated ingestion. Every fetched article receives a clean meta title, meta description, slug, keywords, original image metadata, publication date, and sitemap entry derived from the source headline, description, and article text.
        </p>
      </div>

      {/* Live Syndication Endpoints verification */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="font-bold text-base text-slate-900 mb-2">
          Public SEO & Syndication Feed Health
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          These endpoints are generated dynamically from Appwrite and update as soon as published articles are stored.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <a
            href="/news-sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-xl transition-all flex items-center justify-between group"
          >
            <div>
              <span className="font-bold text-slate-900 block group-hover:text-sky-700">Google News Sitemap</span>
              <span className="text-[10px] text-slate-500 font-mono">/news-sitemap.xml</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
          </a>

          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-xl transition-all flex items-center justify-between group"
          >
            <div>
              <span className="font-bold text-slate-900 block group-hover:text-sky-700">Standard Sitemap</span>
              <span className="text-[10px] text-slate-500 font-mono">/sitemap.xml</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
          </a>

          <a
            href="/rss.xml?lang=en"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-xl transition-all flex items-center justify-between group"
          >
            <div>
              <span className="font-bold text-slate-900 block group-hover:text-sky-700">RSS 2.0 Feed (EN)</span>
              <span className="text-[10px] text-slate-500 font-mono">/rss.xml</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
          </a>

          <a
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-xl transition-all flex items-center justify-between group"
          >
            <div>
              <span className="font-bold text-slate-900 block group-hover:text-sky-700">Robots Protocol</span>
              <span className="text-[10px] text-slate-500 font-mono">/robots.txt</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
          </a>
        </div>
      </div>

      {/* Automation Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Automation Execution Logs
            </span>
          </div>
          <button onClick={onRefreshLogs} className="text-xs text-sky-700 hover:underline cursor-pointer">
            Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">Job / Source</th>
                <th className="py-2.5 px-4 text-start font-semibold">Started</th>
                <th className="py-2.5 px-4 text-start font-semibold">Status</th>
                <th className="py-2.5 px-4 text-start font-semibold">Imported</th>
                <th className="py-2.5 px-4 text-start font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No automation logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{log.source}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          log.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{log.importedCount} articles</td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] truncate max-w-xs">
                      {log.errorMessage || 'Completed successfully'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
