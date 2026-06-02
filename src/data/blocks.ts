import type { IconName } from "../lib/icons";

export type BlockId =
  | "pessoas"
  | "marca"
  | "comercial"
  | "fidelizacao"
  | "dados"
  | "resiliencia";

export interface Block {
  id: BlockId;
  name: string;
  short: string;
  weight: number;        // peso da frente (sempre 100 no total)
  icon: IconName;
  rationale: string;     // por que pesa o que pesa, da spec
}

export const BLOCKS: Record<BlockId, Block> = {
  pessoas: {
    id: "pessoas",
    name: "Pessoas e operação",
    short: "Pessoas",
    weight: 18,
    icon: "team",
    rationale:
      "Sustenta o atendimento e o custo, mas sozinha não define o resultado.",
  },
  marca: {
    id: "marca",
    name: "Marca e experiência",
    short: "Marca",
    weight: 12,
    icon: "badge",
    rationale:
      "Posicionamento importa, porém é em parte autoavaliação. Peso menor.",
  },
  comercial: {
    id: "comercial",
    name: "Comercial e margem",
    short: "Comercial",
    weight: 24,
    icon: "coin",
    rationale:
      "Onde o resultado do posto realmente se decide. Maior peso.",
  },
  fidelizacao: {
    id: "fidelizacao",
    name: "Cliente e fidelização",
    short: "Fidelização",
    weight: 22,
    icon: "heart",
    rationale:
      "Eixo do diagnóstico e maior preditor de saúde de longo prazo.",
  },
  dados: {
    id: "dados",
    name: "Dados e digital",
    short: "Dados",
    weight: 14,
    icon: "dashboard",
    rationale:
      "Infraestrutura que destrava fidelização e estanca vazamento de margem.",
  },
  resiliencia: {
    id: "resiliencia",
    name: "Resiliência e mercado",
    short: "Resiliência",
    weight: 10,
    icon: "shield",
    rationale:
      "Exposição ao cenário de 2026. Peso menor, porém presente.",
  },
};

export const BLOCK_ORDER: BlockId[] = [
  "pessoas", "marca", "comercial", "fidelizacao", "dados", "resiliencia",
];

export const SCORE_MAX = BLOCK_ORDER.reduce((s, k) => s + BLOCKS[k].weight, 0); // 100
