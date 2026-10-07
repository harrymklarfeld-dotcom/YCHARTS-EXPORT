// Thin entrypoint; logic lives in ../_shared/handlers.ts (snaptradeRegister).
import { serve } from "../_shared/deps.ts";
import { snaptradeRegister } from "../_shared/handlers.ts";

serve(snaptradeRegister);
