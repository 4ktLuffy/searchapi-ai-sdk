import { tool } from 'ai';
import { z } from 'zod';

import { limitOf, readBlock, searchApiRequest, type SearchApiConfig } from '../client.js';
import { toResults, type SearchResult } from './web.js';

export interface SearchApiToolConfig extends SearchApiConfig {
  /**
   * Any SearchApi engine, for example `bing`, `youtube`, `amazon_search`,
   * `google_trends` or `google_patents`. See https://www.searchapi.io/docs.
   */
  engine: string;
  /** Override the tool description the model sees. */
  description?: string;
}

const RESULT_BLOCKS = [
  'organic_results',
  'top_stories',
  'local_results',
  'shopping_results',
  'video_results',
  'news_results',
  'results',
];

/**
 * Any SearchApi engine as a tool, for the engines without a dedicated helper.
 *
 * Results are read from whichever common block the engine populates, so the
 * shape is best-effort: prefer a dedicated tool when one exists.
 */
export function searchApiTool({ engine, description, ...config }: SearchApiToolConfig) {
  return tool({
    description:
      description ??
      `Search ${engine.replace(/_/g, ' ')} and return the top results with titles, URLs and snippets.`,
    inputSchema: z.object({
      query: z.string().describe('The search query.'),
    }),
    execute: async ({ query }): Promise<{ engine: string; query: string; results: SearchResult[] }> => {
      const body = await searchApiRequest(engine, { q: query, num: limitOf(config) }, config);
      const entries = RESULT_BLOCKS.flatMap((block) => readBlock(body, block));
      return { engine, query, results: toResults(entries, limitOf(config)) };
    },
  });
}
