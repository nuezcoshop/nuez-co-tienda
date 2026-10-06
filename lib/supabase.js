import { createClient } from "@supabase/supabase-js";

// Cliente público (clave "anon"): solo puede leer las vistas seguras de la tienda.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
