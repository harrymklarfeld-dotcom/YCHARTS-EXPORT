// Thin entrypoint; logic lives in ../_shared/handlers.ts (moneySummary).
import { serve } from "../_shared/deps.ts";
import { moneySummary } from "../_shared/handlers.ts";

serve(moneySummary);
