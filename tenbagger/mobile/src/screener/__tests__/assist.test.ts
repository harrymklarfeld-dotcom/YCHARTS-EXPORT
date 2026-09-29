import { askScreener, createBackendAdapter, createMockAdapter, getAssistAdapter, setAssistAuthTokenGetter, type AssistAdapter } from '../assist';

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({ ok: status >= 200 && status < 300, status, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }, json: async () => body }) as unknown as Response;

describe('askScreener', () => {
  it('parses exact queries on the device without touching the adapter', async () => {
    const adapter: AssistAdapter = { name: 'backend', ask: jest.fn() };
    const a = await askScreener('pe < 20 and roic > 15%', adapter);
    expect(a.adapter).toBe('device');
    expect(a.filters).toEqual([{ metric: 'pe', op: '<', value: 20 }, { metric: 'roic', op: '>', value: 0.15 }]);
    expect(adapter.ask).not.toHaveBeenCalled();
  });

  it('mock adapter reads "cheap" as P/E < 15 and P/B < 2 with a visible note', async () => {
    const a = await askScreener('cheap companies', createMockAdapter());
    expect(a.adapter).toBe('mock');
    expect(a.filters).toEqual([{ metric: 'pe', op: '<', value: 15 }, { metric: 'pb', op: '<', value: 2 }]);
    expect(a.notes.join(' ')).toMatch(/“cheap” was read as/);
  });

  it('fully-understood fuzzy text skips the backend (no model call)', async () => {
    const adapter: AssistAdapter = { name: 'backend', ask: jest.fn() };
    const a = await askScreener('cheap profitable companies with low debt', adapter);
    expect(a.filters).toHaveLength(4);
    expect(adapter.ask).not.toHaveBeenCalled();
  });

  it('uses the backend for unexplained words and re-validates its filters', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, {
        filters: [{ metric: 'gross_margin', op: '>', value: 0.7 }, { metric: 'made_up', op: '>', value: 1 }],
        restatement: 'Companies with gross margin above 70%.',
        notes: ['software-like → gross margin above 70%'],
        unrecognized: [],
        source: 'model',
      }),
    ) as unknown as typeof fetch;
    const adapter = createBackendAdapter({ supabaseUrl: 'https://x.supabase.co/', anonKey: 'anon', getAccessToken: () => 'jwt', fetchImpl });
    const a = await askScreener('software-like economics', adapter);
    expect(a.adapter).toBe('backend');
    expect(a.filters).toEqual([{ metric: 'gross_margin', op: '>', value: 0.7 }]);
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toBe('https://x.supabase.co/functions/v1/screen-assist');
    expect(init.headers.authorization).toBe('Bearer jwt');
    expect(init.headers.apikey).toBe('anon');
    expect(JSON.parse(init.body)).toEqual({ text: 'software-like economics' });
  });

  it('falls back to the offline reading on rate limit, auth or network errors', async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => jsonResponse(429, { error: 'rate_limited' }, { 'retry-after': '30' }),
      async () => jsonResponse(500, { error: 'internal_error' }),
      async () => {
        throw new TypeError('offline');
      },
    ];
    for (const f of cases) {
      const adapter = createBackendAdapter({ supabaseUrl: 'https://x.supabase.co', getAccessToken: () => 'jwt', fetchImpl: f as unknown as typeof fetch });
      const a = await askScreener('cheap and loved by founders', adapter);
      expect(a.degraded).toBe(true);
      expect(a.filters).toEqual([{ metric: 'pe', op: '<', value: 15 }, { metric: 'pb', op: '<', value: 2 }]);
      expect(a.notes[0]).toMatch(/offline reading/);
    }
    const noToken = createBackendAdapter({ supabaseUrl: 'https://x.supabase.co', getAccessToken: () => null, fetchImpl: jest.fn() as unknown as typeof fetch });
    expect((await askScreener('loved by founders', noToken)).notes[0]).toMatch(/Sign in/);
  });

  it('selects the mock unless a Supabase URL and a token getter are both present', () => {
    expect(getAssistAdapter({}).name).toBe('mock');
    expect(getAssistAdapter({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }).name).toBe('mock');
    setAssistAuthTokenGetter(() => 'jwt');
    expect(getAssistAdapter({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }).name).toBe('backend');
    setAssistAuthTokenGetter(null);
  });

  it('empty input returns no filters', async () => {
    expect((await askScreener('   ', createMockAdapter())).filters).toEqual([]);
  });
});
