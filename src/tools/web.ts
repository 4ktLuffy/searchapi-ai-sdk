import { tool } from 'ai';
import { z } from 'zod';

import {
  compact,
  limitOf,
  num,
  readBlock,
  searchApiRequest,
  str,
  type SearchApiConfig,
} from '../client.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  position?: number;
  source?: string;
  date?: string;
}

const queryInput = z.object({
  query: z.string().describe('The search query.'),
});

/**
 * Normalize a SERP block into compact results.
 *
 * Entries without a title or link are dropped, and a link is only returned
 * once even when it appears in more than one block.
 */
export function toResults(
  entries: Record<string, unknown>[],
  limit: number,
): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (results.length >= limit) break;

    const title = str(entry.title);
    const url = str(entry.link);
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);

    results.push(
      compact({
        title,
        url,
        snippet: str(entry.snippet),
        position: num(entry.position),
        source: str(entry.source),
        date: str(entry.date),
      }),
    );
  }

  return results;
}

/** Google web search. */
export function webSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Search the web with Google and return the top organic results with titles, URLs and snippets.',
    inputSchema: queryInput,
    execute: async ({ query }): Promise<{ query: string; results: SearchResult[] }> => {
      const body = await searchApiRequest(
        'google',
        { q: query, num: limitOf(config) },
        config,
      );
      return { query, results: toResults(readBlock(body, 'organic_results'), limitOf(config)) };
    },
  });
}

/** Google News search. */
export function newsSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Search Google News for recent articles about a topic. Each result carries a publication date and source.',
    inputSchema: queryInput,
    execute: async ({ query }): Promise<{ query: string; results: SearchResult[] }> => {
      const body = await searchApiRequest(
        'google_news',
        { q: query, num: limitOf(config) },
        config,
      );
      // Google News splits its results across both blocks and sometimes
      // returns nothing at all under `organic_results`.
      const entries = [...readBlock(body, 'organic_results'), ...readBlock(body, 'top_stories')];
      return { query, results: toResults(entries, limitOf(config)) };
    },
  });
}

/** Google Scholar search. */
export function scholarSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Search Google Scholar for academic papers, with titles, links, authors and snippets.',
    inputSchema: queryInput,
    execute: async ({ query }): Promise<{ query: string; results: SearchResult[] }> => {
      const body = await searchApiRequest(
        'google_scholar',
        { q: query, num: limitOf(config) },
        config,
      );
      return { query, results: toResults(readBlock(body, 'organic_results'), limitOf(config)) };
    },
  });
}
