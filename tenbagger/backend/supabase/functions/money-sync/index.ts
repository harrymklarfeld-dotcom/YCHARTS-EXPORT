// Thin entrypoint; logic lives in ../_shared/handlers.ts (moneySync).
import { serve } from "../_shared/deps.ts";
import { moneySync } from "../_shared/handlers.ts";

serve(moneySync);
