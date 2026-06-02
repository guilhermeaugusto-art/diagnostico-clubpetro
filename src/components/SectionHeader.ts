import { escHtml, pad2 } from "../lib/format";

interface SectionHeaderProps {
  num: number;
  title: string;
}

export function SectionHeader({ num, title }: SectionHeaderProps): string {
  return `
    <header class="section-header">
      <span class="section-header-num">${pad2(num)}</span>
      <h2 class="section-header-title">${escHtml(title)}</h2>
      <span class="section-header-rule" aria-hidden="true"></span>
    </header>
  `;
}
