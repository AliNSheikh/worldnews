import React, { useState } from 'react';
import {
  Check,
  Globe,
  ChevronDown,
  Mail,
  Phone,
  Send,
  MessageCircle,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { Category, LanguageCode, SiteSettings } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface FooterProps {
  currentLang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  categories: Category[];
  siteSettings: SiteSettings;
  onSelectCategory: (slug: string) => void;
  onOpenCharter: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  currentLang,
  onLanguageChange,
  categories,
  siteSettings,
  onSelectCategory,
  onOpenCharter,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [footerLangOpen, setFooterLangOpen] = useState(false);

  const languages: { code: LanguageCode; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ];
  const currentLangObj = languages.find((l) => l.code === currentLang) || languages[1];

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setNewsletterSubscribed(true);
    }
  };

  const contact = siteSettings.contactInfo || {};
  const social = siteSettings.socialLinks || {};

  // Normalize telegram URL
  const telegramUrl = social.telegram
    ? social.telegram.startsWith('http')
      ? social.telegram
      : `https://t.me/${social.telegram.replace('@', '')}`
    : '';

  // Normalize whatsapp URL
  const whatsappUrl = social.whatsapp
    ? social.whatsapp.startsWith('http')
      ? social.whatsapp
      : `https://wa.me/${social.whatsapp.replace(/[^0-9]/g, '')}`
    : '';

  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12 border-b border-slate-800">
          {/* Brand & Mission column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {siteSettings.names[currentLang] || 'WORLD NEWS'}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 mb-0.5"></span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              {siteSettings.descriptions[currentLang] ||
                'Authoritative 24/7 multilingual digital newsroom delivering verified international reporting, economic intelligence, and deep geopolitical analysis across five languages.'}
            </p>

            {/* Newsletter Subscription */}
            <div className="pt-2">
              <p className="text-xs font-bold text-white mb-2 uppercase tracking-wider">
                {t.dailyDigest}
              </p>
              {newsletterSubscribed ? (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-600/50 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Subscribed to News Discover updates.</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="editor@organization.com"
                    className="px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-500 flex-1"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {t.subscribe}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              {t.categories}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              {categories.slice(0, 7).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onSelectCategory(c.slug)}
                    className="hover:text-sky-400 transition-colors text-slate-400 hover:underline cursor-pointer"
                  >
                    {c.names[currentLang] || c.slug}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsroom Contact Desk with Icons */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Newsroom Contact
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors group"
                >
                  <span className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-sky-400 group-hover:border-sky-500">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{contact.email}</span>
                </a>
              )}

              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors group"
                >
                  <span className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-emerald-400 group-hover:border-emerald-500">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <span>{contact.phone}</span>
                </a>
              )}

              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors group"
                >
                  <span className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-sky-400 group-hover:border-sky-500">
                    <Send className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex items-center gap-1">
                    <span>Telegram Dispatch</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                  </span>
                </a>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors group"
                >
                  <span className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-emerald-400 group-hover:border-emerald-500">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex items-center gap-1">
                    <span>WhatsApp Tips</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                  </span>
                </a>
              )}

              {contact.address && (
                <div className="flex items-start gap-2 pt-1 text-slate-400">
                  <span className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-red-400 shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[11px] leading-relaxed">{contact.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Legacy edition selector hidden: News Discover is English-only. */}
          <div className="hidden">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Editions
            </h4>
            <div className="space-y-3">
              {/* Language Switching Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFooterLangOpen(!footerLangOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-xs text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span>{currentLangObj.flag}</span>
                    <span>{currentLangObj.label}</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${footerLangOpen ? 'rotate-180' : ''}`} />
                </button>

                {footerLangOpen && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-30">
                    {languages.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          onLanguageChange(item.code);
                          setFooterLangOpen(false);
                        }}
                        className={`w-full text-start px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          currentLang === item.code
                            ? 'bg-sky-600/30 text-sky-300 font-bold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.flag}</span>
                          <span>{item.label}</span>
                        </span>
                        {currentLang === item.code && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} {siteSettings.names[currentLang] || 'News Discover'}. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              24/7 Syndicated Wire Operations Active
            </span>
            <span>•</span>
            <button onClick={onOpenCharter} className="hover:underline cursor-pointer">
              Ethics & Corrections
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

