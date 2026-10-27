/** Secções dos campos personalizados, pela ordem em que aparecem no formulário e no anúncio. */
export const FIELD_SECTIONS = [
  { key: "numeros", title: "Números do negócio" },
  { key: "espaco", title: "Espaço e imóvel" },
  { key: "equipa", title: "Equipa" },
  { key: "incluido", title: "O que está incluído" },
  { key: "funcionamento", title: "Funcionamento" },
] as const;
export type SectionKey = (typeof FIELD_SECTIONS)[number]["key"];
