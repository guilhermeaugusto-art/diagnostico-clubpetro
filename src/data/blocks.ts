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
  rationale: string;
}

export const BLOCKS: Record<BlockId, Block> = {
  pessoas: {
    id: "pessoas",
    name: "Pessoas e operação",
    short: "Pessoas",
    weight: 18,
    rationale:
      "Sustenta o atendimento e o custo, mas sozinha não define o resultado.",
  },
  marca: {
    id: "marca",
    name: "Marca e experiência",
    short: "Marca",
    weight: 12,
    rationale:
      "Posicionamento importa, porém é em parte autoavaliação. Peso menor.",
  },
  comercial: {
    id: "comercial",
    name: "Comercial e margem",
    short: "Comercial",
    weight: 24,
    rationale:
      "Onde o resultado do posto realmente se decide. Maior peso.",
  },
  fidelizacao: {
    id: "fidelizacao",
    name: "Cliente e fidelização",
    short: "Fidelização",
    weight: 22,
    rationale:
      "Eixo do diagnóstico e maior preditor de saúde de longo prazo.",
  },
  dados: {
    id: "dados",
    name: "Dados e digital",
    short: "Dados",
    weight: 14,
    rationale:
      "Infraestrutura que destrava fidelização e estanca vazamento de margem.",
  },
  resiliencia: {
    id: "resiliencia",
    name: "Resiliência e mercado",
    short: "Resiliência",
    weight: 10,
    rationale:
      "Exposição ao cenário de 2026. Peso menor, porém presente.",
  },
};

export const BLOCK_ORDER: BlockId[] = [
  "pessoas", "marca", "comercial", "fidelizacao", "dados", "resiliencia",
];
