/**
 * Live verification against the real SearchApi endpoint.
 *
 *   SEARCHAPI_API_KEY=... npm run test:live
 *
 * Unit tests cover behaviour with a stubbed fetch; this script exists to prove
 * the response shapes the tools parse are the shapes the API actually returns.
 * It spends one request per tool.
 */
import {
  flightSearch,
  hotelSearch,
  mapsSearch,
  newsSearch,
  scholarSearch,
  searchApiTool,
  shoppingSearch,
  webSearch,
} from '../src/index.js';

let failures = 0;

function check(label: string, condition: unknown): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
  } else {
    failures += 1;
    console.log(`  [FAIL] ${label}`);
  }
}

const options = { toolCallId: 'live', messages: [] } as never;

async function call<T>(instance: { execute?: (i: never, o: never) => unknown }, input: unknown) {
  return (await instance.execute!(input as never, options)) as T;
}

function futureDate(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  if (!process.env.SEARCHAPI_API_KEY) {
    console.error('SEARCHAPI_API_KEY is not set');
    process.exit(1);
  }

  console.log('\n1. webSearch');
  const web = await call<{ results: { title: string; url: string; snippet?: string }[] }>(
    webSearch({ maxResults: 3 }),
    { query: 'crewai agent framework' },
  );
  check('returns results', web.results.length > 0);
  check('respects maxResults', web.results.length <= 3);
  check('every result has a title and an http url', web.results.every((r) => r.title && r.url.startsWith('http')));
  check('at least one result carries a snippet', web.results.some((r) => r.snippet));
  console.log('   ', JSON.stringify(web.results[0]).slice(0, 180));

  console.log('\n2. newsSearch');
  const news = await call<{ results: { url: string; date?: string }[] }>(
    newsSearch({ maxResults: 5 }),
    { query: 'openai' },
  );
  check('returns results', news.results.length > 0);
  check('results carry a date', news.results.some((r) => r.date));
  check('links are destinations, not google.com/goto redirects', news.results.every((r) => !r.url.includes('google.com/goto')));
  console.log('   ', JSON.stringify(news.results[0]).slice(0, 180));

  console.log('\n3. scholarSearch');
  const scholar = await call<{ results: { title: string }[] }>(scholarSearch({ maxResults: 3 }), {
    query: 'retrieval augmented generation',
  });
  check('returns papers', scholar.results.length > 0);
  console.log('   ', JSON.stringify(scholar.results[0]).slice(0, 180));

  console.log('\n4. shoppingSearch');
  const shopping = await call<{ results: { title: string; price?: string; priceValue?: number }[] }>(
    shoppingSearch({ maxResults: 3 }),
    { query: 'running shoes' },
  );
  check('returns products', shopping.results.length > 0);
  check('products carry a price', shopping.results.some((r) => r.price));
  check('prices are also parsed as numbers', shopping.results.some((r) => typeof r.priceValue === 'number'));
  console.log('   ', JSON.stringify(shopping.results[0]).slice(0, 180));

  console.log('\n5. mapsSearch');
  const maps = await call<{ results: { name: string; address?: string; latitude?: number }[] }>(
    mapsSearch({ maxResults: 3 }),
    { query: 'coffee in Austin' },
  );
  check('returns places', maps.results.length > 0);
  check('places carry an address', maps.results.some((r) => r.address));
  check('coordinates are flattened to numbers', maps.results.some((r) => typeof r.latitude === 'number'));
  console.log('   ', JSON.stringify(maps.results[0]).slice(0, 180));

  console.log('\n6. flightSearch');
  const flights = await call<{
    options: { price?: number; stops: number; legs: unknown[] }[];
    lowestPrice?: number;
  }>(flightSearch({ maxResults: 3 }), {
    from: 'JFK',
    to: 'LHR',
    departureDate: futureDate(50),
  });
  check('returns itineraries', flights.options.length > 0);
  check('itineraries are priced', flights.options.some((o) => typeof o.price === 'number'));
  check('itineraries have legs', flights.options.every((o) => o.legs.length > 0));
  check('stop counts are derived', flights.options.every((o) => o.stops === o.legs.length - 1));
  console.log('   ', JSON.stringify(flights.options[0]).slice(0, 220));

  console.log('\n7. hotelSearch');
  const hotels = await call<{ results: { name: string; pricePerNight?: string; rating?: number }[] }>(
    hotelSearch({ maxResults: 3 }),
    { query: 'hotels in Lisbon', checkInDate: futureDate(50), checkOutDate: futureDate(52) },
  );
  check('returns properties', hotels.results.length > 0);
  check('properties carry a nightly price', hotels.results.some((r) => r.pricePerNight));
  console.log('   ', JSON.stringify(hotels.results[0]).slice(0, 200));

  console.log('\n8. searchApiTool (arbitrary engine)');
  const bing = await call<{ engine: string; results: { title: string }[] }>(
    searchApiTool({ engine: 'bing', maxResults: 3 }),
    { query: 'crewai' },
  );
  check('bing engine returns results', bing.results.length > 0);
  console.log('   ', JSON.stringify(bing.results[0]).slice(0, 180));

  console.log('\n9. error handling');
  try {
    await call(webSearch({ apiKey: 'definitely_not_a_real_key' }), { query: 'test' });
    check('rejects an invalid key', false);
  } catch (error) {
    check(`rejects an invalid key: ${(error as Error).message}`, /Invalid API key/.test((error as Error).message));
  }

  console.log(`\nRESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
