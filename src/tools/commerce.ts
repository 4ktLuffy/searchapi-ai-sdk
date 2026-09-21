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

export interface ShoppingResult {
  title: string;
  url?: string;
  price?: string;
  priceValue?: number;
  originalPrice?: string;
  seller?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  position?: number;
}

/** Google Shopping product search. */
export function shoppingSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Search Google Shopping for products, with prices, sellers and ratings. Use for "how much does X cost" or "where can I buy X".',
    inputSchema: z.object({
      query: z.string().describe('The product to search for.'),
    }),
    execute: async ({ query }): Promise<{ query: string; results: ShoppingResult[] }> => {
      const limit = limitOf(config);
      const body = await searchApiRequest('google_shopping', { q: query, num: limit }, config);

      const results = readBlock(body, 'shopping_results')
        .slice(0, limit)
        .flatMap((entry) => {
          const title = str(entry.title);
          if (!title) return [];
          return [
            compact<ShoppingResult>({
              title,
              url: str(entry.product_link),
              price: str(entry.price),
              priceValue: num(entry.extracted_price),
              originalPrice: str(entry.original_price),
              seller: str(entry.seller),
              rating: num(entry.rating),
              reviews: num(entry.reviews),
              delivery: str(entry.delivery),
              position: num(entry.position),
            }),
          ];
        });

      return { query, results };
    },
  });
}
