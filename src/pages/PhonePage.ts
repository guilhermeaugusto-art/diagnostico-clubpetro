import { Button } from "../components/Button";
import { Icons } from "../lib/icons";
import { escHtml } from "../lib/format";

interface PhonePageProps {
  phone: string;
  valid: boolean;
}

export function PhonePage(p: PhonePageProps): string {
  return `
    <div class="shell stage">
      <section class="phone-stage anim-rise">
        <header class="phone-head">
          <span class="eyebrow">Última etapa</span>
          <h2 class="h2">Para onde mandamos o <span style="color:var(--cp-orange-500);">seu resultado</span>?</h2>
          <p class="lede measure">
            Seu WhatsApp recebe a leitura completa do diagnóstico e o convite do RaioX da terça.
          </p>
        </header>

        <div class="phone-card anim-rise delay-2">
          <label class="phone-label" for="phoneInput">WhatsApp com DDD</label>
          <input
            id="phoneInput"
            class="phone-input"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            aria-label="WhatsApp com DDD"
            aria-invalid="false"
            placeholder="(11) 99999-9999"
            value="${escHtml(p.phone)}"
          >
          <span class="phone-trust">
            ${Icons.shield}
            <span>Não compartilhamos seu número.</span>
          </span>
        </div>

        <div class="q-nav phone-nav">
          ${Button({ variant: "ghost", label: "Voltar", iconLeft: "arrowBack", dataAction: "back" })}
          ${Button({
            variant: "primary",
            size: "lg",
            label: "Ver resultado",
            iconRight: "arrow",
            dataAction: "submit-phone",
            id: "btnGoResult",
            disabled: !p.valid,
          })}
        </div>
      </section>
    </div>
  `;
}
