import {
  Article,
  AutomationLog,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';
import { isTursoConfigured } from './turso';
import { tursoRepository } from './tursoRepository';

export interface PersistenceSnapshot {
  articles: Article[];
  categories: Category[];
  sources: NewsSource[];
  comments: Comment[];
  logs: AutomationLog[];
  settings: SiteSettings | null;
}

type PersistenceProvider = 'turso' | 'memory';

export function getPersistenceProvider(): PersistenceProvider {
  return isTursoConfigured() ? 'turso' : 'memory';
}

export function isPersistenceConfigured(): boolean {
  return isTursoConfigured();
}

function emptySnapshot(): PersistenceSnapshot {
  return {
    articles: [],
    categories: [],
    sources: [],
    comments: [],
    logs: [],
    settings: null,
  };
}

export const persistence = {
  async loadSnapshot(): Promise<PersistenceSnapshot> {
    if (!isPersistenceConfigured()) return emptySnapshot();

    const [articles, categories, sources, comments, logs, settings] = await Promise.all([
      tursoRepository.listArticles({ limit: 5000 }),
      tursoRepository.listCategories(),
      tursoRepository.listSources(),
      tursoRepository.listComments(),
      tursoRepository.listLogs(100),
      tursoRepository.getSettings(),
    ]);

    return { articles, categories, sources, comments, logs, settings };
  },

  upsertArticle(article: Article) {
    return tursoRepository.upsertArticle(article).then(() => undefined);
  },

  deleteArticle(id: string) {
    return tursoRepository.deleteArticle(id).then(() => undefined);
  },

  upsertCategory(category: Category) {
    return tursoRepository.upsertCategory(category).then(() => undefined);
  },

  upsertSource(source: NewsSource) {
    return tursoRepository.upsertSource(source).then(() => undefined);
  },

  deleteSource(id: string) {
    return tursoRepository.deleteSource(id).then(() => undefined);
  },

  upsertComment(comment: Comment) {
    return tursoRepository.upsertComment(comment).then(() => undefined);
  },

  upsertLog(log: AutomationLog) {
    return tursoRepository.upsertLog(log).then(() => undefined);
  },

  upsertSettings(settings: SiteSettings) {
    return tursoRepository.upsertSettings(settings).then(() => undefined);
  },
};
