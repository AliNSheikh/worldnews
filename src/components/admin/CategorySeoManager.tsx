import React, { useEffect, useState } from 'react';
import { Check, Save, Search } from 'lucide-react';
import { Category } from '../../types';

interface CategorySeoManagerProps {
  categories: Category[];
  onRefreshCategories: () => void;
}

type Draft = {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
};

export const CategorySeoManager: React.FC<CategorySeoManagerProps> = ({
  categories,
  onRefreshCategories,
}) => {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const category of categories) {
      next[category.id] = {
        seoTitle: category.seoTitle || `${category.names.en || category.slug} News | News Discover`,
        seoDescription:
          category.seoDescription ||
          category.descriptions.en ||
          `Latest ${category.names.en || category.slug} news and updates from News Discover.`,
        seoKeywords: (category.seoKeywords || []).join(', '),
      };
    }
    setDrafts(next);
  }, [categories]);

  const update = (id: string, key: keyof Draft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || { seoTitle: '', seoDescription: '', seoKeywords: '' }), [key]: value },
    }));
  };

  const save = async (category: Category) => {
    const draft = drafts[category.id];
    if (!draft) return;
    setSavingId(category.id);
    setError(null);
    try {
      const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seoTitle: draft.seoTitle.trim(),
          seoDescription: draft.seoDescription.trim(),
          seoKeywords: draft.seoKeywords
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 20),
        }),
      });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw }; }
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setSavedId(category.id);
      onRefreshCategories();
      setTimeout(() => setSavedId(null), 1800);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
      <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
        <span className="p-2 bg-sky-50 text-sky-700 rounded-lg">
          <Search className="w-4 h-4" />
        </span>
        <div>
          <h3 className="font-bold text-base text-slate-900">Category SEO Manager</h3>
          <p className="text-xs text-slate-500 mt-1">
            Edit the title, meta description, and target keywords used on each English category page.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
      )}

      <div className="space-y-4">
        {categories.map((category) => {
          const draft = drafts[category.id] || { seoTitle: '', seoDescription: '', seoKeywords: '' };
          return (
            <div key={category.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{category.names.en || category.slug}</h4>
                  <span className="text-[11px] font-mono text-slate-400">/en/category/{category.slug}</span>
                </div>
                <button
                  type="button"
                  disabled={savingId === category.id}
                  onClick={() => save(category)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg"
                >
                  {savedId === category.id ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {savingId === category.id ? 'Saving…' : savedId === category.id ? 'Saved' : 'Save SEO'}
                </button>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">SEO title</label>
                <input
                  value={draft.seoTitle}
                  onChange={(e) => update(category.id, 'seoTitle', e.target.value)}
                  maxLength={70}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <div className="text-[10px] text-slate-400 mt-1">{draft.seoTitle.length}/70</div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Meta description</label>
                <textarea
                  value={draft.seoDescription}
                  onChange={(e) => update(category.id, 'seoDescription', e.target.value)}
                  maxLength={180}
                  rows={3}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y"
                />
                <div className="text-[10px] text-slate-400 mt-1">{draft.seoDescription.length}/180</div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">SEO keywords</label>
                <input
                  value={draft.seoKeywords}
                  onChange={(e) => update(category.id, 'seoKeywords', e.target.value)}
                  placeholder="politics, world news, breaking news"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
