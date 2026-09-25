// Thin entrypoint; logic lives in ../_shared/handlers.ts (plaidWebhook).
import { serve } from "../_shared/deps.ts";
import { plaidWebhook } from "../_shared/handlers.ts";

serve(plaidWebhook);
