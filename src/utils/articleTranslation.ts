import { Article, ArticleTranslation, LanguageCode } from '../types';

const LANGS: LanguageCode[] = ['en'];

export function getArticleTranslation(
  article: Article,
  requestedLang: LanguageCode
): ArticleTranslation {
  const requested = article.translations?.[requestedLang];
  if (requested?.title) return requested;

  if (article.sourceLanguage) {
    const source = article.translations?.[article.sourceLanguage];
    if (source?.title) return source;
  }

  const complete = LANGS
    .map((lang) => article.translations?.[lang])
    .find((translation) => translation?.title && translation.translationStatus === 'complete');
  if (complete) return complete;

  const anyAvailable = LANGS
    .map((lang) => article.translations?.[lang])
    .find((translation) => translation?.title);
  if (anyAvailable) return anyAvailable;

  return article.translations.en;
}

export function hasCompleteTranslation(
  article: Article,
  lang: LanguageCode
): boolean {
  const translation = article.translations?.[lang];
  return Boolean(
    translation?.title &&
      translation?.slug &&
      translation.translationStatus === 'complete'
  );
}
