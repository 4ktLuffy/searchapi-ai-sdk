import { describe, expect, it } from 'vitest';

import {
  flightSearch,
  hotelSearch,
  mapsSearch,
  shoppingSearch,
  type FlightOption,
  type HotelResult,
  type PlaceResult,
  type ShoppingResult,
} from '../src/index.js';
import { paramsOf, run, stubFetch } from './helpers.js';

describe('shoppingSearch', () => {
  const PAYLOAD = {
    shopping_results: [
      {
        position: 1,
        title: "Men's Nike Alphafly 3",
        product_link: 'https://www.google.com/shopping/product/1',
        price: '$221.97',
        extracted_price: 221.97,
        original_price: '$295',
        rating: 4.4,
        reviews: 1100,
        delivery: 'Free delivery by Sat',
        seller: 'Nike',
        thumbnail: 'https://example.com/shoe.png',
      },
      { position: 2, price: '$99' },
    ],
  };

  it('returns priced products and drops entries without a title', async () => {
    const { fetchImpl, calls } = stubFetch(PAYLOAD);
    const result = await run<{ results: ShoppingResult[] }>(
      shoppingSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'running shoes' },
    );

    expect(paramsOf(calls[0]!).engine).toBe('google_shopping');
    expect(result.results).toEqual([
      {
        title: "Men's Nike Alphafly 3",
        url: 'https://www.google.com/shopping/product/1',
        price: '$221.97',
        priceValue: 221.97,
        originalPrice: '$295',
        seller: 'Nike',
        rating: 4.4,
        reviews: 1100,
        delivery: 'Free delivery by Sat',
        position: 1,
      },
    ]);
  });
});

describe('mapsSearch', () => {
  const PAYLOAD = {
    local_results: [
      {
        position: 1,
        title: 'Epoch Coffee',
        type: 'Coffee shop',
        address: '221 W N Loop Blvd, Austin, TX 78751, United States',
        phone: '(512) 454-3762',
        website: 'http://www.epochcoffee.com/',
        rating: 4.5,
        reviews: 2527,
        hours: 'Open · Closes 11:30 pm',
        gps_coordinates: { latitude: 30.3187, longitude: -97.7229 },
      },
    ],
  };

  it('flattens coordinates and keeps the contact details', async () => {
    const { fetchImpl, calls } = stubFetch(PAYLOAD);
    const result = await run<{ results: PlaceResult[] }>(
      mapsSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'coffee in Austin' },
    );

    expect(paramsOf(calls[0]!).engine).toBe('google_maps');
    expect(result.results[0]).toEqual({
      name: 'Epoch Coffee',
      category: 'Coffee shop',
      address: '221 W N Loop Blvd, Austin, TX 78751, United States',
      phone: '(512) 454-3762',
      website: 'http://www.epochcoffee.com/',
      rating: 4.5,
      reviews: 2527,
      hours: 'Open · Closes 11:30 pm',
      latitude: 30.3187,
      longitude: -97.7229,
      position: 1,
    });
  });

  it('tolerates a place without coordinates', async () => {
    const { fetchImpl } = stubFetch({ local_results: [{ title: 'Nameless Cafe' }] });
    const result = await run<{ results: PlaceResult[] }>(
      mapsSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'cafe' },
    );

    expect(result.results[0]).toEqual({ name: 'Nameless Cafe' });
  });
});

describe('flightSearch', () => {
  const PAYLOAD = {
    best_flights: [
      {
        price: 295,
        type: 'One way',
        total_duration: 430,
        flights: [
          {
            departure_airport: { id: 'JFK', date: '2026-11-10', time: '08:00' },
            arrival_airport: { id: 'LHR', date: '2026-11-10', time: '20:10' },
            duration: 430,
            airline: 'Virgin Atlantic',
            flight_number: 'VS 26',
          },
        ],
      },
    ],
    other_flights: [
      {
        price: 410,
        flights: [
          {
            departure_airport: { id: 'JFK', date: '2026-11-10', time: '06:00' },
            arrival_airport: { id: 'AMS', date: '2026-11-10', time: '18:00' },
          },
          {
            departure_airport: { id: 'AMS', date: '2026-11-10', time: '19:30' },
            arrival_airport: { id: 'LHR', date: '2026-11-10', time: '20:30' },
          },
        ],
      },
    ],
    price_insights: { lowest_price: 293, price_level: 'typical' },
  };

  it('returns itineraries with stop counts and price insights', async () => {
    const { fetchImpl } = stubFetch(PAYLOAD);
    const result = await run<{
      options: FlightOption[];
      lowestPrice?: number;
      priceLevel?: string;
    }>(flightSearch({ apiKey: 'k', fetch: fetchImpl }), {
      from: 'JFK',
      to: 'LHR',
      departureDate: '2026-11-10',
    });

    expect(result.lowestPrice).toBe(293);
    expect(result.priceLevel).toBe('typical');
    expect(result.options[0]).toEqual({
      price: 295,
      type: 'One way',
      totalDurationMinutes: 430,
      stops: 0,
      legs: [
        {
          from: 'JFK',
          to: 'LHR',
          departure: '2026-11-10 08:00',
          arrival: '2026-11-10 20:10',
          airline: 'Virgin Atlantic',
          flightNumber: 'VS 26',
          durationMinutes: 430,
        },
      ],
    });
    expect(result.options[1]!.stops).toBe(1);
  });

  it('sends a one-way trip when no return date is given', async () => {
    const { fetchImpl, calls } = stubFetch(PAYLOAD);
    await run(flightSearch({ apiKey: 'k', fetch: fetchImpl }), {
      from: 'JFK',
      to: 'LHR',
      departureDate: '2026-11-10',
    });

    const params = paramsOf(calls[0]!);
    expect(params.engine).toBe('google_flights');
    expect(params.flight_type).toBe('one_way');
    expect(params.return_date).toBeUndefined();
  });

  it('sends a round trip when a return date is given', async () => {
    const { fetchImpl, calls } = stubFetch(PAYLOAD);
    await run(flightSearch({ apiKey: 'k', fetch: fetchImpl }), {
      from: 'JFK',
      to: 'LHR',
      departureDate: '2026-11-10',
      returnDate: '2026-11-17',
      adults: 2,
    });

    const params = paramsOf(calls[0]!);
    expect(params.flight_type).toBe('round_trip');
    expect(params.return_date).toBe('2026-11-17');
    expect(params.adults).toBe('2');
  });
});

describe('hotelSearch', () => {
  const PAYLOAD = {
    properties: [
      {
        name: 'Palácio Príncipe Real',
        link: 'http://www.palacioprincipereal.com/',
        description: 'Elegant hotel in a 19th-century building.',
        price_per_night: { price: '$202', extracted_price: 202 },
        total_price: { price: '$404', extracted_price: 404 },
        rating: 4.9,
        reviews: 154,
        hotel_class: '5-star hotel',
        deal: '60% less than usual',
        amenities: Array.from({ length: 12 }, (_, index) => `Amenity ${index + 1}`),
      },
    ],
  };

  it('returns prices, ratings and a capped amenity list', async () => {
    const { fetchImpl, calls } = stubFetch(PAYLOAD);
    const result = await run<{ results: HotelResult[] }>(
      hotelSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'hotels in Lisbon', checkInDate: '2026-11-10', checkOutDate: '2026-11-12' },
    );

    const params = paramsOf(calls[0]!);
    expect(params.engine).toBe('google_hotels');
    expect(params.check_in_date).toBe('2026-11-10');
    expect(params.check_out_date).toBe('2026-11-12');

    const hotel = result.results[0]!;
    expect(hotel.name).toBe('Palácio Príncipe Real');
    expect(hotel.pricePerNight).toBe('$202');
    expect(hotel.totalPrice).toBe('$404');
    expect(hotel.hotelClass).toBe('5-star hotel');
    expect(hotel.amenities).toHaveLength(8);
  });

  it('omits the amenity list when the property has none', async () => {
    const { fetchImpl } = stubFetch({ properties: [{ name: 'Plain Hotel' }] });
    const result = await run<{ results: HotelResult[] }>(
      hotelSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'hotels', checkInDate: '2026-11-10', checkOutDate: '2026-11-12' },
    );

    expect(result.results[0]).toEqual({ name: 'Plain Hotel' });
  });
});
