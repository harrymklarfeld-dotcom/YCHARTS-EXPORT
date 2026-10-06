/**
 * Plaid Link launcher. One small adapter so the rest of the app never touches the SDK.
 *
 * Mock link tokens (`link-mock-…`, from MockMoneyClient) resolve immediately with a fake public token.
 *
 * TODO(plaid-link): real Link is not wired yet. It needs:
 *   - native (iOS/Android): `react-native-plaid-link-sdk` (`npx expo install react-native-plaid-link-sdk`)
 *     plus an EAS development build (`eas build --profile development`); it does NOT run in Expo Go.
 *     Call `create({ token: linkToken })` then `open({ onSuccess: (s) => resolve({status:'success', publicToken: s.publicToken}),
 *     onExit: () => resolve({status:'exit'}) })`. Register an OAuth redirect URI / Android package name in the Plaid dashboard.
 *   - web: load https://cdn.plaid.com/link/v2/stable/link-initialize.js and call
 *     `Plaid.create({ token: linkToken, onSuccess, onExit }).open()`.
 * Until then this returns { status: 'unavailable' } for real tokens and the UI says linking needs the full build.
 */
import { MOCK_LINK_PREFIX, MOCK_PUBLIC_PREFIX } from './MockMoneyClient';

export type PlaidLinkResult =
  | { status: 'success'; publicToken: string }
  | { status: 'exit' }
  | { status: 'unavailable'; reason: string };

export function isMockLinkToken(linkToken: string): boolean {
  return linkToken.startsWith(MOCK_LINK_PREFIX);
}

export async function openPlaidLink(linkToken: string): Promise<PlaidLinkResult> {
  if (isMockLinkToken(linkToken)) {
    // link-mock-<institution>-<n> → public-mock-<institution>-<n>; update tokens need no exchange.
    return { status: 'success', publicToken: MOCK_PUBLIC_PREFIX + linkToken.slice(MOCK_LINK_PREFIX.length) };
  }
  return { status: 'unavailable', reason: 'plaid_link_sdk_not_installed' };
}
