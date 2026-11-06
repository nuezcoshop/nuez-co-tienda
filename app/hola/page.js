"use client";

import { supabase } from "@/lib/supabase";
import VistaPago from "./vista";

// QR fijo del mostrador: muestra el cobro que el cajero acaba de cargar en el POS.
export default function PagarFijo() {
  return (
    <VistaPago
      fijo
      obtener={async () => {
        const { data, error } = await supabase.rpc("cobro_activo");
        if (error) throw error;
        return data;
      }}
    />
  );
}
