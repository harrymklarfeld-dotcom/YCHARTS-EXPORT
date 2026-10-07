jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../data/sources', () => ({
  rawCompanies: require('../../../assets/data/companies.sample.json'),
  rawLessons: require('../../../assets/data/lessons.sample.json'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCompanies } from '../../data';
import { scoresFor, styleBoxesFor, toCsvFor } from '../../lib/screener';
import { ALL_COLUMNS, csvColumns, getColumn, sortByColumn } from '../columns';
import * as L from '../lists';
import { useScreenerPrefs } from '../store';

const NOW = Date.UTC(2026, 8, 25);

describe('lists (pure)', () => {
  it('sanitizes, toggles and moves columns within limits', () => {
    expect(L.sanitizeColumns(['pe', 'pe', 'bogus', 'score:quality'])).toEqual(['pe', 'score:quality']);
    expect(L.sanitizeColumns(['bogus'])).toEqual([...L.DEFAULT_COLUMNS]);
    expect(L.toggleColumn(['pe'], 'pe')).toEqual(['pe']); // never empty
    expect(L.toggleColumn(['pe'], 'roic')).toEqual(['pe', 'roic']);
    const full = ALL_COLUMNS.slice(0, L.MAX_COLUMNS).map((c) => c.id);
    expect(L.toggleColumn(full, 'revenue')).toHaveLength(L.MAX_COLUMNS);
    expect(L.moveColumn(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(L.moveColumn(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
  });

  it('saves, updates, renames and deletes screens (deep-copied filters)', () => {
    const filters = [{ metric: 'pe' as const, op: 'between' as const, value: [0, 20] as [number, number] }];
    let { state, id } = L.saveScreen(L.INITIAL_LISTS, { name: '  Cheap   ones ', filters, sort: { column: 'pe', dir: 'asc' } }, NOW);
    expect(state.savedScreens[0]).toMatchObject({ id, name: 'Cheap ones', columns: [...L.DEFAULT_COLUMNS], sort: { column: 'pe', dir: 'asc' } });
    (filters[0].value as number[])[1] = 99;
    expect(state.savedScreens[0].filters[0].value).toEqual([0, 20]);
    ({ state } = L.saveScreen(state, { id, name: 'Renamed', filters: [] }, NOW + 1));
    expect(state.savedScreens).toHaveLength(1);
    expect(state.savedScreens[0]).toMatchObject({ name: 'Renamed', updatedAt: NOW + 1, createdAt: NOW });
    expect(L.saveScreen(state, { name: '', filters: [] }, NOW).state.savedScreens[0].name).toBe('My screen 2');
    state = L.renameScreen(state, id, 'x'.repeat(100), NOW);
    expect(state.savedScreens[0].name).toHaveLength(L.MAX_NAME_LENGTH);
    expect(L.deleteScreen(state, id).savedScreens).toEqual([]);
  });

  it('watchlists: normalized, deduplicated tickers; toggle add/remove', () => {
    let { state, id } = L.createWatchlist(L.INITIAL_LISTS, '', [' cost', 'COST', 'mu'], NOW);
    expect(state.watchlists[0]).toMatchObject({ name: 'Watchlist 1', tickers: ['COST', 'MU'] });
    state = L.toggleTicker(state, id, 'mu');
    expect(state.watchlists[0].tickers).toEqual(['COST']);
    state = L.toggleTicker(state, id, 'nvda');
    expect(state.watchlists[0].tickers).toEqual(['COST', 'NVDA']);
    state = L.renameWatchlist(state, id, 'Chips');
    expect(state.watchlists[0].name).toBe('Chips');
    expect(L.deleteWatchlist(state, id).watchlists).toEqual([]);
  });
});

describe('useScreenerPrefs (zustand + AsyncStorage)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useScreenerPrefs.setState({ ...L.INITIAL_LISTS });
  });

  it('persists columns, screens and watchlists to AsyncStorage', async () => {
    const s = useScreenerPrefs.getState();
    s.toggleColumn('revenue');
    const sid = s.saveScreen({ name: 'Mine', filters: [{ metric: 'roic', op: '>', value: 0.15 }] }, NOW);
    const wid = s.createWatchlist('Watch', ['cost'], NOW);
    useScreenerPrefs.getState().toggleTicker(wid, 'MU');
    const st = useScreenerPrefs.getState();
    expect(st.columns).toContain('revenue');
    expect(st.savedScreens[0].id).toBe(sid);
    expect(st.watchlists[0].tickers).toEqual(['COST', 'MU']);
    await new Promise((r) => setTimeout(r, 0));
    const raw = JSON.parse((await AsyncStorage.getItem('tenbagger-screener-v2'))!);
    expect(raw.state.columns).toContain('revenue');
    expect(raw.state.savedScreens[0].name).toBe('Mine');
    expect(raw.state.watchlists[0].name).toBe('Watch');
    expect(raw.state.hydrated).toBeUndefined();
  });

  it('rehydrates and drops unknown columns from old storage', async () => {
    await AsyncStorage.setItem('tenbagger-screener-v2', JSON.stringify({ state: { columns: ['bogus', 'pe'], savedScreens: [], watchlists: [] }, version: 1 }));
    await useScreenerPrefs.persist.rehydrate();
    expect(useScreenerPrefs.getState().columns).toEqual(['pe']);
    expect(useScreenerPrefs.getState().hydrated).toBe(true);
  });
});

describe('columns + csv', () => {
  const companies = getCompanies();
  const ctx = { scores: scoresFor(companies), styles: styleBoxesFor(companies) };

  it('score and style columns read the package output; sort puts nulls last', () => {
    const q = getColumn('score:quality')!;
    for (const c of companies) {
      const s = ctx.scores.get(c.ticker)!.quality.score;
      expect(q.display(c, ctx)).toBe(s === null ? '—' : String(s));
    }
    const byPe = sortByColumn(companies, 'pe', 'asc', ctx);
    expect(byPe[byPe.length - 1].metrics.pe).toBeNull();
    const byQ = sortByColumn(companies, 'score:quality', 'desc', ctx);
    expect(ctx.scores.get(byQ[0].ticker)!.quality.score).toBe(Math.max(...companies.map((c) => ctx.scores.get(c.ticker)!.quality.score ?? -1)));
  });

  it('exports only our columns as CSV text with a source line', () => {
    const csv = toCsvFor(companies.slice(0, 2), csvColumns(['pe', 'score:value', 'style'], ctx), 'Source: filings');
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Ticker,Name,Sector,Fiscal year,P/E (x),Value (0-100),Style');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('# Source: filings');
  });
});
