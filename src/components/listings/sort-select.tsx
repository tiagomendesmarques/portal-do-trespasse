"use client";

import { useRouter } from "next/navigation";
import { SORTS, type Sort } from "@/lib/listings/filters";

export function SortSelect({ value, hrefFor }: { value: Sort; hrefFor: Record<Sort, string> }) {
  const router = useRouter();
  return (
    <select value={value} onChange={(e) => router.push(hrefFor[e.target.value as Sort])} className="input w-auto py-2" aria-label="Ordenar">
      {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
    </select>
  );
}
