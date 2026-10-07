// A provider that is not configured (e.g. SnapTrade keys not set yet). Every call rejects with a clear
// 503 instead of the whole function failing at startup, so Plaid-only deployments work.
import { HttpError } from "../http.ts";
import type { AggregatorProvider } from "./types.ts";
import type { ProviderName } from "../types.ts";

export function notConfiguredProvider(name: ProviderName): AggregatorProvider {
  const fail = () => Promise.reject(new HttpError(503, "provider_not_configured", `${name} is not configured on this server`));
  return new Proxy({ name } as AggregatorProvider, {
    get: (_t, key) => (key === "name" ? name : key === "then" ? undefined : fail),
  });
}
