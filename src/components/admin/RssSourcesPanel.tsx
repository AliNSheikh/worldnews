import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rss,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Category, NewsSource } from '../../types';

interface RssSourcesPanelProps {
  sources: NewsSource[];
  categories: Category[];
  onRefreshSources: () => void;
}

type SourceDraft = {
  name: string;
  rssUrl: string;
  category: string;
  trustLevel: NewsSource['trustLevel'];
  fetchIntervalMinutes: number;
  defaultLanguage: string;
};

function apiErrorMessage(payload: any, status: number): string {
  const nested = payload?.error;

  if (typeof nested === 'string' && nested.trim()) {
    return payload?.stage ? `${payload.stage}: ${nested}` : nested;
  }

  if (nested && typeof nested === 'object') {
    const message =
      (typeof nested.message === 'string' && nested.message.trim()) ||
      (typeof nested.name === 'string' && nested.name.trim()) ||
      JSON.stringify(nested);

    return payload?.stage ? `${payload.stage}: ${message}` : message;
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload?.stage ? `${payload.stage}: ${payload.message}` : payload.message;
  }

  return `Request failed with HTTP ${status}.`;
}

async function readApiResponse(res: Response): Promise<any> {
  const raw = await res.text();
  let payload: any = {};

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { error: raw };
    }
  }

  if (!res.ok) {
    throw new Error(apiErrorMessage(payload, res.status));
  }

  return payload;
}

function sourceToDraft(source: NewsSource): SourceDraft {
  return {
    name: source.name,
    rssUrl: source.rssUrl,
    category: source.category || 'world',
    trustLevel: source.trustLevel || 'verified',
    fetchIntervalMinutes: source.fetchIntervalMinutes || 60,
    defaultLanguage: source.defaultLanguage || 'en',
  };
}

export const RssSourcesPanel: React.FC<RssSourcesPanelProps> = ({
  sources,
  categories,
  onRefreshSources,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [fixingMedia, setFixingMedia] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SourceDraft | null>(null);
  const [testResult, setTestResult] = useState<{
    sourceId: string;
    message: string;
    success: boolean;
  } | null>(null);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [newName, setNewName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');
  const [newCategory, setNewCategory] = useState('world');
  const [newTrustLevel, setNewTrustLevel] = useState<NewsSource['trustLevel']>('verified');
  const [newInterval, setNewInterval] = useState(60);

  const refreshSources = async () => {
    await Promise.resolve(onRefreshSources());
  };

  const handleTestSource = async (id: string) => {
    try {
      setTestingId(id);
      setTestResult(null);
      const res = await fetch(`/api/sources/${encodeURIComponent(id)}/test`, {
        method: 'POST',
      });
      const data = await readApiResponse(res);
      setTestResult({
        sourceId: id,
        message: data.message || 'Connection verified.',
        success: true,
      });
    } catch (error: unknown) {
      setTestResult({
        sourceId: id,
        message: error instanceof Error ? error.message : String(error),
        success: false,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleImportSource = async (id: string) => {
    try {
      setImportingId(id);
      setNotice(null);
      const res = await fetch(`/api/sources/${encodeURIComponent(id)}/import`, {
        method: 'POST',
      });
      const data = await readApiResponse(res);
      setNotice({
        type: 'success',
        message:
          data.logMessage ||
          data.message ||
          `Import completed and persisted ${data.count || 0} article(s).`,
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setImportingId(null);
    }
  };

  const handleRunFullPipeline = async () => {
    try {
      setRunningAll(true);
      setNotice(null);
      const res = await fetch('/api/automation/run', { method: 'POST' });
      const data = await readApiResponse(res);
      setNotice({
        type: data.success === false ? 'error' : 'success',
        message:
          data.message ||
          data.logMessage ||
          `Crawler completed and persisted ${data.newArticlesCount || data.count || 0} article(s).`,
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Crawler failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setRunningAll(false);
    }
  };

  const handleAutoFixAllMedia = async () => {
    try {
      setFixingMedia(true);
      setNotice(null);
      const res = await fetch('/api/media/auto-fix-all-media', { method: 'POST' });
      const data = await readApiResponse(res);
      setNotice({
        type: 'success',
        message:
          data.message ||
          'Media and archival audit completed and synchronized.',
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Media synchronization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      setFixingMedia(false);
    }
  };

  const handleAddSource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || !newRssUrl.trim()) return;

    try {
      setMutatingId('new');
      setNotice(null);
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          rssUrl: newRssUrl.trim(),
          category: newCategory,
          trustLevel: newTrustLevel,
          isActive: true,
          fetchIntervalMinutes: newInterval,
          defaultLanguage: 'en',
          language: 'en',
          articlesCount: 0,
        }),
      });
      const created = await readApiResponse(res);

      setNewName('');
      setNewRssUrl('');
      setNewCategory('world');
      setNewTrustLevel('verified');
      setNewInterval(60);
      setShowAddForm(false);
      setNotice({
        type: 'success',
        message: `Source “${created.name || newName}” was saved to Turso.`,
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Unable to add source: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setMutatingId(null);
    }
  };

  const beginEdit = (source: NewsSource) => {
    setEditingId(source.id);
    setEditDraft(sourceToDraft(source));
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleSaveEdit = async (source: NewsSource) => {
    if (!editDraft || !editDraft.name.trim() || !editDraft.rssUrl.trim()) return;

    try {
      setMutatingId(source.id);
      setNotice(null);
      const res = await fetch(`/api/sources/${encodeURIComponent(source.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editDraft,
          name: editDraft.name.trim(),
          rssUrl: editDraft.rssUrl.trim(),
        }),
      });
      const updated = await readApiResponse(res);
      setEditingId(null);
      setEditDraft(null);
      setNotice({
        type: 'success',
        message: `Source “${updated.name || source.name}” was updated in Turso.`,
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Unable to update source: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setMutatingId(null);
    }
  };

  const handleDeleteSource = async (source: NewsSource) => {
    if (!confirm(`Remove “${source.name}” from the persistent source database?`)) return;

    try {
      setMutatingId(source.id);
      setNotice(null);
      const res = await fetch(`/api/sources/${encodeURIComponent(source.id)}`, {
        method: 'DELETE',
      });
      await readApiResponse(res);
      setNotice({
        type: 'success',
        message: `Source “${source.name}” was deleted from Turso.`,
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Unable to delete source: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setMutatingId(null);
    }
  };

  const toggleSourceActive = async (source: NewsSource) => {
    try {
      setMutatingId(source.id);
      setNotice(null);
      const res = await fetch(`/api/sources/${encodeURIComponent(source.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      await readApiResponse(res);
      setNotice({
        type: 'success',
        message: `${source.name} is now ${source.isActive ? 'paused' : 'active'}.`,
      });
      await refreshSources();
    } catch (error: unknown) {
      setNotice({
        type: 'error',
        message: `Unable to change source status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Rss className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base sm:text-lg">Automated Wire Ingestion Pipeline</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Sources are stored in Turso. A source change is only reported as successful after the database confirms the write.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleAutoFixAllMedia}
            disabled={fixingMedia}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${fixingMedia ? 'animate-spin' : ''}`} />
            <span>{fixingMedia ? 'Syncing...' : 'Sync Media'}</span>
          </button>

          <button
            onClick={() => setShowAddForm((value) => !value)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Source</span>
          </button>

          <button
            onClick={handleRunFullPipeline}
            disabled={runningAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${runningAll ? 'animate-spin' : ''}`} />
            <span>{runningAll ? 'Running...' : 'Run AI Crawler'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            notice.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          {notice.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{notice.message}</span>
          <button onClick={() => setNotice(null)} className="text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddSource}
          className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4"
        >
          <h4 className="text-sm font-bold text-slate-900">Configure New RSS Wire Source</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <input
              type="text"
              required
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Source name"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            />
            <input
              type="url"
              required
              value={newRssUrl}
              onChange={(event) => setNewRssUrl(event.target.value)}
              placeholder="https://domain.com/rss.xml"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg lg:col-span-2"
            />
            <select
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.names.en}
                </option>
              ))}
            </select>
            <select
              value={newTrustLevel}
              onChange={(event) => setNewTrustLevel(event.target.value as NewsSource['trustLevel'])}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="verified">Verified</option>
              <option value="partner">Partner</option>
              <option value="standard">Standard</option>
              <option value="untrusted">Untrusted</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-slate-600">
              Fetch every{' '}
              <input
                type="number"
                min={5}
                max={1440}
                value={newInterval}
                onChange={(event) => setNewInterval(Number(event.target.value))}
                className="w-20 mx-1 px-2 py-1 border border-slate-300 rounded"
              />
              minutes
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutatingId === 'new'}
                className="px-4 py-1.5 text-xs font-bold bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 text-white rounded-lg"
              >
                {mutatingId === 'new' ? 'Saving...' : 'Save Source'}
              </button>
            </div>
          </div>
        </form>
      )}

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
          {sources.map((source) => {
            const isTesting = testingId === source.id;
            const isImporting = importingId === source.id;
            const isMutating = mutatingId === source.id;
            const isEditing = editingId === source.id && editDraft;
            const hasTestNotice = testResult?.sourceId === source.id;

            return (
              <div key={source.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <input
                        value={editDraft.name}
                        onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <input
                        type="url"
                        value={editDraft.rssUrl}
                        onChange={(event) => setEditDraft({ ...editDraft, rssUrl: event.target.value })}
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg lg:col-span-2"
                      />
                      <select
                        value={editDraft.category}
                        onChange={(event) => setEditDraft({ ...editDraft, category: event.target.value })}
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.slug}>
                            {category.names.en}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editDraft.trustLevel}
                        onChange={(event) =>
                          setEditDraft({
                            ...editDraft,
                            trustLevel: event.target.value as NewsSource['trustLevel'],
                          })
                        }
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="verified">Verified</option>
                        <option value="partner">Partner</option>
                        <option value="standard">Standard</option>
                        <option value="untrusted">Untrusted</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEdit} className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg">
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(source)}
                        disabled={isMutating}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 disabled:bg-slate-400 text-white rounded-lg"
                      >
                        {isMutating ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900">{source.name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            source.trustLevel === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : source.trustLevel === 'standard'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {source.trustLevel}
                        </span>
                        {!source.isActive && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                            Paused
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 font-mono break-all">{source.rssUrl}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>
                          Category: <strong className="text-slate-700 uppercase">{source.category}</strong>
                        </span>
                        <span>•</span>
                        <span>Cadence: Every {source.fetchIntervalMinutes || 60}m</span>
                        <span>•</span>
                        <span>Articles: {source.articlesCount || 0}</span>
                        {source.lastImport && (
                          <>
                            <span>•</span>
                            <span>Last sync: {new Date(source.lastImport).toLocaleString()}</span>
                          </>
                        )}
                      </div>
                      {source.lastError && (
                        <p className="text-[11px] text-red-600 flex items-center gap-1 pt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>{source.lastError}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        onClick={() => handleTestSource(source.id)}
                        disabled={isTesting || isMutating}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50"
                      >
                        {isTesting ? 'Testing...' : 'Test Feed'}
                      </button>
                      <button
                        onClick={() => handleImportSource(source.id)}
                        disabled={isImporting || isMutating}
                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-lg disabled:opacity-50"
                      >
                        {isImporting ? 'Importing...' : 'Import Now'}
                      </button>
                      <button
                        onClick={() => toggleSourceActive(source)}
                        disabled={isMutating}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${
                          source.isActive
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {source.isActive ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => beginEdit(source)}
                        disabled={isMutating}
                        className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg"
                        title="Edit source"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSource(source)}
                        disabled={isMutating}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Delete source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

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

          {sources.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No persistent RSS sources are currently stored in Turso.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
