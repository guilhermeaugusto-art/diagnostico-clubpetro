interface ProgressBarProps {
  total: number;
  current: number;
}

export function ProgressBar({ total, current }: ProgressBarProps): string {
  const safeCurrent = Math.max(0, Math.min(current, total));
  const steps = Array.from({ length: total }, (_, i) => {
    const cls = i < safeCurrent ? "done" : i === safeCurrent ? "now" : "";
    return `<span class="cp-progress-step ${cls}" aria-hidden="true"></span>`;
  }).join("");
  return `
    <div class="cp-progress" role="progressbar"
         aria-label="Progresso do diagnóstico"
         aria-valuemin="0"
         aria-valuemax="${total}"
         aria-valuenow="${Math.min(safeCurrent + 1, total)}">
      ${steps}
    </div>
  `;
}
