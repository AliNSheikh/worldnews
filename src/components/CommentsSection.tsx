import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, CheckCircle2, AlertTriangle, Shield, User } from 'lucide-react';
import { Comment, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { analytics } from '../utils/analytics';

interface CommentsSectionProps {
  articleId: string;
  currentLang: LanguageCode;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ articleId, currentLang }) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
  }, [articleId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/comments?articleId=${articleId}`);
      if (res.ok) {
        const data = await res.json();
        // Show only approved comments on public view
        setComments(data.filter((c: Comment) => c.moderationStatus === 'approved'));
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSubmitSuccess(null);

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          authorName: authorName.trim(),
          content: content.trim(),
          language: currentLang,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit comment');
      }

      analytics.trackCommentSubmission(articleId, authorName.trim());

      if (data.moderationStatus === 'approved') {
        setComments([data, ...comments]);
        setSubmitSuccess(t.commentSuccess);
      } else {
        setSubmitSuccess('Thank you. Your comment has been submitted and is currently queued for editorial moderation.');
      }

      setContent('');
      setAuthorName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 mt-12">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-sky-700" />
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            {t.comments} ({comments.length})
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t.moderationPolicy}</span>
        </div>
      </div>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        {submitSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs sm:text-sm flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs sm:text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.authorName} *
            </label>
            <input
              id="comment-author-input"
              type="text"
              required
              maxLength={60}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. Elena Rostova"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.leaveComment} *
          </label>
          <textarea
            id="comment-content-input"
            required
            rows={3}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your respectful, constructive perspective on this report..."
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {1000 - content.length} characters remaining
          </span>
          <button
            id="submit-comment-btn"
            type="submit"
            disabled={submitting || !authorName.trim() || !content.trim()}
            className="flex items-center gap-1.5 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Submitting...' : t.submitComment}</span>
          </button>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Loading discussion...
        </div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 italic bg-white/60 rounded-lg border border-dashed border-slate-200">
          No reader comments published yet. Be the first to share an observation.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {comment.authorName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] bg-slate-100 text-slate-500 uppercase px-2 py-0.5 rounded font-mono">
                  {comment.language}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed ps-9">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
