import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchApiError, searchApiTool, webSearch } from '../src/index.js';
import { headersOf, paramsOf, run, stubBrokenFetch, stubFetch } from './helpers.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('authentication', () => {
  it('falls back to SEARCHAPI_API_KEY from the environment', async () => {
    vi.stubEnv('SEARCHAPI_API_KEY', 'env-key');
    const { fetchImpl, calls } = stubFetch({ organic_results: [] });
    await run(webSearch({ fetch: fetchImpl }), { query: 'crewai' });

    expect(headersOf(calls[0]!).Authorization).toBe('Bearer env-key');
  });

  it('prefers an explicitly passed key over the environment', async () => {
    vi.stubEnv('SEARCHAPI_API_KEY', 'env-key');
    const { fetchImpl, calls } = stubFetch({ organic_results: [] });
    await run(webSearch({ apiKey: 'explicit-key', fetch: fetchImpl }), { query: 'crewai' });

    expect(headersOf(calls[0]!).Authorization).toBe('Bearer explicit-key');
  });

  it('explains what to do when no key is configured', async () => {
    vi.stubEnv('SEARCHAPI_API_KEY', '');
    const { fetchImpl } = stubFetch({ organic_results: [] });

    await expect(run(webSearch({ fetch: fetchImpl }), { query: 'crewai' })).rejects.toThrow(
      /Set SEARCHAPI_API_KEY or pass \{ apiKey \}/,
    );
  });

  it('identifies the integration to the API', async () => {
    const { fetchImpl, calls } = stubFetch({ organic_results: [] });
    await run(webSearch({ apiKey: 'k', fetch: fetchImpl }), { query: 'crewai' });

    expect(headersOf(calls[0]!)['X-SearchApi-Integration']).toBe('ai-sdk');
  });
});

describe('error handling', () => {
  it('surfaces the message the API returned', async () => {
    const { fetchImpl } = stubFetch({ error: 'Invalid API key.' }, { status: 401 });

    await expect(
      run(webSearch({ apiKey: 'bad', fetch: fetchImpl }), { query: 'crewai' }),
    ).rejects.toThrow('SearchApi request failed: Invalid API key.');
  });

  it('carries the HTTP status on the error', async () => {
    const { fetchImpl } = stubFetch({ error: 'Unsupported engine: `nope`.' }, { status: 400 });

    const error = await run(webSearch({ apiKey: 'k', fetch: fetchImpl }), {
      query: 'crewai',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SearchApiError);
    expect((error as SearchApiError).status).toBe(400);
  });

  it('falls back to the status code when the error body is not JSON', async () => {
    await expect(
      run(webSearch({ apiKey: 'k', fetch: stubBrokenFetch(502) }), { query: 'crewai' }),
    ).rejects.toThrow('SearchApi request failed: HTTP 502');
  });

  it('wraps a network failure rather than leaking the raw error', async () => {
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof globalThis.fetch;

    await expect(
      run(webSearch({ apiKey: 'k', fetch: failing }), { query: 'crewai' }),
    ).rejects.toThrow('SearchApi request failed: fetch failed');
  });
});

describe('searchApiTool', () => {
  it('queries an arbitrary engine', async () => {
    const { fetchImpl, calls } = stubFetch({
      organic_results: [{ title: 'Bing hit', link: 'https://example.com/bing' }],
    });
    const result = await run<{ engine: string; results: { title: string }[] }>(
      searchApiTool({ engine: 'bing', apiKey: 'k', fetch: fetchImpl }),
      { query: 'crewai' },
    );

    expect(paramsOf(calls[0]!).engine).toBe('bing');
    expect(result.engine).toBe('bing');
    expect(result.results[0]!.title).toBe('Bing hit');
  });

  it('reads whichever common block the engine populates', async () => {
    const { fetchImpl } = stubFetch({
      video_results: [{ title: 'A video', link: 'https://youtube.com/watch?v=1' }],
    });
    const result = await run<{ results: { url: string }[] }>(
      searchApiTool({ engine: 'youtube', apiKey: 'k', fetch: fetchImpl }),
      { query: 'crewai tutorial' },
    );

    expect(result.results[0]!.url).toBe('https://youtube.com/watch?v=1');
  });

  it('names the engine in the default description and allows an override', () => {
    const generated = searchApiTool({ engine: 'google_trends', apiKey: 'k' });
    expect(generated.description).toContain('google trends');

    const custom = searchApiTool({
      engine: 'google_trends',
      apiKey: 'k',
      description: 'Look up search interest over time.',
    });
    expect(custom.description).toBe('Look up search interest over time.');
  });
});
