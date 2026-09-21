'use server';

import { flightSearch, hotelSearch, type FlightOption, type HotelResult } from 'searchapi-ai-sdk';

export interface TripResult {
  flights: FlightOption[];
  hotels: HotelResult[];
  lowestPrice?: number;
  priceLevel?: string;
  error?: string;
}

const toolOptions = { toolCallId: 'travel-agent', messages: [] } as never;

export async function planTrip(formData: FormData): Promise<TripResult> {
  const from = String(formData.get('from') ?? '').trim().toUpperCase();
  const to = String(formData.get('to') ?? '').trim().toUpperCase();
  const city = String(formData.get('city') ?? '').trim();
  const departureDate = String(formData.get('departureDate') ?? '');
  const returnDate = String(formData.get('returnDate') ?? '');

  if (!from || !to || !departureDate || !returnDate) {
    return { flights: [], hotels: [], error: 'Fill in every field to plan a trip.' };
  }

  try {
    // The same tool objects an agent would call, invoked directly so the demo
    // needs only a SearchApi key and no model credentials.
    const flights = flightSearch({ maxResults: 4 });
    const hotels = hotelSearch({ maxResults: 4 });

    const [flightResult, hotelResult] = await Promise.all([
      flights.execute!({ from, to, departureDate, returnDate } as never, toolOptions) as Promise<{
        options: FlightOption[];
        lowestPrice?: number;
        priceLevel?: string;
      }>,
      hotels.execute!(
        {
          query: `hotels in ${city || to}`,
          checkInDate: departureDate,
          checkOutDate: returnDate,
        } as never,
        toolOptions,
      ) as Promise<{ results: HotelResult[] }>,
    ]);

    return {
      flights: flightResult.options,
      hotels: hotelResult.results,
      lowestPrice: flightResult.lowestPrice,
      priceLevel: flightResult.priceLevel,
    };
  } catch (error) {
    return {
      flights: [],
      hotels: [],
      error: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }
}
