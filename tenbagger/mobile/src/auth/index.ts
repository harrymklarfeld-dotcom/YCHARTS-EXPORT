/** Sign-in for linking real accounts. See ./AuthClient.ts (GoTrue over fetch) and ./store.ts. */
export * from './types';
export { AuthClient, isValidEmail, type AuthClientOptions } from './AuthClient';
export { AUTH_COPY } from './copy';
export { deriveStatus, gateRoute, groupSetupKey, linkGate, type AuthStatus, type LinkGate } from './gate';
export { aalOf, decodeJwtPayload, makeUnsignedJwt } from './jwt';
export { createSandboxAuthFetch, SANDBOX_CODE, SANDBOX_TOTP_SECRET } from './sandbox';
export { MemorySessionStorage, pickSessionStorage, SecureSessionStorage, TabSessionStorage, type SecureStoreLike, type WebStorageLike, type SessionStorage } from './storage';
export { createAuthClient, friendlyAuthError, getAuthClient, resetAuthForTests, selectLinkGate, setAuthClient, useAuth, type PendingAfterAuth } from './store';
