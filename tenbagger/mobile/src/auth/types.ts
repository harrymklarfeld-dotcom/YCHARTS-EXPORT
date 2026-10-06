/** Auth shapes shared by AuthClient, the sandbox fake, storage and the zustand store. */

export type Aal = 'aal1' | 'aal2';

/** The in-memory session. Tokens never leave src/auth except via getAccessToken(). */
export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry, epoch SECONDS (from the JWT `exp`, else the server's expires_at). */
  expiresAt: number;
  userId: string;
  email: string | null;
  aal: Aal;
};

/** What we persist (secure store on iOS/Android, memory on web / sandbox). */
export type StoredSession = Session & {
  /** The user ticked "I'm 18 or older" on the email screen. Required before linking. */
  ageConfirmed: boolean;
};

export type Factor = { id: string; type: 'totp' | string; status: 'verified' | 'unverified' | string; friendlyName: string | null };

/** Shown once during enrollment so the user can add it to an authenticator app. */
export type TotpEnrollment = { factorId: string; secret: string; uri: string };

export type AuthErrorCode = 'invalid_code' | 'rate_limited' | 'network' | 'signed_out' | 'invalid_email' | 'server';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Minimal fetch surface so tests (and the sandbox fake) can inject one. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>;
