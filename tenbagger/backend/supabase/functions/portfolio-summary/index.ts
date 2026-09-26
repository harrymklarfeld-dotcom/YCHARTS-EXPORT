// Thin entrypoint; logic lives in ../_shared/handlers.ts (portfolioSummary).
import { serve } from "../_shared/deps.ts";
import { portfolioSummary } from "../_shared/handlers.ts";

serve(portfolioSummary);
