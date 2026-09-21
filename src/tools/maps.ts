import { tool } from 'ai';
import { z } from 'zod';

import {
  compact,
  isRecord,
  limitOf,
  num,
  readBlock,
  searchApiRequest,
  str,
  type SearchApiConfig,
} from '../client.js';

export interface PlaceResult {
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  hours?: string;
  latitude?: number;
  longitude?: number;
  position?: number;
}

/** Google Maps local search. */
export function mapsSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Find places on Google Maps: businesses, restaurants, services. Returns addresses, phone numbers, websites, ratings and opening hours.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('What to look for and where, for example "coffee in Austin".'),
    }),
    execute: async ({ query }): Promise<{ query: string; results: PlaceResult[] }> => {
      const limit = limitOf(config);
      const body = await searchApiRequest('google_maps', { q: query }, config);

      const results = readBlock(body, 'local_results')
        .slice(0, limit)
        .flatMap((entry) => {
          const name = str(entry.title);
          if (!name) return [];
          const coordinates = isRecord(entry.gps_coordinates) ? entry.gps_coordinates : {};
          return [
            compact<PlaceResult>({
              name,
              category: str(entry.type),
              address: str(entry.address),
              phone: str(entry.phone),
              website: str(entry.website),
              rating: num(entry.rating),
              reviews: num(entry.reviews),
              hours: str(entry.hours),
              latitude: num(coordinates.latitude),
              longitude: num(coordinates.longitude),
              position: num(entry.position),
            }),
          ];
        });

      return { query, results };
    },
  });
}
