import { Logo } from "./Logo";
import { ProgressBar } from "./ProgressBar";

interface HeaderProps {
  idle: boolean;
  contextLabel: string;
  totalSteps: number;
  currentStep: number;
  score: number;
}

export function Header(props: HeaderProps): string {
  const cls = props.idle ? "cp-header idle" : "cp-header";
  return `
    <header class="${cls}" id="cpHeader">
      <div class="shell">
        <div class="cp-header-row">
          <a class="cp-brand" href="/" aria-label="ClubPetro · página inicial">
            ${Logo()}
            <span class="cp-brand-tag">Diagnóstico · <b>${props.contextLabel}</b></span>
          </a>
          ${ProgressBar({ total: props.totalSteps, current: props.currentStep })}
          <div class="cp-score-chip" aria-live="polite" aria-label="Nota parcial">
            Nota
            <strong id="cpScore">${props.score}</strong>
          </div>
        </div>
      </div>
    </header>
  `;
}
