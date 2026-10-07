-- Tenbagger — connection status for "all my accounts, kept fresh".
--
-- Plaid's ITEM PENDING_EXPIRATION / PENDING_DISCONNECT webhooks mean "this login still works,
-- but the user will need to sign in again soon". Mapping them to needs_reauth stopped syncs of an
-- Item that was still healthy, so they get their own status. Syncs continue for
-- 'pending_expiration'; only 'needs_reauth' and 'revoked' are skipped. A successful re-link
-- (Link update mode) or a LOGIN_REPAIRED webhook sets the Item back to 'active'.
--
-- Clients already have SELECT on linked_items.status / status_reason (20260925000200); no new
-- grants. Access-token columns stay service-only.

alter table public.linked_items drop constraint if exists linked_items_status_check;
alter table public.linked_items
  add constraint linked_items_status_check
  check (status in ('active', 'needs_reauth', 'pending_expiration', 'revoked', 'error'));
