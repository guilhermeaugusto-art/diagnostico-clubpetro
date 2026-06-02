import type { BlockId } from "../data/blocks";

export type Screen = "welcome" | "question" | "phone" | "transition" | "result";

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

export type Answer = ScoreAnswer | SingleAnswer | MultiAnswer | QualifyAnswer;

export interface AppState {
  screen: Screen;
  cursor: number;                          // posição na trilha
  answers: Record<string, Answer>;
  phone: string;
  signal: SignalTier | null;               // calculado após 5 primeiras pontuadas
  signalLocked: boolean;                   // true depois do checkpoint
  startedAt: string | null;
  finishedAt: string | null;
  diagId: string | null;
}

export function freshState(): AppState {
  return {
    screen: "welcome",
    cursor: 0,
    answers: {},
    phone: "",
    signal: null,
    signalLocked: false,
    startedAt: null,
    finishedAt: null,
    diagId: null,
  };
}
