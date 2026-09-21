import { expect } from 'vitest';

export interface FetchCall {
  url: URL;
  init: RequestInit | undefined;
}

/** A fetch stand-in that records calls and replies with a fixed payload. */
export function stubFetch(payload: unknown, init: { status?: number; ok?: boolean } = {}) {
  const calls: FetchCall[] = [];
  const status = init.status ?? 200;

  const fetchImpl = (async (input: URL | RequestInfo, requestInit?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init: requestInit });
    return {
      ok: init.ok ?? status < 400,
      status,
      json: async () => payload,
    } as Response;
  }) as typeof globalThis.fetch;

  return { fetchImpl, calls };
}

/** Fetch stand-in whose body is not JSON, as a gateway error page would be. */
export function stubBrokenFetch(status = 502) {
  const fetchImpl = (async () =>
    ({
      ok: false,
      status,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    }) as unknown as Response) as typeof globalThis.fetch;
  return fetchImpl;
}

/** Invoke a tool's execute the way the AI SDK would. */
export async function run<T>(
  toolInstance: { execute?: (input: never, options: never) => unknown },
  input: unknown,
): Promise<T> {
  expect(toolInstance.execute).toBeTypeOf('function');
  const options = { toolCallId: 'test-call', messages: [] };
  return (await toolInstance.execute!(input as never, options as never)) as T;
}

export function paramsOf(call: FetchCall): Record<string, string> {
  return Object.fromEntries(call.url.searchParams.entries());
}

export function headersOf(call: FetchCall): Record<string, string> {
  return (call.init?.headers ?? {}) as Record<string, string>;
}
