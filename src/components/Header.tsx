import React, { useState, useRef, useEffect } from 'react';
import { Globe, Search, ShieldCheck, Menu, X, ArrowRight, ChevronDown, Check } from 'lucide-react';
import { Category, LanguageCode, SiteSettings } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface HeaderProps {
  currentLang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
  categories: Category[];
  siteSettings: SiteSettings;
  onOpenSearch: () => void;
  onOpenCharter: () => void;
  onHomeClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLang,
  onLanguageChange,
  selectedCategory,
  onSelectCategory,
  categories,
  siteSettings,
  onOpenSearch,
  onOpenCharter,
  onHomeClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const isRtl = currentLang === 'ar';

  const allLanguages: { code: LanguageCode; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ];
  const enabledSet = new Set(siteSettings.enabledLanguages || allLanguages.map((item) => item.code));
  const languages = allLanguages.filter((item) => enabledSet.has(item.code));
  const currentLangObj =
    languages.find((l) => l.code === currentLang) ||
    allLanguages.find((l) => l.code === currentLang) ||
    languages[0] ||
    allLanguages[1];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentDateFormatted = new Intl.DateTimeFormat(
    currentLang === 'ar' ? 'ar-EG' : currentLang === 'de' ? 'de-DE' : currentLang === 'es' ? 'es-ES' : currentLang === 'fr' ? 'fr-FR' : 'en-US',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  ).format(new Date());

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
      {/* Top utility row */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-200">{currentDateFormatted}</span>
            <span className="hidden md:inline-block text-slate-500">|</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {t.verifiedReporting}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Editorial Charter link */}
            <button
              id="header-charter-btn"
              onClick={onOpenCharter}
              className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              title="Editorial Ethics and Verification Principles"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">{t.editorialGuidelines}</span>
            </button>

            {/* English is the only public edition; legacy switcher kept hidden for compatibility. */}
            <div className="hidden" ref={langDropdownRef}>
              <button
                id="header-lang-switcher-btn"
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                aria-expanded={langDropdownOpen}
                aria-haspopup="listbox"
                aria-label="Switch Language"
              >
                <Globe className="w-3.5 h-3.5 text-red-400" />
                <span>{currentLangObj.flag}</span>
                <span>{currentLangObj.label}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Language Dropdown Menu */}
              {langDropdownOpen && (
                <div
                  className="absolute right-0 rtl:right-auto rtl:left-0 mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  role="listbox"
                >
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                    {t.languages || 'Select Language'}
                  </div>
                  {languages.map((item) => {
                    const isSelected = currentLang === item.code;
                    return (
                      <button
                        key={item.code}
                        id={`lang-select-${item.code}`}
                        type="button"
                        onClick={() => {
                          onLanguageChange(item.code);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-red-600/20 text-red-200 font-bold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.flag}</span>
                          <span>{item.label}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-red-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Masthead */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            id="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo / Brand */}
          <button
            id="brand-logo-btn"
            onClick={onHomeClick}
            className="text-start group cursor-pointer"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 group-hover:text-red-700 transition-colors">
                {siteSettings.names[currentLang] || 'WORLD NEWS'}
              </span>
              <span className="hidden sm:inline-block w-2.5 h-2.5 rounded-full bg-red-600 mb-0.5"></span>
            </div>
            <p className="text-xs text-slate-500 font-medium tracking-wide">
              {siteSettings.descriptions[currentLang] || '24/7 International Digital Newsroom'}
            </p>
          </button>
        </div>

        {/* Search trigger & quick actions */}
        <div className="flex items-center gap-3">
          <button
            id="open-search-btn"
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.search}</span>
            <kbd className="hidden md:inline-block text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Primary Category Nav */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 hidden md:flex items-center justify-between overflow-x-auto no-scrollbar">
        <ul className="flex items-center gap-1 py-1">
          <li>
            <button
              id="cat-nav-all"
              onClick={() => onSelectCategory('all')}
              className={`px-3 py-2 text-sm font-semibold transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'border-red-600 text-red-700'
                  : 'border-transparent text-slate-700 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {t.all}
            </button>
          </li>
          {categories
            .filter((c) => c.isVisible)
            .map((cat) => (
              <li key={cat.id}>
                <button
                  id={`cat-nav-${cat.slug}`}
                  onClick={() => onSelectCategory(cat.slug)}
                  className={`px-3 py-2 text-sm font-semibold transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                    selectedCategory === cat.slug
                      ? 'border-red-600 text-red-700'
                      : 'border-transparent text-slate-700 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {cat.names[currentLang] || cat.slug}
                </button>
              </li>
            ))}
        </ul>

        {/* Live Edition indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium py-1">
          <span className="text-slate-400">{t.filterByLanguage}:</span>
          <span className="font-semibold text-slate-700 uppercase">{currentLang}</span>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 animate-in fade-in duration-150">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            {t.categories}
          </p>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => {
                onSelectCategory('all');
                setMobileMenuOpen(false);
              }}
              className={`text-start px-3 py-2 rounded text-sm font-medium ${
                selectedCategory === 'all' ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.all}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.slug);
                  setMobileMenuOpen(false);
                }}
                className={`text-start px-3 py-2 rounded text-sm font-medium ${
                  selectedCategory === cat.slug ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat.names[currentLang] || cat.slug}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-2 flex flex-col gap-1">
            <button
              onClick={() => {
                onOpenCharter();
                setMobileMenuOpen(false);
              }}
              className="text-start px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded flex items-center justify-between"
            >
              <span>{t.editorialGuidelines}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
