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

export interface FlightLeg {
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
  airline?: string;
  flightNumber?: string;
  durationMinutes?: number;
}

export interface FlightOption {
  price?: number;
  type?: string;
  totalDurationMinutes?: number;
  stops: number;
  legs: FlightLeg[];
}

export interface HotelResult {
  name: string;
  url?: string;
  description?: string;
  pricePerNight?: string;
  totalPrice?: string;
  rating?: number;
  reviews?: number;
  hotelClass?: string;
  deal?: string;
  amenities?: string[];
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.');

function toLeg(leg: Record<string, unknown>): FlightLeg {
  const departure = isRecord(leg.departure_airport) ? leg.departure_airport : {};
  const arrival = isRecord(leg.arrival_airport) ? leg.arrival_airport : {};
  return compact<FlightLeg>({
    from: str(departure.id),
    to: str(arrival.id),
    departure: [str(departure.date), str(departure.time)].filter(Boolean).join(' ') || undefined,
    arrival: [str(arrival.date), str(arrival.time)].filter(Boolean).join(' ') || undefined,
    airline: str(leg.airline),
    flightNumber: str(leg.flight_number),
    durationMinutes: num(leg.duration),
  });
}

/** Google Flights search. */
export function flightSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Search Google Flights for fares between two airports. Returns priced itineraries with airlines, times, stops and durations.',
    inputSchema: z.object({
      from: z.string().describe('Departure airport or city IATA code, for example JFK.'),
      to: z.string().describe('Arrival airport or city IATA code, for example LHR.'),
      departureDate: isoDate.describe('Outbound date as YYYY-MM-DD.'),
      returnDate: isoDate
        .optional()
        .describe('Return date as YYYY-MM-DD. Omit for a one-way trip.'),
      adults: z.number().int().min(1).max(9).optional().describe('Number of adults. Defaults to 1.'),
    }),
    execute: async ({
      from,
      to,
      departureDate,
      returnDate,
      adults,
    }): Promise<{ options: FlightOption[]; lowestPrice?: number; priceLevel?: string }> => {
      const body = await searchApiRequest(
        'google_flights',
        {
          departure_id: from,
          arrival_id: to,
          outbound_date: departureDate,
          return_date: returnDate,
          flight_type: returnDate ? 'round_trip' : 'one_way',
          adults,
        },
        config,
      );

      const entries = [...readBlock(body, 'best_flights'), ...readBlock(body, 'other_flights')];
      const options = entries.slice(0, limitOf(config)).map((entry) => {
        const legs = Array.isArray(entry.flights)
          ? entry.flights.filter(isRecord).map(toLeg)
          : [];
        return compact<FlightOption>({
          price: num(entry.price),
          type: str(entry.type),
          totalDurationMinutes: num(entry.total_duration),
          stops: Math.max(legs.length - 1, 0),
          legs,
        });
      });

      const insights = isRecord(body.price_insights) ? body.price_insights : {};
      return compact({
        options,
        lowestPrice: num(insights.lowest_price),
        priceLevel: str(insights.price_level),
      });
    },
  });
}

/** Google Hotels search. */
export function hotelSearch(config: SearchApiConfig = {}) {
  return tool({
    description:
      'Search Google Hotels for stays in a destination. Returns nightly and total prices, ratings, hotel class and amenities.',
    inputSchema: z.object({
      query: z.string().describe('Destination, for example "hotels in Lisbon".'),
      checkInDate: isoDate.describe('Check-in date as YYYY-MM-DD.'),
      checkOutDate: isoDate.describe('Check-out date as YYYY-MM-DD.'),
      adults: z.number().int().min(1).max(20).optional().describe('Number of adults. Defaults to 2.'),
    }),
    execute: async ({
      query,
      checkInDate,
      checkOutDate,
      adults,
    }): Promise<{ query: string; results: HotelResult[] }> => {
      const body = await searchApiRequest(
        'google_hotels',
        {
          q: query,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          adults,
        },
        config,
      );

      const results = readBlock(body, 'properties')
        .slice(0, limitOf(config))
        .flatMap((entry) => {
          const name = str(entry.name);
          if (!name) return [];
          const perNight = isRecord(entry.price_per_night) ? entry.price_per_night : {};
          const total = isRecord(entry.total_price) ? entry.total_price : {};
          const amenities = Array.isArray(entry.amenities)
            ? entry.amenities.filter((item): item is string => typeof item === 'string').slice(0, 8)
            : undefined;
          return [
            compact<HotelResult>({
              name,
              url: str(entry.link),
              description: str(entry.description),
              pricePerNight: str(perNight.price),
              totalPrice: str(total.price),
              rating: num(entry.rating),
              reviews: num(entry.reviews),
              hotelClass: str(entry.hotel_class),
              deal: str(entry.deal),
              amenities: amenities?.length ? amenities : undefined,
            }),
          ];
        });

      return { query, results };
    },
  });
}
