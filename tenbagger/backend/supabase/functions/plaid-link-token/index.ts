// Thin entrypoint; logic lives in ../_shared/handlers.ts (plaidLinkToken).
import { serve } from "../_shared/deps.ts";
import { plaidLinkToken } from "../_shared/handlers.ts";

serve(plaidLinkToken);
