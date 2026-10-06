jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { buildDashboard } from '../dashboard';
import { findBannedPhrases } from '../engine';
import { buildMoneyHub, sampleMoneyData } from '../hub';
import {
  agoText,
  CONNECTION_STATUS_LABEL,
  CONNECTIONS_COPY,
  cooldownRemaining,
  HOME_LINK_COPY,
  homeFreshness,
  HttpMoneyClient,
  isMockLinkToken,
  mapItemStatus,
  MOCK_INSTITUTIONS,
  MockMoneyClient,
  openPlaidLink,
  planRefresh,
  readMoneyConfig,
  REFRESH_COOLDOWN_MS,
  selectHomeData,
  setMoneyClient,
  staleIds,
  statusChip,
  summaryToMoneyData,
  useConnections,
  type Connection,
} from '../live';
import { buildMockMoneyData } from '../live/mockFixtures';

const NOW = new Date('2026-10-06T15:00:00Z');
const clock = () => NOW;

async function linkVia(client: MockMoneyClient, institutionId: string) {
  const token = await client.createLinkToken({ institutionId });
  const r = await openPlaidLink(token.linkToken);
  if (r.status !== 'success') throw new Error('mock link should succeed');
  return client.exchangePublicToken(r.publicToken);
}

describe('MockMoneyClient (sandbox linking)', () => {
  it('links fictional institutions, labelled sandbox, and builds MoneyData from linked ones only', async () => {
    const client = new MockMoneyClient({ now: clock });
    expect(await client.listConnections()).toEqual([]);
    await expect(client.fetchSummary()).rejects.toThrow();

    const chase = await linkVia(client, 'chase');
    expect(chase).toMatchObject({ institution: 'Chase (sandbox)', status: 'active', sample: true, provider: 'mock' });
    let data = await client.fetchSummary();
    expect(data.sample).toBe(true);
    expect(data.snapshots.at(-1)!.accounts.map((a) => a.id)).toEqual(['chase-chk']);

    await linkVia(client, 'ally');
    await linkVia(client, 'robinhood');
    const discover = await linkVia(client, 'discover');
    expect(discover.status).toBe('needs_relogin');
    expect((await client.listConnections()).find((c) => c.institutionId === 'ally')!.status).toBe('expiring');

    data = await client.fetchSummary();
    const latest = data.snapshots.at(-1)!;
    expect(latest.accounts.map((a) => a.kind).sort()).toEqual(['brokerage', 'checking', 'credit_card', 'savings']);
    // The card needs a sign-in, so its balance is from its last update two days ago.
    expect(latest.accounts.find((a) => a.id === 'discover-card')!.asOf).toBe('2026-10-04');
    // A transfer between two linked banks: both legs present.
    const tx = data.transactions ?? [];
    expect(tx.some((t) => t.accountId === 'chase-chk' && t.amount === -150 && /ALLY/.test(t.name))).toBe(true);
    expect(tx.some((t) => t.accountId === 'ally-sav' && t.amount === 150 && /CHASE/.test(t.name))).toBe(true);
  });

  it('refresh fails for needs_relogin until the user signs in again; unlink removes the connection', async () => {
    const client = new MockMoneyClient({ now: clock });
    const card = await linkVia(client, 'discover');
    expect((await client.refresh([card.id]))[0]).toMatchObject({ ok: false, status: 'needs_relogin' });
    const upd = await client.createLinkToken({ itemId: card.id });
    expect(upd.mode).toBe('update');
    expect((await openPlaidLink(upd.linkToken)).status).toBe('success');
    expect((await client.refresh([card.id]))[0]).toMatchObject({ ok: true, status: 'active' });
    expect((await client.listConnections())[0].lastSyncedAt).toBe(NOW.toISOString());

    await client.unlink(card.id);
    expect(await client.listConnections()).toEqual([]);
  });

  it('linking the same institution twice keeps one connection; mock tokens never look like real Plaid tokens', async () => {
    const client = new MockMoneyClient({ now: clock });
    const a = await linkVia(client, 'chase');
    const b = await linkVia(client, 'chase');
    expect(b.id).toBe(a.id);
    expect(isMockLinkToken('link-sandbox-0000')).toBe(false);
    expect((await openPlaidLink('link-sandbox-1234')).status).toBe('unavailable');
  });

  it('every subset of sandbox institutions builds a hub and a dashboard', () => {
    const ids = MOCK_INSTITUTIONS.map((i) => i.id);
    for (let mask = 1; mask < 1 << ids.length; mask++) {
      const linked = ids.filter((_, i) => mask & (1 << i)).map((institutionId) => ({ institutionId, lastSyncedAt: NOW.toISOString() }));
      const data = buildMockMoneyData(linked, NOW);
      expect(() => buildMoneyHub(data)).not.toThrow();
      expect(() => buildDashboard(data)).not.toThrow();
    }
  });
});

describe('connections store: live vs sample', () => {
  beforeEach(() => {
    setMoneyClient(new MockMoneyClient({ now: clock }));
    useConnections.getState().reset();
  });
  afterAll(() => setMoneyClient(null));

  it('Home shows the sample with no connections, live data after linking, and the sample again after unlinking', async () => {
    expect(selectHomeData(useConnections.getState())).toEqual({ data: sampleMoneyData, live: false });
    const r = await useConnections.getState().link('chase');
    expect(r.ok).toBe(true);
    const s = useConnections.getState();
    expect(s.connections).toHaveLength(1);
    const home = selectHomeData(s);
    expect(home.live).toBe(true);
    expect(home.data.persona.name).toBe('Jordan');
    expect(home.data.sample).toBe(true); // sandbox data stays labelled as sample

    // Persisted slice: ids/timestamps only, never balances or tokens.
    const persisted = JSON.stringify((useConnections as unknown as { persist: { getOptions(): { partialize(x: unknown): unknown } } }).persist.getOptions().partialize(s));
    expect(persisted).not.toMatch(/balance|token|742\.18|Chase checking/i);

    await useConnections.getState().unlink(s.connections[0].id);
    expect(selectHomeData(useConnections.getState()).live).toBe(false);
  });

  it('refresh respects the 15-minute cooldown', async () => {
    await useConnections.getState().link('chase');
    const spy = jest.spyOn(MockMoneyClient.prototype, 'refresh');
    const first = await useConnections.getState().refresh();
    expect(first.message).toBe(CONNECTIONS_COPY.refreshCooling); // linking counts as the first attempt
    expect(spy).not.toHaveBeenCalled();
    const id = useConnections.getState().connections[0].id;
    useConnections.setState({ lastAttempt: { [id]: Date.now() - REFRESH_COOLDOWN_MS - 1 } });
    await useConnections.getState().refresh();
    expect(spy).toHaveBeenCalledWith([id]);
    spy.mockRestore();
  });
});

describe('freshness + cooldown helpers', () => {
  const base: Connection = { id: 'a', institutionId: 'chase', institution: 'Chase (sandbox)', provider: 'mock', status: 'active', accountsCount: 1, lastSyncedAt: null, sample: true };
  const nowMs = NOW.getTime();
  const minsAgo = (m: number) => new Date(nowMs - m * 60_000).toISOString();

  it('cooldown', () => {
    expect(cooldownRemaining(undefined, nowMs)).toBe(0);
    expect(cooldownRemaining(nowMs - 5 * 60_000, nowMs)).toBe(10 * 60_000);
    expect(cooldownRemaining(nowMs - 16 * 60_000, nowMs)).toBe(0);
    expect(planRefresh(['a', 'b', 'c'], { a: nowMs - 60_000, b: nowMs - 20 * 60_000 }, nowMs)).toEqual({ due: ['b', 'c'], cooling: ['a'] });
  });

  it('stale (6 h) skips connections that need a sign-in', () => {
    const cs: Connection[] = [
      { ...base, id: 'fresh', lastSyncedAt: minsAgo(30) },
      { ...base, id: 'old', lastSyncedAt: minsAgo(7 * 60) },
      { ...base, id: 'never' },
      { ...base, id: 'relogin', status: 'needs_relogin', lastSyncedAt: minsAgo(3000) },
    ];
    expect(staleIds(cs, nowMs)).toEqual(['old', 'never']);
  });

  it('ago text, status chips and the Home line', () => {
    expect(agoText(null, nowMs)).toBe('not yet');
    expect(agoText(minsAgo(0.5), nowMs)).toBe('just now');
    expect(agoText(minsAgo(5), nowMs)).toBe('5 min ago');
    expect(agoText(minsAgo(180), nowMs)).toBe('3 hr ago');
    expect(agoText(minsAgo(60 * 24 * 2), nowMs)).toBe('2 days ago');
    expect(statusChip({ ...base, status: 'needs_relogin' }, false).label).toBe('Sign in again');
    expect(statusChip({ ...base, status: 'expiring' }, false).label).toBe('Expiring soon');
    expect(statusChip(base, true).label).toBe('Updating');
    expect(statusChip(base, false).label).toBe('Connected');
    expect(homeFreshness([], nowMs)).toBe('');
    expect(
      homeFreshness(
        [
          { ...base, lastSyncedAt: minsAgo(5) },
          { ...base, id: 'b', lastSyncedAt: minsAgo(40) },
          { ...base, id: 'c', status: 'needs_relogin', lastSyncedAt: minsAgo(3000) },
        ],
        nowMs,
      ),
    ).toBe('3 connections · updated 40 min ago · 1 needs a quick sign-in');
  });
});

describe('HTTP client + config', () => {
  it('uses mock unless both a URL and anon key are set', () => {
    expect(readMoneyConfig({}).mode).toBe('mock');
    expect(readMoneyConfig({ url: 'https://x.supabase.co' }).mode).toBe('mock');
    expect(readMoneyConfig({ url: 'https://x.supabase.co', key: 'anon' }).mode).toBe('http');
    expect(readMoneyConfig({ url: 'https://x.supabase.co', key: 'anon', mode: 'mock' }).mode).toBe('mock');
  });

  it('maps backend item statuses (PENDING_EXPIRATION → expiring) and calls functions with bearer + apikey', async () => {
    expect(mapItemStatus('needs_reauth', 'ITEM_LOGIN_REQUIRED')).toBe('needs_relogin');
    expect(mapItemStatus('needs_reauth', 'PENDING_EXPIRATION')).toBe('expiring');
    const calls: Array<{ url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
    const fetch = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      calls.push({ url, init });
      const body = url.endsWith('plaid-link-token') ? { link_token: 'link-sandbox-x', expiration: null, mode: 'create', money_hub: true } : { results: [{ item_id: 'i1', status: 'succeeded', item_status: 'active' }], snapshot_id: 's' };
      return { ok: true, status: 200, json: async () => body };
    };
    const c = new HttpMoneyClient({ baseUrl: 'https://x.supabase.co/', anonKey: 'anon', getAccessToken: async () => 'jwt', fetch });
    expect((await c.createLinkToken()).linkToken).toBe('link-sandbox-x');
    expect((await c.refresh(['i1']))[0]).toMatchObject({ ok: true, status: 'active' });
    expect(calls[0].url).toBe('https://x.supabase.co/functions/v1/plaid-link-token');
    expect(calls[0].init!.headers).toMatchObject({ apikey: 'anon', authorization: 'Bearer jwt' });
    expect(JSON.parse(calls[0].init!.body!)).toEqual({ money_hub: true });
    expect(JSON.parse(calls[1].init!.body!)).toEqual({ item_id: 'i1' });

    const signedOut = new HttpMoneyClient({ baseUrl: 'https://x', anonKey: 'a', getAccessToken: async () => null, fetch });
    await expect(signedOut.listConnections()).rejects.toMatchObject({ code: 'signed_out' });
  });

  it('turns a money-summary into non-sample MoneyData', () => {
    const d = summaryToMoneyData({
      asOf: '2026-10-06',
      horizonDays: 45,
      accounts: [{ id: 'a', name: 'Checking', kind: 'checking', balance: 10, asOf: '2026-10-06', basis: 'verified' }],
      liabilities: [],
      incomeStreams: [],
      deposits: [],
      snapshots: [],
    });
    expect(d.sample).toBe(false);
    expect(d.snapshots).toHaveLength(1);
    expect(() => buildMoneyHub(d)).not.toThrow();
  });
});

describe('connections copy', () => {
  it('has no advice or credit-offer wording and promises read-only', () => {
    const strings = [
      ...Object.values(CONNECTIONS_COPY).map((v) => (typeof v === 'function' ? `${v(1)} ${v(3)} ${v(null)}` : v)),
      ...Object.values(CONNECTION_STATUS_LABEL),
      ...Object.values(HOME_LINK_COPY),
      ...MOCK_INSTITUTIONS.map((i) => `${i.name} ${i.kind}`),
    ];
    for (const s of strings) expect(findBannedPhrases(s)).toEqual([]);
    expect(CONNECTIONS_COPY.readOnly).toMatch(/never move money/);
    expect(MOCK_INSTITUTIONS.every((i) => /\(sandbox\)/.test(i.name))).toBe(true);
  });
});
