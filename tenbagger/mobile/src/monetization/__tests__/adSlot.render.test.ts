/**
 * Render-level check that <AdSlot> produces nothing on money screens or for Pro users.
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AdSlot } from '../components/AdSlot';
import { useMonetization } from '../store';
import { FREE_SNAPSHOT } from '../entitlements';
import { setAnalyticsSinks } from '../analytics';

beforeAll(() => setAnalyticsSinks([]));

function render(props: Parameters<typeof AdSlot>[0]) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(createElement(AdSlot, props));
  });
  const json = r.toJSON();
  act(() => r.unmount());
  return json;
}

describe('<AdSlot>', () => {
  beforeEach(() => {
    useMonetization.setState({ entitlement: FREE_SNAPSHOT, adLog: {}, lessonInProgress: false });
  });

  it('renders for a free user at the end of an article', () => {
    expect(render({ placement: 'article_end', context: 'article' })).not.toBeNull();
  });

  it('renders nothing on the Money hub, bank linking or personal-finance screens', () => {
    for (const context of ['money_hub', 'bank_linking', 'personal_finance'] as const) {
      expect(render({ placement: 'article_end', context })).toBeNull();
      expect(render({ placement: 'screener_results', context, slotIndex: 0 })).toBeNull();
    }
  });

  it('renders nothing for Pro', () => {
    useMonetization.setState({ entitlement: { ...FREE_SNAPSHOT, tier: 'pro', expiresAt: null, source: 'mock' } });
    expect(render({ placement: 'article_end', context: 'article' })).toBeNull();
  });

  it('renders nothing while a lesson is in progress', () => {
    useMonetization.setState({ lessonInProgress: true });
    expect(render({ placement: 'article_end', context: 'article' })).toBeNull();
  });
});
