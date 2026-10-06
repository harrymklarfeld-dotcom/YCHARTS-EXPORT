/**
 * Plaid Link launcher. One small adapter so the rest of the app never touches the SDK.
 *
 * Paths, picked in this order:
 *   mock         `link-mock-…` tokens (MockMoneyClient) resolve immediately with a fake public token.
 *   web          loads https://cdn.plaid.com/link/v2/stable/link-initialize.js once, then
 *                `Plaid.create({ token, onSuccess, onExit }).open()`.
 *   native       `react-native-plaid-link-sdk` v13 (an Expo module, autolinked, no config plugin):
 *                `createPlaidLinkSession({ token, onSuccess, onExit, onEvent })` then `session.open()`.
 *                Needs an EAS development/preview build; Expo Go has no Plaid native code.
 *   unavailable  native module absent (Expo Go, Jest) or the web script failed to load. Never throws.
 *
 * OAuth banks (e.g. Chase): the link token decides the redirect, not this file. The backend sets
 * `redirect_uri` from PLAID_REDIRECT_URI; on iOS that must be an https universal link whose host is
 * in EXPO_PUBLIC_PLAID_REDIRECT_URI (app.config.ts adds `applinks:<host>`), and both must be listed
 * under "Allowed redirect URIs" in the Plaid dashboard. Android OAuth uses the app package name
 * (`android_package_name` in /link/token/create, registered in the dashboard) instead.
 */
import { Platform } from 'react-native';
import { MOCK_LINK_PREFIX, MOCK_PUBLIC_PREFIX } from './MockMoneyClient';

export type PlaidLinkInstitution = { id: string; name: string };
export type PlaidLinkAccount = { id: string; name: string | null; mask: string | null; type: string | null; subtype: string | null };

export type PlaidLinkUnavailableReason = 'native_module_missing' | 'web_script_failed' | 'unsupported_platform';

export type PlaidLinkResult =
  | { status: 'success'; publicToken: string; institution: PlaidLinkInstitution | null; accounts: PlaidLinkAccount[] }
  /** The person closed Link without an error. Nothing changed. */
  | { status: 'exit' }
  /** Link closed because of an error (bad credentials, institution down, expired token…). */
  | { status: 'error'; code: string; message: string }
  | { status: 'unavailable'; reason: PlaidLinkUnavailableReason };

// ─── SDK shapes we rely on (kept minimal so tests can fake them) ─────────────────────────────

/** Subset of react-native-plaid-link-sdk v13 used here. */
export interface NativePlaidSdk {
  createPlaidLinkSession(config: {
    token: string;
    onSuccess: (s: {
      publicToken: string;
      metadata: { institution?: { id: string; name: string }; accounts: Array<{ id: string; name?: string; mask?: string; type?: string; subtype?: string }> };
    }) => void;
    onExit: (e: { error?: { errorCode: string; errorMessage: string; displayMessage?: string } }) => void;
    onEvent: (e: unknown) => void;
  }): Promise<{ open: (fullScreen?: boolean) => Promise<void> }>;
}

/** Subset of the web `window.Plaid` global. */
export interface WebPlaid {
  create(config: {
    token: string;
    onSuccess: (
      publicToken: string,
      metadata: {
        institution?: { institution_id: string; name: string } | null;
        accounts?: Array<{ id: string; name?: string | null; mask?: string | null; type?: string | null; subtype?: string | null }>;
      },
    ) => void;
    onExit: (err: { error_code?: string; error_message?: string; display_message?: string | null } | null, metadata: unknown) => void;
  }): { open: () => void; destroy?: () => void };
}

export interface PlaidLinkDeps {
  platform: string;
  loadNativeSdk: () => NativePlaidSdk | null;
  loadWebPlaid: () => Promise<WebPlaid | null>;
}

// ─── Defaults ────────────────────────────────────────────────────────────────────────────────

const NATIVE_MODULE_NAME = 'ReactNativePlaidLinkSdk';
export const PLAID_WEB_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

/** Lazy and guarded: in Expo Go / Jest the native module is missing, and requiring the SDK would throw. */
function defaultLoadNativeSdk(): NativePlaidSdk | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
    if (!requireOptionalNativeModule(NATIVE_MODULE_NAME)) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('react-native-plaid-link-sdk') as NativePlaidSdk;
    return typeof sdk.createPlaidLinkSession === 'function' ? sdk : null;
  } catch {
    return null;
  }
}

let webScript: Promise<WebPlaid | null> | null = null;

/** Injects the Plaid web script once; a failed load is retried on the next attempt. */
function defaultLoadWebPlaid(): Promise<WebPlaid | null> {
  const g = globalThis as unknown as { Plaid?: WebPlaid; document?: Document };
  if (g.Plaid) return Promise.resolve(g.Plaid);
  if (!g.document) return Promise.resolve(null);
  if (!webScript) {
    const doc = g.document;
    webScript = new Promise<WebPlaid | null>((resolve) => {
      const el = doc.createElement('script');
      el.src = PLAID_WEB_SCRIPT;
      el.async = true;
      el.onload = () => resolve(g.Plaid ?? null);
      el.onerror = () => {
        el.remove();
        resolve(null);
      };
      doc.head.appendChild(el);
    }).then((p) => {
      if (!p) webScript = null;
      return p;
    });
  }
  return webScript;
}

export const defaultPlaidLinkDeps = (): PlaidLinkDeps => ({
  platform: Platform.OS,
  loadNativeSdk: defaultLoadNativeSdk,
  loadWebPlaid: defaultLoadWebPlaid,
});

// ─── Adapter ─────────────────────────────────────────────────────────────────────────────────

export function isMockLinkToken(linkToken: string): boolean {
  return linkToken.startsWith(MOCK_LINK_PREFIX);
}

const errorResult = (code: string | undefined, message: string | null | undefined): PlaidLinkResult => ({
  status: 'error',
  code: code || 'UNKNOWN',
  message: message || '',
});

function openNative(sdk: NativePlaidSdk, token: string): Promise<PlaidLinkResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: PlaidLinkResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    sdk
      .createPlaidLinkSession({
        token,
        onSuccess: (s) =>
          done({
            status: 'success',
            publicToken: s.publicToken,
            institution: s.metadata?.institution ? { id: s.metadata.institution.id, name: s.metadata.institution.name } : null,
            accounts: (s.metadata?.accounts ?? []).map((a) => ({
              id: a.id,
              name: a.name ?? null,
              mask: a.mask ?? null,
              type: a.type ?? null,
              subtype: a.subtype ?? null,
            })),
          }),
        onExit: (e) => done(e?.error ? errorResult(e.error.errorCode, e.error.displayMessage || e.error.errorMessage) : { status: 'exit' }),
        onEvent: () => {},
      })
      .then((session) => session.open())
      .catch((err: unknown) => done(errorResult('LINK_OPEN_FAILED', err instanceof Error ? err.message : String(err))));
  });
}

function openWeb(plaid: WebPlaid, token: string): Promise<PlaidLinkResult> {
  return new Promise((resolve) => {
    let settled = false;
    let handler: ReturnType<WebPlaid['create']> | null = null;
    const done = (r: PlaidLinkResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
      handler?.destroy?.();
    };
    try {
      handler = plaid.create({
        token,
        onSuccess: (publicToken, metadata) =>
          done({
            status: 'success',
            publicToken,
            institution: metadata?.institution ? { id: metadata.institution.institution_id, name: metadata.institution.name } : null,
            accounts: (metadata?.accounts ?? []).map((a) => ({
              id: a.id,
              name: a.name ?? null,
              mask: a.mask ?? null,
              type: a.type ?? null,
              subtype: a.subtype ?? null,
            })),
          }),
        onExit: (err) => done(err ? errorResult(err.error_code, err.display_message || err.error_message) : { status: 'exit' }),
      });
      handler.open();
    } catch (err) {
      done(errorResult('LINK_OPEN_FAILED', err instanceof Error ? err.message : String(err)));
    }
  });
}

export async function openPlaidLink(linkToken: string, deps: PlaidLinkDeps = defaultPlaidLinkDeps()): Promise<PlaidLinkResult> {
  if (isMockLinkToken(linkToken)) {
    // link-mock-<institution>-<n> → public-mock-<institution>-<n>; update tokens need no exchange.
    return { status: 'success', publicToken: MOCK_PUBLIC_PREFIX + linkToken.slice(MOCK_LINK_PREFIX.length), institution: null, accounts: [] };
  }
  if (deps.platform === 'web') {
    const plaid = await deps.loadWebPlaid().catch(() => null);
    return plaid ? openWeb(plaid, linkToken) : { status: 'unavailable', reason: 'web_script_failed' };
  }
  if (deps.platform === 'ios' || deps.platform === 'android') {
    const sdk = deps.loadNativeSdk();
    return sdk ? openNative(sdk, linkToken) : { status: 'unavailable', reason: 'native_module_missing' };
  }
  return { status: 'unavailable', reason: 'unsupported_platform' };
}
