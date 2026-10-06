/** openPlaidLink: path selection (mock / web / native / unavailable) and exit vs error mapping. */
import { openPlaidLink, type NativePlaidSdk, type PlaidLinkDeps, type WebPlaid } from '../live/plaidLink';

type NativeConfig = Parameters<NativePlaidSdk['createPlaidLinkSession']>[0];
type WebConfig = Parameters<WebPlaid['create']>[0];

const noNative = () => null;
const noWeb = async () => null;

function fakeNative(act: (cfg: NativeConfig) => void): { sdk: NativePlaidSdk; opened: jest.Mock } {
  const opened = jest.fn(async (_fullScreen?: boolean) => {});
  const sdk: NativePlaidSdk = {
    createPlaidLinkSession: async (cfg) => ({
      open: async (fullScreen) => {
        await opened(fullScreen);
        act(cfg);
      },
    }),
  };
  return { sdk, opened };
}

function fakeWeb(act: (cfg: WebConfig) => void): { plaid: WebPlaid; destroy: jest.Mock } {
  const destroy = jest.fn();
  const plaid: WebPlaid = { create: (cfg) => ({ open: () => act(cfg), destroy }) };
  return { plaid, destroy };
}

const deps = (p: Partial<PlaidLinkDeps> & { platform: string }): PlaidLinkDeps => ({
  loadNativeSdk: noNative,
  loadWebPlaid: noWeb,
  ...p,
});

describe('openPlaidLink', () => {
  it('mock tokens resolve without touching any SDK', async () => {
    const loadNativeSdk = jest.fn(noNative);
    const loadWebPlaid = jest.fn(noWeb);
    const r = await openPlaidLink('link-mock-chase-1', { platform: 'ios', loadNativeSdk, loadWebPlaid });
    expect(r).toEqual({ status: 'success', publicToken: 'public-mock-chase-1', institution: null, accounts: [] });
    expect(loadNativeSdk).not.toHaveBeenCalled();
    expect(loadWebPlaid).not.toHaveBeenCalled();
  });

  it('native: unavailable when the module is missing (Expo Go)', async () => {
    for (const platform of ['ios', 'android']) {
      expect(await openPlaidLink('link-sandbox-1', deps({ platform }))).toEqual({ status: 'unavailable', reason: 'native_module_missing' });
    }
  });

  it('default deps in Jest (no native module) report unavailable instead of throwing', async () => {
    expect((await openPlaidLink('link-sandbox-1')).status).toBe('unavailable');
  });

  it('native: success maps public token, institution and accounts', async () => {
    const { sdk, opened } = fakeNative((cfg) =>
      cfg.onSuccess({
        publicToken: 'public-sandbox-abc',
        metadata: { institution: { id: 'ins_3', name: 'Chase' }, accounts: [{ id: 'a1', name: 'Checking', mask: '0000', type: 'depository', subtype: 'checking' }] },
      }),
    );
    const r = await openPlaidLink('link-sandbox-1', deps({ platform: 'ios', loadNativeSdk: () => sdk }));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(r).toEqual({
      status: 'success',
      publicToken: 'public-sandbox-abc',
      institution: { id: 'ins_3', name: 'Chase' },
      accounts: [{ id: 'a1', name: 'Checking', mask: '0000', type: 'depository', subtype: 'checking' }],
    });
  });

  it('native: plain close is exit; close with error is error', async () => {
    const cancel = fakeNative((cfg) => cfg.onExit({}));
    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'android', loadNativeSdk: () => cancel.sdk }))).toEqual({ status: 'exit' });

    const failed = fakeNative((cfg) =>
      cfg.onExit({ error: { errorCode: 'INVALID_CREDENTIALS', errorMessage: 'raw', displayMessage: 'The credentials were not correct.' } }),
    );
    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'ios', loadNativeSdk: () => failed.sdk }))).toEqual({
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      message: 'The credentials were not correct.',
    });
  });

  it('native: a session that fails to open becomes an error, not a crash', async () => {
    const sdk: NativePlaidSdk = { createPlaidLinkSession: async () => Promise.reject(new Error('INVALID_LINK_TOKEN')) };
    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'ios', loadNativeSdk: () => sdk }))).toEqual({
      status: 'error',
      code: 'LINK_OPEN_FAILED',
      message: 'INVALID_LINK_TOKEN',
    });
  });

  it('web: uses Plaid.create and never the native SDK', async () => {
    const loadNativeSdk = jest.fn(noNative);
    const { plaid, destroy } = fakeWeb((cfg) =>
      cfg.onSuccess('public-sandbox-web', { institution: { institution_id: 'ins_3', name: 'Chase' }, accounts: [{ id: 'a1', name: 'Checking' }] }),
    );
    const r = await openPlaidLink('link-sandbox-1', { platform: 'web', loadNativeSdk, loadWebPlaid: async () => plaid });
    expect(r).toEqual({
      status: 'success',
      publicToken: 'public-sandbox-web',
      institution: { id: 'ins_3', name: 'Chase' },
      accounts: [{ id: 'a1', name: 'Checking', mask: null, type: null, subtype: null }],
    });
    expect(loadNativeSdk).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  it('web: exit vs error, and a script that fails to load', async () => {
    const cancel = fakeWeb((cfg) => cfg.onExit(null, {}));
    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'web', loadWebPlaid: async () => cancel.plaid }))).toEqual({ status: 'exit' });

    const failed = fakeWeb((cfg) => cfg.onExit({ error_code: 'INSTITUTION_DOWN', error_message: 'down', display_message: null }, {}));
    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'web', loadWebPlaid: async () => failed.plaid }))).toEqual({
      status: 'error',
      code: 'INSTITUTION_DOWN',
      message: 'down',
    });

    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'web' }))).toEqual({ status: 'unavailable', reason: 'web_script_failed' });
  });

  it('other platforms are unavailable', async () => {
    expect(await openPlaidLink('link-sandbox-1', deps({ platform: 'windows' }))).toEqual({ status: 'unavailable', reason: 'unsupported_platform' });
  });
});
