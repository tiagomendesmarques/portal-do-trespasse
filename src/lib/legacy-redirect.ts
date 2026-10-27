import { permanentRedirect } from "next/navigation";

/** Endereços antigos do WordPress sem equivalente no site novo (/author/, /store/, /tag/, /category/). */
export function legacyRedirect(to: string) {
  return function GET(): never {
    permanentRedirect(to);
  };
}
