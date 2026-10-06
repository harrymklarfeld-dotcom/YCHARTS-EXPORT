/**
 * Every user-facing string on the Connections screen, in one place so the test can scan it for
 * advice / credit-offer wording (findBannedPhrases). Shame-free: a broken link is the bank's
 * routine security step, never the user's fault.
 */
export const CONNECTION_STATUS_LABEL = {
  active: 'Connected',
  updating: 'Updating',
  needs_relogin: 'Sign in again',
  expiring: 'Expiring soon',
  error: "Couldn't update",
  revoked: 'Access ended',
} as const;

export const CONNECTIONS_COPY = {
  title: 'Connections',
  intro: 'Every bank, card and brokerage you link shows up on Home, kept up to date automatically.',
  readOnlyTitle: 'Read-only, always',
  readOnly:
    'Tenbagger can see balances and transactions. It can never move money, make trades or change anything at your bank. Unlinking removes the data we stored for that connection.',
  sandboxNote: 'Sandbox mode: these institutions and numbers are fictional, for trying the flow.',
  empty: 'Nothing linked yet. Home is showing a fictional sample until you link an account.',
  linkAnother: 'Link another account',
  linkFirst: 'Link an account',
  pickerTitle: 'Pick an institution',
  pickerNote: 'Sandbox institutions. Linking one adds fictional accounts so you can see how Home works.',
  refresh: 'Refresh',
  refreshCooling: 'Updated recently. You can refresh again in a few minutes.',
  signInAgain: 'Sign in again',
  unlink: 'Unlink',
  unlinkTitle: 'Unlink this connection?',
  unlinkBody: 'Its accounts leave Home and the data we stored for it is deleted. You can link it again any time.',
  unlinkConfirm: 'Yes, unlink',
  cancel: 'Keep it',
  needsReloginHelp: 'Banks ask for a fresh sign-in now and then for security. Balances below are from the last update.',
  expiringHelp: 'Access ends soon. A quick sign-in keeps it updating.',
  errorHelp: "The last update didn't go through. We'll try again later.",
  linkUnavailable: 'Linking needs the full app build. It is not available in this preview yet.',
  linkCancelled: 'No changes made.',
  linkFailed: "That didn't go through. Nothing changed; try again in a moment.",
  updated: 'Updated',
  accounts: (n: number | null) => (n === null ? 'Accounts' : `${n} account${n === 1 ? '' : 's'}`),
} as const;

/** Home footer lines (AccountsPanel). */
export const HOME_LINK_COPY = {
  manage: 'Manage connections',
  sample: 'Sample accounts. Link your own read-only from Manage connections; Tenbagger can never move money.',
  sandbox: 'Sandbox connections: fictional accounts. Read-only; Tenbagger can never move money.',
  live: 'Read-only: Tenbagger can see balances but can never move money.',
} as const;
