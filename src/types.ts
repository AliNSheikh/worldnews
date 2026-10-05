export type LanguageCode = 'ar' | 'en' | 'de' | 'es' | 'fr';

export type ArticleStatus = 'published' | 'draft' | 'review' | 'archived' | 'scheduled';
export type EditorialType = 'original' | 'staff' | 'ai-assisted' | 'external' | 'opinion' | 'analysis';
export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'spam';
export type AdminRole = 'Administrator' | 'Editor' | 'Reviewer';

export interface Category {
  id: string;
  slug: string;
  names: Record<LanguageCode, string>;
  descriptions: Record<LanguageCode, string>;
  sortOrder: number;
  isVisible: boolean;
  inNavigation: boolean;
  color?: string;
  iconName?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ArticleTranslation {
  language: LanguageCode;
  title: string;
  slug: string;
  executiveSummary: string;
  structuredBody: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  tags?: string[];
  imageAlt: string;
  faq: FAQItem[];
  translationStatus: 'complete' | 'draft' | 'needs-review';
  entities: string[];
  corrections?: string;
}

export interface ArticleArchiveSnapshot {
  archiveId: string;
  archivedAt: string;
  sourceUrl: string;
  sourceAgency: string;
  originalHeadline: string;
  originalDescription: string;
  verifiedHash: string;
  status: 'permanently-archived' | 'live-synced';
  legalBasis: string;
}

export interface Article {
  id: string;
  category: string; // category slug
  editorialType: EditorialType;
  originalSource: string;
  originalUrl: string;
  originalDescription?: string;
  officialImageUrl?: string;
  archiveSnapshot?: ArticleArchiveSnapshot;
  image: string;
  imageCredit: string;
  imageProvenance: string;
  imageLicense: string;
  status: ArticleStatus;
  isBreaking: boolean;
  isPinned: boolean;
  priority: number; // 1-10
  views: number;
  shares: number;
  publishedAt: string;
  updatedAt: string;
  scheduledAt?: string;
  byline: string;
  translations: Record<LanguageCode, ArticleTranslation>;
  hasVideo?: boolean;
  videoUrl?: string;
  videoIframeUrl?: string;
  videoThumbnail?: string; // Screenshot of the video
}

export interface Comment {
  id: string;
  articleId: string;
  authorName: string;
  content: string;
  moderationStatus: CommentStatus;
  createdAt: string;
  language: LanguageCode;
}

export interface NewsSource {
  id: string;
  name: string;
  rssUrl: string;
  category: string;
  defaultLanguage?: LanguageCode;
  language?: string;
  trustLevel: 'verified' | 'partner' | 'standard' | 'unverified' | 'untrusted';
  isActive: boolean;
  lastImport: string | null;
  lastError: string | null;
  importFrequency?: string;
  fetchIntervalMinutes?: number;
  articlesCount: number;
}

export interface AutomationLog {
  id: string;
  jobType: 'rss_sync' | 'ai_editorial_generation' | 'sitemap_rebuild' | 'translation_sync';
  source: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'failed' | 'warning';
  errorMessage: string | null;
  importedCount: number;
}

export interface SiteSettings {
  names: Record<LanguageCode, string>;
  descriptions: Record<LanguageCode, string>;
  logoText: string;
  defaultLanguage: LanguageCode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  breakingColor: string;
  contactInfo: {
    email: string;
    phone: string;
    address: string;
  };
  socialLinks: {
    twitter: string;
    facebook: string;
    linkedin: string;
    telegram: string;
    whatsapp: string;
  };
  footerText: Record<LanguageCode, string>;
  commentModeration: 'auto_review' | 'strict_approval' | 'auto_approve';
  autoIngestEnabled?: boolean;
  aiAssistanceEnabled?: boolean;
  editorialStatement: Record<LanguageCode, string>;
  googleSearchConsoleVerification: string;
  googleAnalyticsMeasurementId: string;
}

export interface SearchFilters {
  query: string;
  category?: string;
  dateRange?: 'all' | 'today' | 'week' | 'month';
  sortBy?: 'relevance' | 'newest';
}
