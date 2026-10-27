// Campos novos (não existiam no WordPress), todos facultativos. Escolhidos a partir do que os
// anunciantes já escreviam à mão nas descrições: área, lotação, contrato, senhorio, licenças, dívidas,
// imóvel incluído ou não, stock, motivo da venda.
import type { SectionKey } from "@/lib/listings/sections";

export type ExtraField = {
  key: string;
  label: string;
  type: "number" | "radio" | "select";
  section: SectionKey;
  options?: [string, string][];
  help?: string;
  placeholder?: string;
  icon?: string;
  min?: number;
  searchable?: boolean;
  /** Só aparece quando o campo `key` tem o valor `value`. */
  condition?: { key: string; value: string };
};

const SIM_NAO: [string, string][] = [["sim", "Sim"], ["nao", "Não"]];

export const EXTRA_FIELDS: ExtraField[] = [
  { key: "resultado-liquido", label: "Resultado líquido anual", type: "number", section: "numeros", icon: "money", help: "Lucro anual aproximado, depois de despesas. Ajuda o comprador a avaliar o retorno.", placeholder: "Ex: 30000" },
  { key: "area-m2", label: "Área (m²)", type: "number", section: "espaco", min: 1, placeholder: "Ex: 120", searchable: true },
  { key: "lugares", label: "Lotação (lugares sentados)", type: "number", section: "espaco", min: 1, help: "Para restauração, cafés e similares.", placeholder: "Ex: 40" },
  { key: "esplanada", label: "Tem esplanada?", type: "radio", section: "espaco", options: SIM_NAO },
  {
    key: "situacao-imovel", label: "Situação do imóvel", type: "radio", section: "espaco", searchable: true,
    options: [["arrendado", "Arrendado"], ["proprio-incluido", "Próprio, incluído na venda"], ["proprio-nao-incluido", "Próprio, não incluído"], ["sem-espaco", "Sem espaço físico"]],
  },
  { key: "contrato-anos", label: "Anos restantes do contrato de arrendamento", type: "number", section: "espaco", min: 0, placeholder: "Ex: 5", condition: { key: "situacao-imovel", value: "arrendado" } },
  { key: "senhorio-aceita", label: "O senhorio aceita o trespasse?", type: "radio", section: "espaco", options: [["sim", "Sim"], ["nao", "Não"], ["a-confirmar", "A confirmar"]], condition: { key: "situacao-imovel", value: "arrendado" } },
  { key: "acompanhamento", label: "O vendedor acompanha a transição?", type: "radio", section: "equipa", options: SIM_NAO, help: "Por exemplo, apresenta clientes e fornecedores ou dá formação nas primeiras semanas." },
  { key: "equipamento", label: "Equipamento e mobiliário incluídos?", type: "radio", section: "incluido", options: [["sim", "Sim"], ["parcial", "Em parte"], ["nao", "Não"]] },
  { key: "stock", label: "Stock incluído no valor?", type: "radio", section: "incluido", options: [["sim", "Sim"], ["a-parte", "Pago à parte"], ["nao", "Não há stock"]] },
  { key: "licencas", label: "Licenças em dia?", type: "radio", section: "funcionamento", options: [["sim", "Sim"], ["em-processo", "Em processo"], ["nao", "Não"]] },
  { key: "dividas", label: "O negócio tem dívidas ou empréstimos?", type: "radio", section: "funcionamento", options: SIM_NAO },
  {
    key: "motivo-venda", label: "Motivo da venda", type: "select", section: "funcionamento",
    options: [["reforma", "Reforma"], ["mudanca", "Mudança de cidade ou país"], ["outro-negocio", "Dedicar-me a outro negócio"], ["familia", "Razões pessoais ou familiares"], ["falta-tempo", "Falta de tempo"], ["outro", "Outro"]],
  },
];

/** Secção dos 12 campos herdados do WordPress, por chave. */
export const WP_FIELD_SECTIONS: Record<string, SectionKey> = {
  "renda-mensal": "numeros", "faturacao-media-anual": "numeros", iva: "numeros",
  "trabalhadores-com-contrato": "equipa", "quantos-trabalhadores-sem-termo": "equipa", "quantos-trabalhadores-com-termo": "equipa",
  "tempo-no-mercado": "funcionamento", "negocio-sazonal": "funcionamento", "tipo-de-negocio": "funcionamento",
  "depende-fornecedores": "funcionamento", presenca: "funcionamento", "venda-urgente": "funcionamento",
};
