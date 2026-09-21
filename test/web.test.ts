import { describe, expect, it } from 'vitest';

import { newsSearch, scholarSearch, webSearch, type SearchResult } from '../src/index.js';
import { headersOf, paramsOf, run, stubFetch } from './helpers.js';

const SEARCH_PAYLOAD = {
  organic_results: [
    {
      position: 1,
      title: 'CrewAI',
      link: 'https://crewai.com/',
      source: 'CrewAI',
      snippet: 'The Enterprise Agent Build & Runtime.',
      favicon: 'https://example.com/favicon.ico',
    },
    {
      position: 2,
      title: 'crewAIInc/crewAI',
      link: 'https://github.com/crewaiinc/crewai',
      snippet: 'Framework for orchestrating role-playing agents.',
    },
  ],
};

type WebResponse = { query: string; results: SearchResult[] };

describe('webSearch', () => {
  it('returns compact results with the presentation fields stripped', async () => {
    const { fetchImpl, calls } = stubFetch(SEARCH_PAYLOAD);
    const result = await run<WebResponse>(
      webSearch({ apiKey: 'test-key', fetch: fetchImpl }),
      { query: 'crewai agent framework' },
    );

    expect(result.query).toBe('crewai agent framework');
    expect(result.results).toEqual([
      {
        title: 'CrewAI',
        url: 'https://crewai.com/',
        snippet: 'The Enterprise Agent Build & Runtime.',
        position: 1,
        source: 'CrewAI',
      },
      {
        title: 'crewAIInc/crewAI',
        url: 'https://github.com/crewaiinc/crewai',
        snippet: 'Framework for orchestrating role-playing agents.',
        position: 2,
      },
    ]);
    expect(calls).toHaveLength(1);
  });

  it('sends the engine, the key as a bearer token and resolved links', async () => {
    const { fetchImpl, calls } = stubFetch(SEARCH_PAYLOAD);
    await run(webSearch({ apiKey: 'test-key', fetch: fetchImpl }), { query: 'crewai' });

    const params = paramsOf(calls[0]!);
    expect(params.engine).toBe('google');
    expect(params.q).toBe('crewai');
    expect(params.link).toBe('resolved');
    expect(params.api_key).toBeUndefined();
    expect(headersOf(calls[0]!).Authorization).toBe('Bearer test-key');
  });

  it('caps results at maxResults and asks the API for the same number', async () => {
    const { fetchImpl, calls } = stubFetch(SEARCH_PAYLOAD);
    const result = await run<WebResponse>(
      webSearch({ apiKey: 'k', fetch: fetchImpl, maxResults: 1 }),
      { query: 'crewai' },
    );

    expect(result.results).toHaveLength(1);
    expect(paramsOf(calls[0]!).num).toBe('1');
  });

  it('skips entries without a title or a link', async () => {
    const { fetchImpl } = stubFetch({
      organic_results: [
        { position: 1, title: 'No link' },
        { position: 2, link: 'https://example.com/no-title' },
        { position: 3, title: 'Complete', link: 'https://example.com/complete' },
      ],
    });
    const result = await run<WebResponse>(
      webSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'crewai' },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.title).toBe('Complete');
  });

  it('returns an empty list when the response has no results block', async () => {
    const { fetchImpl } = stubFetch({ search_metadata: { status: 'Success' } });
    const result = await run<WebResponse>(
      webSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'asdkjhaskdjh' },
    );

    expect(result.results).toEqual([]);
  });

  it('passes localization and extra parameters through', async () => {
    const { fetchImpl, calls } = stubFetch(SEARCH_PAYLOAD);
    await run(
      webSearch({
        apiKey: 'k',
        fetch: fetchImpl,
        country: 'us',
        language: 'en',
        location: 'Austin, Texas',
        extraParams: { safe: 'active' },
      }),
      { query: 'crewai' },
    );

    const params = paramsOf(calls[0]!);
    expect(params.gl).toBe('us');
    expect(params.hl).toBe('en');
    expect(params.location).toBe('Austin, Texas');
    expect(params.safe).toBe('active');
  });
});

describe('newsSearch', () => {
  const NEWS_PAYLOAD = {
    organic_results: [
      {
        position: 1,
        title: 'An organic news hit',
        link: 'https://news.example.com/organic',
        source: 'Example News',
        date: '1 hour ago',
        snippet: 'Organic news snippet.',
      },
    ],
    top_stories: [
      {
        title: 'A top story',
        link: 'https://news.example.com/top-story',
        source: 'Other News',
        date: '30 minutes ago',
      },
    ],
  };

  it('uses the news engine', async () => {
    const { fetchImpl, calls } = stubFetch(NEWS_PAYLOAD);
    await run(newsSearch({ apiKey: 'k', fetch: fetchImpl }), { query: 'openai' });

    expect(paramsOf(calls[0]!).engine).toBe('google_news');
  });

  it('merges top stories, which is where Google News puts most results', async () => {
    const { fetchImpl } = stubFetch(NEWS_PAYLOAD);
    const result = await run<WebResponse>(
      newsSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'openai' },
    );

    expect(result.results.map((entry) => entry.url)).toEqual([
      'https://news.example.com/organic',
      'https://news.example.com/top-story',
    ]);
    expect(result.results[1]!.date).toBe('30 minutes ago');
  });

  it('still returns results when organic_results is absent entirely', async () => {
    const { fetchImpl } = stubFetch({ top_stories: NEWS_PAYLOAD.top_stories });
    const result = await run<WebResponse>(
      newsSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'openai' },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.title).toBe('A top story');
  });

  it('returns a link only once when both blocks carry it', async () => {
    const { fetchImpl } = stubFetch({
      organic_results: [{ title: 'First', link: 'https://example.com/a' }],
      top_stories: [
        { title: 'First, again', link: 'https://example.com/a' },
        { title: 'Second', link: 'https://example.com/b' },
      ],
    });
    const result = await run<WebResponse>(
      newsSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'openai' },
    );

    expect(result.results.map((entry) => entry.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });
});

describe('scholarSearch', () => {
  it('uses the scholar engine', async () => {
    const { fetchImpl, calls } = stubFetch({
      organic_results: [
        {
          position: 1,
          title: 'Retrieval-augmented generation: a survey',
          link: 'https://link.springer.com/article/123',
          snippet: 'A survey of RAG.',
        },
      ],
    });
    const result = await run<WebResponse>(
      scholarSearch({ apiKey: 'k', fetch: fetchImpl }),
      { query: 'retrieval augmented generation' },
    );

    expect(paramsOf(calls[0]!).engine).toBe('google_scholar');
    expect(result.results[0]!.title).toBe('Retrieval-augmented generation: a survey');
  });
});
