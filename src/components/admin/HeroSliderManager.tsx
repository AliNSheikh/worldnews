import React, { useEffect, useState } from 'react';
import { Image, Plus, Save, Trash2, Video } from 'lucide-react';
import { HeroSlide, LanguageCode, SiteSettings } from '../../types';

interface HeroSliderManagerProps {
  settings: SiteSettings;
  onUpdateSettings: (updates: Partial<SiteSettings>) => Promise<void>;
}

const LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
];

function emptySlide(order: number): HeroSlide {
  return {
    id: `hero-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    enabled: true,
    headline: { en: '' },
    mediaType: 'image',
    mediaUrl: '',
    buttonLabel: { en: 'Learn more' },
    buttonUrl: '',
    sortOrder: order,
  };
}

export const HeroSliderManager: React.FC<HeroSliderManagerProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [slides, setSlides] = useState<HeroSlide[]>(settings.heroSlides || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSlides(settings.heroSlides || []);
  }, [settings.heroSlides]);

  const patchSlide = (id: string, patch: Partial<HeroSlide>) => {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)));
  };

  const patchLocalized = (
    id: string,
    field: 'headline' | 'buttonLabel',
    lang: LanguageCode,
    value: string
  ) => {
    setSlides((current) =>
      current.map((slide) =>
        slide.id === id
          ? {
              ...slide,
              [field]: {
                ...slide[field],
                [lang]: value,
              },
            }
          : slide
      )
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalized = slides.map((slide, index) => ({ ...slide, sortOrder: index }));
      await onUpdateSettings({ heroSlides: normalized });
      setSlides(normalized);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900">Hero Slider & Sponsored Features</h3>
          <p className="text-xs text-slate-500 mt-1">
            Add manual image/video campaigns. When no active slide exists, the homepage automatically falls back to the latest articles.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSlides((current) => [...current, emptySlide(current.length)])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            Add slide
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save slides'}
          </button>
        </div>
      </div>

      {slides.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No manual Hero Slider is configured. Latest published articles will be used.
        </div>
      ) : (
        <div className="space-y-5">
          {slides.map((slide, index) => (
            <article key={slide.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {slide.mediaType === 'video' ? <Video className="w-4 h-4" /> : <Image className="w-4 h-4" />}
                  <span className="text-xs font-extrabold text-slate-800">Slide {index + 1}</span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={slide.enabled}
                      onChange={(e) => patchSlide(slide.id, { enabled: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setSlides((current) => current.filter((item) => item.id !== slide.id))}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                  aria-label="Delete slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs font-semibold text-slate-700">
                  Media type
                  <select
                    value={slide.mediaType}
                    onChange={(e) => patchSlide(slide.id, { mediaType: e.target.value as 'image' | 'video' })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                  Image / video URL
                  <input
                    type="url"
                    value={slide.mediaUrl}
                    onChange={(e) => patchSlide(slide.id, { mediaUrl: e.target.value })}
                    placeholder="https://cdn.example.com/campaign.jpg"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LANGUAGES.map(({ code, label }) => (
                  <label key={code} className="text-xs font-semibold text-slate-700">
                    Headline · {label}
                    <input
                      type="text"
                      dir={code === 'ar' ? 'rtl' : 'ltr'}
                      value={slide.headline?.[code] || ''}
                      onChange={(e) => patchLocalized(slide.id, 'headline', code, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-700">
                  Click URL
                  <input
                    type="url"
                    value={slide.buttonUrl}
                    onChange={(e) => patchSlide(slide.id, { buttonUrl: e.target.value })}
                    placeholder="https://advertiser.example/landing-page"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LANGUAGES.slice(0, 2).map(({ code, label }) => (
                    <label key={code} className="text-xs font-semibold text-slate-700">
                      Button · {label}
                      <input
                        type="text"
                        dir={code === 'ar' ? 'rtl' : 'ltr'}
                        value={slide.buttonLabel?.[code] || ''}
                        onChange={(e) => patchLocalized(slide.id, 'buttonLabel', code, e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
