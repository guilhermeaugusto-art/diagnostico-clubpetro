import type { BlockId } from "../data/blocks";

/* "contact" saiu do fluxo: a captura de telefone virou um gate dentro do
   resultado (recompensa primeiro). Mantido fora da união de telas. */
export type Screen = "welcome" | "question" | "transition" | "result";

export type SignalTier = "critico" | "neutro" | "avancado";

/* Uma resposta pode ser de:
   - segmentation-single / qualify: { value: "..." }
   - segmentation-multi:            { values: ["...", "..."] }
   - score:                         { value: "...", pts: 6, vague?: true }
*/
export interface ScoreAnswer {
  kind: "score";
  optionIndex: number;
  label: string;
  value: string;
  pts: number;
  vague?: boolean;
  block: BlockId;
  max: number;
}
export interface SingleAnswer {
  kind: "single";
  optionIndex: number;
  label: string;
  value: string;
}
export interface MultiAnswer {
  kind: "multi";
  selectedIndexes: number[];
  values: string[];
  labels: string[];
}
export interface QualifyAnswer {
  kind: "qualify";
  optionIndex: number;
  label: string;
  value: string;
}
/* Resposta de texto aberto (perguntas type: "open"). Não pontua. */
export interface TextAnswer {
  kind: "text";
  text: string;
}

export type Answer = ScoreAnswer | SingleAnswer | MultiAnswer | QualifyAnswer | TextAnswer;

export interface AppState {
  screen: Screen;
  cursor: number;
  answers: Record<string, Answer>;
  name: string;
  phone: string;
  email: string;
  signal: SignalTier | null;
  signalLocked: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  diagId: string | null;
  /* Marcadores de conversão persistidos: evitam reenviar o lead ao RD e reabrir
     o portão/UI de confirmação numa retomada de sessão (BUG-03). */
  leadSent: boolean;
  raioxConfirmed: boolean;
}

export function freshState(): AppState {
  return {
    screen: "welcome",
    cursor: 0,
    answers: {},
    name: "",
    phone: "",
    email: "",
    signal: null,
    signalLocked: false,
    startedAt: null,
    finishedAt: null,
    diagId: null,
    leadSent: false,
    raioxConfirmed: false,
  };
}
