import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "on-dark";
  size?: "md" | "lg";
  label: string;
  iconRight?: "arrow" | "none";
  iconLeft?: "arrowBack" | "none";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  dataAction?: string;
  id?: string;
  ariaLabel?: string;
}

export function Button(props: ButtonProps): string {
  const variant = props.variant || "primary";
  const variantCls =
    variant === "primary" ? "btn-primary" :
    variant === "secondary" ? "btn-secondary" :
    variant === "ghost" ? "btn-ghost" :
    "btn-on-dark";

  const classes = [
    "btn",
    variantCls,
    props.size === "lg" ? "btn-lg" : "",
    props.fullWidth ? "btn-block" : "",
  ].filter(Boolean).join(" ");

  const arrowR = props.iconRight === "arrow"
    ? `<span class="btn-arrow" aria-hidden="true">${Icons.arrowRight}</span>`
    : "";
  const arrowL = props.iconLeft === "arrowBack"
    ? `<span class="btn-arrow" aria-hidden="true">${Icons.arrowLeft}</span>`
    : "";

  const attrs = [
    `class="${classes}"`,
    `type="${props.type || "button"}"`,
    props.dataAction ? `data-action="${escHtml(props.dataAction)}"` : "",
    props.id ? `id="${escHtml(props.id)}"` : "",
    props.disabled ? "disabled aria-disabled=\"true\"" : "",
    props.ariaLabel ? `aria-label="${escHtml(props.ariaLabel)}"` : "",
  ].filter(Boolean).join(" ");

  return `<button ${attrs}>${arrowL}<span>${escHtml(props.label)}</span>${arrowR}</button>`;
}
