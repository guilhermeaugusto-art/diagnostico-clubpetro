/* Renderizador único de ícone.
   Aceita tanto IconName (SVG monoline do Icons) quanto IconAssetName (PNG flat).
   Permite usar a mesma assinatura em AnswerCard, PillarCard, RecCard, etc. */

import { Icons, type IconName } from "./icons";
import { ICON_ASSETS, isIconAsset, type IconAssetName } from "./iconAssets";

export type AnyIcon = IconName | IconAssetName;

export function renderIcon(name: AnyIcon, opts?: { sizeClass?: string }): string {
  if (isIconAsset(name)) {
    const cls = opts?.sizeClass ?? "icon-png";
    return `<img class="${cls}" src="${ICON_ASSETS[name]}" alt="" loading="lazy" decoding="async"/>`;
  }
  return Icons[name as IconName] ?? "";
}
