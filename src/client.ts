const DEFAULT_BASE_URL = 'https://www.searchapi.io/api/v1/search';

/** Options every SearchApi tool accepts. */
export interface SearchApiConfig {
  /** API key. Defaults to `process.env.SEARCHAPI_API_KEY`. */
  apiKey?: string;
  /** Endpoint override, mainly for testing. */
  baseUrl?: string;
  /** Number of results to request and return. Defaults to 10. */
  maxResults?: number;
  /** Country code, sent as `gl`. */
  country?: string;
  /** Language code, sent as `hl`. */
  language?: string;
  /** Geographic location, e.g. `Austin, Texas, United States`. */
  location?: string;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /** Extra query parameters passed straight through to SearchApi. */
  extraParams?: Record<string, string | number | boolean>;
  /** Custom fetch, e.g. for tests or a proxy. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

/** Thrown when SearchApi rejects a request or the network call fails. */
export class SearchApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SearchApiError';
    this.status = status;
  }
}

function resolveApiKey(config: SearchApiConfig): string {
  // Read the env without depending on @types/node, so the package also works
  // in edge runtimes where `process` may be absent.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const apiKey = config.apiKey ?? env?.SEARCHAPI_API_KEY;
  if (!apiKey) {
    throw new SearchApiError(
      'Missing SearchApi API key. Set SEARCHAPI_API_KEY or pass { apiKey }.',
    );
  }
  return apiKey;
}

/**
 * Call SearchApi and return the parsed JSON body.
 *
 * `link=resolved` is always sent so results carry destination URLs rather than
 * google.com/goto redirects, which an agent cannot follow up on.
 */
export async function searchApiRequest(
  engine: string,
  params: Record<string, string | number | boolean | undefined>,
  config: SearchApiConfig,
): Promise<Record<string, unknown>> {
  const apiKey = resolveApiKey(config);
  const url = new URL(config.baseUrl ?? DEFAULT_BASE_URL);

  url.searchParams.set('engine', engine);
  url.searchParams.set('link', 'resolved');

  const localization = {
    gl: config.country,
    hl: config.language,
    location: config.location,
  };

  for (const [key, value] of Object.entries({
    ...params,
    ...localization,
    ...config.extraParams,
  })) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const doFetch = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;

  let response: Response;
  try {
    response = await doFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'X-SearchApi-Integration': 'ai-sdk',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new SearchApiError(`SearchApi request failed: ${reason}`);
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const apiMessage =
      isRecord(body) && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new SearchApiError(`SearchApi request failed: ${apiMessage}`, response.status);
  }

  return isRecord(body) ? body : {};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read an array-of-objects block from a response, tolerating a missing block. */
export function readBlock(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const block = body[key];
  return Array.isArray(block) ? block.filter(isRecord) : [];
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Drop keys whose value is undefined so results stay compact in the prompt. */
export function compact<T extends object>(value: T): T {
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key];
  }
  return value;
}

export const DEFAULT_MAX_RESULTS = 10;

export function limitOf(config: SearchApiConfig): number {
  return config.maxResults ?? DEFAULT_MAX_RESULTS;
}
