import { Button } from "../components/Button";
import { Icons } from "../lib/icons";
import { escHtml } from "../lib/format";

interface ContactPageProps {
  name: string;
  phone: string;
  email: string;
  phoneValid: boolean;
  emailValid: boolean;
  allValid: boolean;
}

/* Última etapa antes do resultado.
   Copy enxuto, sem hints redundantes, focado em manter o botão "Ver resultado"
   acima da dobra no desktop 100% e visível ao final no mobile. */
export function ContactPage(p: ContactPageProps): string {
  const hi = p.name.trim() ? p.name.trim().split(/\s+/)[0] : "";
  return `
    <div class="shell stage">
      <section class="contact-stage anim-rise">
        <header class="contact-head">
          <span class="eyebrow">Última etapa</span>
          <h2 class="h2">
            ${hi
              ? `Falta pouco, <span style="color:var(--cp-orange-500);">${escHtml(hi)}</span>.`
              : "Falta pouco."}
          </h2>
          <p class="lede measure">
            Pra onde enviamos o seu raio-x completo? Assim que você terminar, a gente
            manda no seu WhatsApp a leitura do seu posto: por onde o lucro está vazando
            hoje e os primeiros passos pra resolver. Sem custo, e sem enrolação.
          </p>
        </header>

        <div class="contact-card anim-rise delay-2">
          <label class="contact-field" for="phoneInput">
            <span class="contact-field-label">WhatsApp com DDD</span>
            <input
              id="phoneInput"
              class="contact-input"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              aria-invalid="false"
              placeholder="(11) 99999-9999"
              value="${escHtml(p.phone)}"
            >
          </label>

          <label class="contact-field" for="emailInput">
            <span class="contact-field-label">E-mail</span>
            <input
              id="emailInput"
              class="contact-input"
              type="email"
              inputmode="email"
              autocomplete="email"
              aria-invalid="false"
              placeholder="voce@empresa.com"
              value="${escHtml(p.email)}"
            >
          </label>

          <span class="contact-trust">
            ${Icons.shield}
            <span>Usado só para entregar o seu diagnóstico.</span>
          </span>
        </div>

        <div class="q-nav contact-nav">
          ${Button({ variant: "ghost", label: "Voltar", iconLeft: "arrowBack", dataAction: "back" })}
          ${Button({
            variant: "primary",
            size: "lg",
            label: "Ver meu diagnóstico",
            iconRight: "arrow",
            dataAction: "submit-contact",
            id: "btnGoResult",
            disabled: !p.allValid,
          })}
        </div>
      </section>
    </div>
  `;
}
