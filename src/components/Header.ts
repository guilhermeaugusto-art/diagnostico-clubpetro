import { Logo } from "./Logo";

interface HeaderProps {
  idle: boolean;
  contextLabel: string;
  barsHtml?: string;   // gráfico de barras por pilar (durante as respostas), no header
}

export function Header(props: HeaderProps): string {
  const cls = props.idle ? "cp-header idle" : "cp-header";
  return `
    <header class="${cls}" id="cpHeader">
      <div class="shell">
        <div class="cp-header-row">
          <a class="cp-brand" href="/" aria-label="ClubPetro, página inicial">
            ${Logo()}
            <span class="cp-brand-tag">Análise do posto${props.contextLabel ? ` · <b>${props.contextLabel}</b>` : ""}</span>
          </a>
          ${props.barsHtml
            ? `<div class="cp-header-bars">${props.barsHtml}</div>`
            : `<span class="cp-header-spacer" aria-hidden="true"></span>`}
        </div>
      </div>
    </header>
  `;
}
