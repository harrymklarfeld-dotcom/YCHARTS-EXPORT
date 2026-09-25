// Thin entrypoint; logic lives in ../_shared/handlers.ts (plaidSyncHoldings).
import { serve } from "../_shared/deps.ts";
import { plaidSyncHoldings } from "../_shared/handlers.ts";

serve(plaidSyncHoldings);
