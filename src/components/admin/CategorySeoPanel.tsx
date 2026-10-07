import React, { useMemo, useState } from 'react';
import { Category } from '../../types';

interface CategorySeoPanelProps {
  categories: Category[];
  onRefreshCategories: () => void;
}

export const CategorySeoPanel: React.FC<CategorySeoPanelProps> = ({
  categories,
  onRefreshCategories,
}) => {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );
  const [selectedId, setSelectedId] = useState(sorted[0]?.id || '');
  const selected = sorted.find((category) => category.id === selectedId) || sorted[0];
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState(() => ({
    seoTitle: selected?.seoTitle || '',
    seoDescription: selected?.seoDescription || '',
    seoKeywords: (selected?.seoKeywords || []).join(', '),
    seoNoIndex: Boolean(selected?.seoNoIndex),
  }));

  const selectCategory = (id: string) => {
    setSelectedId(id);
    const category = sorted.find((item) => item.id === id);
    setForm({
      seoTitle: category?.seoTitle || '',
      seoDescription: category?.seoDescription || '',
      seoKeywords: (category?.seoKeywords || []).join(', '),
      seoNoIndex: Boolean(category?.seoNoIndex),
    });
    setMessage('');
  };

  if (!selected) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6">No categories are available.</div>;
  }

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/categories/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seoTitle: form.seoTitle.trim(),
          seoDescription: form.seoDescription.trim(),
          seoKeywords: form.seoKeywords
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean)
            .slice(0, 20),
          seoNoIndex: form.seoNoIndex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save category SEO settings.');
      setMessage('Category SEO settings saved.');
      onRefreshCategories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      <aside className="bg-white border border-slate-200 rounded-xl p-3 h-fit">
        <div className="text-xs font-black uppercase tracking-wider text-slate-500 px-2 py-2">
          Category SEO
        </div>
        <div className="space-y-1">
          {sorted.map((category) => (
            <button
              key={category.id}
              onClick={() => selectCategory(category.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                selected.id === category.id
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {category.names.en || category.slug}
            </button>
          ))}
        </div>
      </aside>

      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-900">
            {selected.names.en || selected.slug}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Control the title, description, keywords, and indexing directive for this category page.
          </p>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="text-xs font-bold text-slate-700">SEO title</span>
            <input
              value={form.seoTitle}
              onChange={(e) => setForm((value) => ({ ...value, seoTitle: e.target.value }))}
              maxLength={80}
              placeholder={`${selected.names.en || selected.slug} News | World News`}
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <span className="text-[11px] text-slate-400">{form.seoTitle.length}/80</span>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-700">Meta description</span>
            <textarea
              value={form.seoDescription}
              onChange={(e) => setForm((value) => ({ ...value, seoDescription: e.target.value }))}
              maxLength={180}
              rows={4}
              placeholder={selected.descriptions.en}
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <span className="text-[11px] text-slate-400">{form.seoDescription.length}/180</span>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-700">SEO keywords</span>
            <input
              value={form.seoKeywords}
              onChange={(e) => setForm((value) => ({ ...value, seoKeywords: e.target.value }))}
              placeholder="world news, diplomacy, geopolitics"
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <span className="text-[11px] text-slate-400">Separate keywords with commas.</span>
          </label>

          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
            <input
              type="checkbox"
              checked={form.seoNoIndex}
              onChange={(e) => setForm((value) => ({ ...value, seoNoIndex: e.target.checked }))}
            />
            <div>
              <div className="text-sm font-bold text-slate-800">Prevent search indexing</div>
              <div className="text-xs text-slate-500">Adds a noindex directive for this category page.</div>
            </div>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-bold"
            >
              {saving ? 'Saving…' : 'Save category SEO'}
            </button>
            {message && <span className="text-sm text-slate-600">{message}</span>}
          </div>
        </div>
      </section>
    </div>
  );
};
