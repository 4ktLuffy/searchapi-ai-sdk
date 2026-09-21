# searchapi-ai-sdk

[SearchApi](https://www.searchapi.io/) tools for the [AI SDK](https://ai-sdk.dev).

Google web, news and scholar search, plus the structured verticals most search
tools do not cover: shopping, maps, flights and hotels. Results come back
trimmed to the fields a model can act on, not raw SERP JSON.

```bash
npm install searchapi-ai-sdk
```

Get an API key at [searchapi.io](https://www.searchapi.io/) — 100 free searches
on signup, no card — and set it:

```bash
export SEARCHAPI_API_KEY='your-api-key'
```

## Usage

```ts
import { generateText, isStepCount } from 'ai';
import { webSearch } from 'searchapi-ai-sdk';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-5',
  prompt: 'What happened with agent frameworks this week?',
  tools: {
    webSearch: webSearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);
```

Every tool is a factory, so you can configure and register as many as the agent
needs:

```ts
import { flightSearch, hotelSearch, webSearch } from 'searchapi-ai-sdk';

const tools = {
  webSearch: webSearch({ maxResults: 5 }),
  flightSearch: flightSearch(),
  hotelSearch: hotelSearch({ country: 'pt' }),
};
```

## Tools

| Tool | Engine | Returns |
| --- | --- | --- |
| `webSearch` | `google` | Organic results: title, url, snippet, position, source |
| `newsSearch` | `google_news` | Articles with publication date and source |
| `scholarSearch` | `google_scholar` | Academic papers with links and snippets |
| `shoppingSearch` | `google_shopping` | Products with price, seller, rating, delivery |
| `mapsSearch` | `google_maps` | Places with address, phone, website, rating, hours, coordinates |
| `flightSearch` | `google_flights` | Priced itineraries with legs, airlines, stops, price insights |
| `hotelSearch` | `google_hotels` | Properties with nightly and total price, rating, class, amenities |
| `searchApiTool` | any | Any other SearchApi engine — Bing, YouTube, Amazon, Trends, Patents |

Anything without a dedicated helper works through `searchApiTool`:

```ts
import { searchApiTool } from 'searchapi-ai-sdk';

const tools = {
  youtubeSearch: searchApiTool({ engine: 'youtube' }),
  trends: searchApiTool({
    engine: 'google_trends',
    description: 'Look up search interest for a term over time.',
  }),
};
```

## Configuration

Every tool takes the same options, all optional:

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | `process.env.SEARCHAPI_API_KEY` | Your SearchApi key |
| `maxResults` | `10` | Results to request and return |
| `country` | — | Country code, sent as `gl` |
| `language` | — | Language code, sent as `hl` |
| `location` | — | Geographic location, e.g. `Austin, Texas, United States` |
| `timeoutMs` | `30000` | Request timeout |
| `extraParams` | — | Any other SearchApi query parameter |
| `baseUrl` | SearchApi endpoint | Override, mainly for testing |
| `fetch` | global `fetch` | Custom fetch, for proxies or tests |

## Notes on the results

- **Links are destinations.** Requests are sent with `link=resolved`, so a news
  result is `bloomberg.com/news/...` rather than a `google.com/goto?url=...`
  redirect an agent cannot follow.
- **News reads both blocks.** Google News splits results between
  `organic_results` and `top_stories`, and sometimes returns nothing under
  `organic_results` at all. `newsSearch` merges both and de-duplicates by link.
- **Results are trimmed.** Favicons, thumbnails, tokens and tracking fields are
  dropped, and empty fields are omitted rather than sent as nulls.
- **Failures throw `SearchApiError`** carrying the message the API returned and
  the HTTP status, for example `SearchApi request failed: Invalid API key.`

## Development

```bash
npm install
npm test          # unit tests, no network
npm run typecheck
npm run build
SEARCHAPI_API_KEY=... npm run test:live   # one request per tool
```

`npm run test:live` exists because the unit tests stub `fetch`: it checks that
the shapes the tools parse are the shapes the API actually returns.

## License

MIT
