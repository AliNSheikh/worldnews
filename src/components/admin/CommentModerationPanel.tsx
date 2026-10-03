import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, X, ShieldAlert, RefreshCw, Trash2, Filter } from 'lucide-react';
import { Comment } from '../../types';

export const CommentModerationPanel: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' ? '/api/comments' : `/api/comments?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [statusFilter]);

  const updateStatus = async (commentId: string, status: Comment['moderationStatus']) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, moderationStatus: status } : c))
        );
      }
    } catch (err) {
      console.error('Failed to update comment status:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sky-700" />
            <h3 className="font-bold text-base text-slate-900">
              Reader Comment Moderation Queue
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit submitted remarks, prevent spam and abuse, and uphold civil discourse standards
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 ms-1" />
          {['all', 'pending', 'approved', 'spam', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded font-semibold capitalize transition-colors cursor-pointer ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={fetchComments}
            className="p-1 text-slate-400 hover:text-slate-700 rounded ms-1"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
        {comments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No comments found matching filter criteria.
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900">
                    {comment.authorName}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      comment.moderationStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : comment.moderationStatus === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : comment.moderationStatus === 'spam'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {comment.moderationStatus}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Article: {comment.articleId}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {comment.content}
                </p>
              </div>

              {/* Moderation Actions */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {comment.moderationStatus !== 'approved' && (
                  <button
                    onClick={() => updateStatus(comment.id, 'approved')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                )}

                {comment.moderationStatus !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(comment.id, 'rejected')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}

                {comment.moderationStatus !== 'spam' && (
                  <button
                    onClick={() => updateStatus(comment.id, 'spam')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Mark as Spam"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Spam</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
