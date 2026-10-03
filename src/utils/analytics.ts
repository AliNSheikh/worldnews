import { LanguageCode } from '../types';

export interface AnalyticsEvent {
  event: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
}

class AnalyticsService {
  private consentGiven = false;
  private trackedScrollMilestones = new Set<number>();
  private gaMeasurementId: string | null = null;
  private gaInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('worldnews_analytics_consent');
      this.consentGiven = stored === 'true';
    }
  }

  public initGoogleAnalytics(measurementId: string) {
    if (!measurementId || typeof window === 'undefined') return;
    this.gaMeasurementId = measurementId.trim();

    // Check if gtag is already loaded or script tag exists
    if (!this.gaInitialized && this.gaMeasurementId) {
      const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`);
      if (!existingScript) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaMeasurementId}`;
        document.head.appendChild(script);

        // Define window.dataLayer and gtag
        const win = window as any;
        win.dataLayer = win.dataLayer || [];
        function gtag(...args: any[]) {
          win.dataLayer.push(args);
        }
        win.gtag = win.gtag || gtag;
        win.gtag('js', new Date());
        win.gtag('config', this.gaMeasurementId, {
          send_page_view: true,
          anonymize_ip: true,
        });
      }
      this.gaInitialized = true;
    }
  }

  public setConsent(allowed: boolean) {
    this.consentGiven = allowed;
    if (typeof window !== 'undefined') {
      localStorage.setItem('worldnews_analytics_consent', allowed ? 'true' : 'false');
    }
  }

  public isConsentGranted(): boolean {
    return this.consentGiven;
  }

  public track(data: AnalyticsEvent) {
    if (!this.consentGiven) {
      // Do not transmit to third parties if consent not given
      return;
    }
    // Dispatched locally or to configured analytics provider (e.g. dataLayer / GA4)
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.dataLayer) {
        win.dataLayer.push(data);
      }
      if (win.gtag && this.gaMeasurementId) {
        const { event, ...params } = data;
        win.gtag('event', event, params);
      }
    }
    // In dev, log cleanly
    if (process.env.NODE_ENV !== 'production') {
      // quiet debug
    }
  }

  public trackArticleView(articleId: string, title: string, category: string, lang: LanguageCode) {
    this.trackedScrollMilestones.clear();
    this.track({
      event: 'article_view',
      articleId,
      title,
      category,
      language: lang,
    });
  }

  public trackScrollDepth(percent: number, articleId: string) {
    if (this.trackedScrollMilestones.has(percent)) return;
    this.trackedScrollMilestones.add(percent);
    this.track({
      event: 'scroll_depth',
      percent,
      articleId,
    });
  }

  public trackLanguageChange(from: LanguageCode, to: LanguageCode) {
    this.track({
      event: 'language_change',
      fromLanguage: from,
      toLanguage: to,
    });
  }

  public trackSearch(query: string, resultsCount: number, lang: LanguageCode) {
    this.track({
      event: 'search_query',
      query,
      resultsCount,
      language: lang,
    });
  }

  public trackShare(network: string, articleId: string) {
    this.track({
      event: 'social_share',
      network,
      articleId,
    });
  }

  public trackCommentSubmission(articleId: string, author: string) {
    this.track({
      event: 'comment_submitted',
      articleId,
      author,
    });
  }
}

export const analytics = new AnalyticsService();
