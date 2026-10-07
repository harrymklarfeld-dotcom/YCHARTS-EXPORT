// Thin entrypoint; logic lives in ../_shared/handlers.ts (unlink).
import { serve } from "../_shared/deps.ts";
import { unlink } from "../_shared/handlers.ts";

serve(unlink);
