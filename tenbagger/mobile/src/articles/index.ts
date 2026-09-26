/**
 * Articles library (public surface).
 *   <LibraryCard />            entry card for the Learn tab
 *   routes: /articles, /articles/[slug]  (src/app/articles/*)
 * Content source: tenbagger/content → tenbagger/data/articles.json (see content/README.md).
 */
export { LibraryCard } from './LibraryCard';
export { ArticleListScreen } from './ArticleListScreen';
export { ArticleReaderScreen } from './ArticleReaderScreen';
export { getArticle, getArticles } from './data';
export { useArticles } from './store';
export type { Article, Widget } from './types';
