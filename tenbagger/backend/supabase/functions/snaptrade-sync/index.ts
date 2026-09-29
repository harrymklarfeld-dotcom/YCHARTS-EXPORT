// Thin entrypoint; logic lives in ../_shared/handlers.ts (snaptradeSync).
import { serve } from "../_shared/deps.ts";
import { snaptradeSync } from "../_shared/handlers.ts";

serve(snaptradeSync);
