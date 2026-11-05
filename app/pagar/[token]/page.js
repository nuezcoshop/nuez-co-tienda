"use client";

import { supabase } from "@/lib/supabase";
import VistaPago from "../vista";

// Link de un cobro puntual (por código largo).
export default function Pagar({ params }) {
  return (
    <VistaPago
      obtener={async () => {
        const { data, error } = await supabase.rpc("cobro_publico", { t: params.token });
        if (error) throw error;
        return data;
      }}
    />
  );
}
