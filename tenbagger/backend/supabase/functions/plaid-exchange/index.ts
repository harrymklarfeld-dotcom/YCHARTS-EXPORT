// Thin entrypoint; logic lives in ../_shared/handlers.ts (plaidExchange).
import { serve } from "../_shared/deps.ts";
import { plaidExchange } from "../_shared/handlers.ts";

serve(plaidExchange);
