import { Logo } from "./Logo";
import { ProgressBar } from "./ProgressBar";
import { RadarMini } from "./RadarMini";
import type { AppState } from "../lib/state";

interface HeaderProps {
  state: AppState;
  idle: boolean;
  contextLabel: string;
  totalSteps: number;
  currentStep: number;
  showRadar: boolean;
}

export function Header(props: HeaderProps): string {
  const cls = props.idle ? "cp-header idle" : "cp-header";
  return `
    <header class="${cls}" id="cpHeader">
      <div class="shell">
        <div class="cp-header-row">
          <a class="cp-brand" href="/" aria-label="ClubPetro, página inicial">
            ${Logo()}
            <span class="cp-brand-tag">Diagnóstico${props.contextLabel ? ` · <b>${props.contextLabel}</b>` : ""}</span>
          </a>
          ${ProgressBar({ total: props.totalSteps, current: props.currentStep })}
          ${props.showRadar ? RadarMini({ state: props.state, size: 108 }) : `<span class="cp-header-spacer" aria-hidden="true"></span>`}
        </div>
      </div>
    </header>
  `;
}
