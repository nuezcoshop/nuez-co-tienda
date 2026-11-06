import { redirect } from "next/navigation";

// El QR y el NFC que ya se imprimieron/grabaron con /pagar siguen funcionando: van a /hola.
export default function Pagar() {
  redirect("/hola");
}
