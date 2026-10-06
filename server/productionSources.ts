import { NewsSource } from '../src/types';

/**
 * Production-safe source defaults. These feeds are public RSS/XML endpoints
 * that were verified as reachable in October 2026. Source provenance remains
 * internal to the CMS and is not rendered on public article pages.
 */
export const PRODUCTION_NEWS_SOURCES: NewsSource[] = [
  {
    id: 'src-bbc',
    name: 'BBC News World',
    rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: null,
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 0,
  },
  {
    id: 'src-aljazeera',
    name: 'Al Jazeera English',
    rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: null,
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 0,
  },
  {
    id: 'src-dw',
    name: 'Deutsche Welle English',
    rssUrl: 'https://rss.dw.com/rdf/rss-en-all',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: null,
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 0,
  },
  {
    id: 'src-euronews',
    name: 'Euronews World',
    rssUrl: 'https://www.euronews.com/rss?level=theme&name=news',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: null,
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 0,
  },
  {
    id: 'src-unnews',
    name: 'United Nations News',
    rssUrl: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: null,
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 0,
  },
];
