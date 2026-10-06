/** Pure gating rules for linking accounts (the backend requires an aal2 session to link). */
import type { Aal, StoredSession } from './types';

export type AuthStatus = 'signed_out' | 'code_sent' | 'signed_in' | 'mfa_required';

/**
 * signed_out   no session
 * code_sent    no session yet; a code was emailed to pendingEmail
 * mfa_required signed in at aal1 and the user HAS a verified authenticator: enter its code
 * signed_in    signed in (aal2, or aal1 with no authenticator set up yet)
 */
export function deriveStatus(s: { session: Pick<StoredSession, 'aal'> | null; pendingEmail: string | null; mfaEnrolled: boolean | null }): AuthStatus {
  if (!s.session) return s.pendingEmail ? 'code_sent' : 'signed_out';
  if (s.session.aal === 'aal2') return 'signed_in';
  return s.mfaEnrolled ? 'mfa_required' : 'signed_in';
}

export type LinkGate = 'auth' | 'mfa' | 'ok';

/** Where "Link an account" must send the user first. */
export function linkGate(s: { status: AuthStatus; aal: Aal | null; ageConfirmed: boolean }): LinkGate {
  if (s.status === 'signed_out' || s.status === 'code_sent' || !s.ageConfirmed) return 'auth';
  if (s.aal !== 'aal2') return 'mfa';
  return 'ok';
}

export function gateRoute(g: LinkGate): '/auth' | '/auth/mfa' | null {
  return g === 'auth' ? '/auth' : g === 'mfa' ? '/auth/mfa' : null;
}

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP" so the setup key is easier to type. */
export function groupSetupKey(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}
