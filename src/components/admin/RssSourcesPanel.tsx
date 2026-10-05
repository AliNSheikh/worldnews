import React, { useState } from 'react';
import { Rss, CheckCircle2, AlertCircle, RefreshCw, Plus, Play, Shield, ShieldCheck, Globe, Trash2, Sparkles, Video, Camera, Archive, Pencil } from 'lucide-react';
import { NewsSource, Category } from '../../types';

interface RssSourcesPanelProps {
  sources: NewsSource[];
  categories: Category[];
  onRefreshSources: () => void;
}

export const RssSourcesPanel: React.FC<RssSourcesPanelProps> = ({
  sources,
  categories,
  onRefreshSources,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [fixingMedia, setFixingMedia] = useState(false);
  const [testResult, setTestResult] = useState<{ sourceId: string; message: string; success: boolean } | null>(null);
  const [pipelineResult, setPipelineResult] = useState<string | null>(null);

  // New source form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');
  const [newCategory, setNewCategory] = useState('world');
  const [newTrustLevel, setNewTrustLevel] = useState<NewsSource['trustLevel']>('verified');
  const [newInterval, setNewInterval] = useState(60);

  const handleTestSource = async (id: string) => {
    try {
      setTestingId(id);
      setTestResult(null);
      const res = await fetch(`/api/sources/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult({
        sourceId: id,
        message: data.message || 'Connection verified',
        success: res.ok,
      });
    } catch {
      setTestResult({
        sourceId: id,
        message: 'Connection failed to reach external endpoint.',
        success: false,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleImportSource = async (id: string) => {
    try {
      setImportingId(id);
      const res = await fetch(`/api/sources/${id}/import`, { method: 'POST' });
      const data = await res.json();
      setPipelineResult(data.logMessage || `Ingested fresh dispatches.`);
      onRefreshSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPipelineResult(`Import error: ${msg}`);
    } finally {
      setImportingId(null);
    }
  };

  const handleRunFullPipeline = async () => {
    try {
      setRunningAll(true);
      setPipelineResult(null);
      const res = await fetch('/api/automation/run', { method: 'POST' });
      const data = await res.json();
      setPipelineResult(data.logMessage || 'Full scheduled ingestion pipeline completed.');
      onRefreshSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPipelineResult(`Pipeline error: ${msg}`);
    } finally {
      setRunningAll(false);
    }
  };

  const handleAutoFixAllMedia = async () => {
    try {
      setFixingMedia(true);
      setPipelineResult(null);
      const res = await fetch('/api/media/auto-fix-all-media', { method: 'POST' });
      const data = await res.json();
      setPipelineResult(data.message || `Media & archival audit complete: resolved official images, descriptions & preservation snapshots.`);
      onRefreshSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPipelineResult(`Media & archival audit error: ${msg}`);
    } finally {
      setFixingMedia(false);
    }
  };

  const resetSourceForm = () => {
    setEditingId(null);
    setNewName('');
    setNewRssUrl('');
    setNewCategory('world');
    setNewTrustLevel('verified');
    setNewInterval(60);
    setShowAddForm(false);
  };

  const startEditSource = (source: NewsSource) => {
    setEditingId(source.id);
    setNewName(source.name);
    setNewRssUrl(source.rssUrl);
    setNewCategory(source.category || 'world');
    setNewTrustLevel(source.trustLevel);
    setNewInterval(Math.max(60, source.fetchIntervalMinutes || 60));
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newRssUrl.trim()) return;

    try {
      const existing = editingId ? sources.find((source) => source.id === editingId) : null;
      const res = await fetch(editingId ? `/api/sources/${editingId}` : '/api/sources', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          rssUrl: newRssUrl.trim(),
          category: newCategory,
          trustLevel: newTrustLevel,
          isActive: existing?.isActive ?? true,
          fetchIntervalMinutes: Math.max(60, newInterval),
          language: existing?.language || 'en',
          articlesCount: existing?.articlesCount || 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to save source');
      resetSourceForm();
      onRefreshSources();
    } catch (err) {
      console.error('Failed to save source:', err);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to remove this wire source?')) return;
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      onRefreshSources();
    } catch (err) {
      console.error('Failed to delete source:', err);
    }
  };

  const toggleSourceActive = async (source: NewsSource) => {
    try {
      await fetch(`/api/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      onRefreshSources();
    } catch (err) {
      console.error('Failed to toggle source active status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Pipeline Trigger */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Rss className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base sm:text-lg">
              Automated Wire Ingestion Pipeline
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Simulates and executes automated external scheduled cron jobs. Connects to verified RSS sources, filters duplicates, drafts multilingual articles, and pushes directly to review or live feeds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleAutoFixAllMedia}
            disabled={fixingMedia}
            title="Ingest missing official descriptions, official photos with anti-hotlink protection, and generate cryptographic archive records"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${fixingMedia ? 'animate-spin' : ''}`} />
            <span>{fixingMedia ? 'Archiving & Syncing...' : 'Archive Site & Sync Media'}</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Source</span>
          </button>

          <button
            id="run-full-pipeline-btn"
            onClick={handleRunFullPipeline}
            disabled={runningAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Play className={`w-3.5 h-3.5 ${runningAll ? 'animate-spin' : ''}`} />
            <span>{runningAll ? 'Running Ingestion...' : 'Run Full Pipeline Now'}</span>
          </button>
        </div>
      </div>

      {pipelineResult && (
        <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
            <span>{pipelineResult}</span>
          </div>
          <button onClick={() => setPipelineResult(null)} className="text-slate-400 hover:text-slate-600">
            Dismiss
          </button>
        </div>
      )}

      {/* Add Source Form */}
      {showAddForm && (
        <form onSubmit={handleAddSource} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
          <h4 className="text-sm font-bold text-slate-900">{editingId ? 'Edit RSS Wire Source' : 'Configure New RSS Wire Source'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Agence France-Presse Wire"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">RSS Endpoint URL *</label>
              <input
                type="url"
                required
                value={newRssUrl}
                onChange={(e) => setNewRssUrl(e.target.value)}
                placeholder="https://feed.domain.com/rss"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.names.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trust Tier</label>
              <select
                value={newTrustLevel}
                onChange={(e) => setNewTrustLevel(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="verified">Verified (Direct Ingest & Fast-track)</option>
                <option value="standard">Standard (Requires Editorial Review)</option>
                <option value="untrusted">Untrusted (Drafts Only)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetSourceForm}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded-lg"
            >
              {editingId ? 'Update Source' : 'Save Source'}
            </button>
          </div>
        </form>
      )}

      {/* Sources List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Configured Wire Feeds ({sources.length})
          </span>
          <button
            onClick={onRefreshSources}
            className="flex items-center gap-1 text-xs text-sky-700 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {sources.map((src) => {
            const isTesting = testingId === src.id;
            const isImporting = importingId === src.id;
            const hasTestNotice = testResult?.sourceId === src.id;

            return (
              <div key={src.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Source Meta */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base text-slate-900">
                        {src.name}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          src.trustLevel === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : src.trustLevel === 'standard'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {src.trustLevel}
                      </span>
                      {!src.isActive && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                          Paused
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 font-mono truncate">
                      {src.rssUrl}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span>Category: <strong className="text-slate-700 uppercase">{src.category}</strong></span>
                      <span>•</span>
                      <span>Cadence: Every {src.fetchIntervalMinutes}m</span>
                      <span>•</span>
                      <span>Articles: {src.articlesCount || 0}</span>
                      {src.lastImport && (
                        <>
                          <span>•</span>
                          <span>Last sync: {new Date(src.lastImport).toLocaleTimeString()}</span>
                        </>
                      )}
                    </div>

                    {src.lastError && (
                      <p className="text-[11px] text-red-600 flex items-center gap-1 pt-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Recent notice: {src.lastError}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTestSource(src.id)}
                      disabled={isTesting}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {isTesting ? 'Testing...' : 'Test Feed'}
                    </button>

                    <button
                      onClick={() => handleImportSource(src.id)}
                      disabled={isImporting}
                      className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {isImporting ? 'Ingesting...' : 'Import Now'}
                    </button>

                    <button
                      onClick={() => startEditSource(src)}
                      className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit wire feed"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleSourceActive(src)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        src.isActive
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {src.isActive ? 'Pause' : 'Resume'}
                    </button>

                    <button
                      onClick={() => handleDeleteSource(src.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove wire feed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {hasTestNotice && (
                  <div
                    className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
