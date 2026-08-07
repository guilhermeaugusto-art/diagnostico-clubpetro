# Tracking · Diagnóstico ClubPetro

Eventos gravados em `diagnostic_events` durante o fluxo do usuário.

## Eventos por etapa

### Lifecycle
| Evento | Quando | Metadata |
|---|---|---|
| `page_viewed` | Boot da página | landing_url, referrer, utm_source, utm_campaign |
| `diagnostic_started` | Usuário clica em "Iniciar diagnóstico" (exige nome + WhatsApp + **e-mail** desde 05/08) | name |
| `name_submitted` | Idem (junto com diagnostic_started) | — |
| `diagnostic_restarted` | Usuário clica em "Recomeçar do zero" | — |
| `diagnostic_abandoned` | Pagehide sem ter chegado em result | last_screen, last_cursor, time_total |

### Perguntas
| Evento | Quando | Metadata |
|---|---|---|
| `answer_selected` | Usuário marca uma opção | question_id, type, time_on_question |
| `diag_signal` | Após responder C1, F1, D1, R1, C4 | signal: critico/neutro/avancado |

### Contato
| Evento | Quando | Metadata |
|---|---|---|
| `contact_form_submitted` | Envia WhatsApp+email | phone_length, has_email |
| `diagnostic_completed` | Idem | — |
| `conversao_diagnostico` | **Conversão oficial p/ GTM**: dispara UMA vez em `submitLead()` (lead deixou contato e foi pro RD/Kommo) | score, trilha (sem PII) |

> **GTM:** todos os eventos desta página entram no `dataLayer` (o site carrega GTM `GTM-MKSG5N5R`, não gtag.js — `window.gtag` não existe aqui). Para trackear a conversão, criar no GTM um acionador **Evento personalizado** com o nome `conversao_diagnostico` e ligar as tags (GA4/Google Ads/Meta) nele.

### Resultado
| Evento | Quando | Metadata |
|---|---|---|
| `result_viewed` | Hero do resultado renderiza | score_total, nivel, signal |

> **Âncora fixa de conversão na tela final:** o elemento "Sua análise está pronta"
> tem `id="analise-pronta"` (permanente — não renomear; [src/pages/ResultPage.ts](src/pages/ResultPage.ts)).
> Serve para o gatilho de **Visibilidade do elemento** no GTM: método de seleção
> "Código" → `analise-pronta`, "Uma vez por página", "Observar alterações do DOM"
> ligado (a tela é SPA, o elemento nasce sem reload). A primeira abertura do
> resultado também grava `diagnostico_respostas.resultado_visto_em` no Supabase
> (via `markResultadoVisto` — migration `20260724120000_resultado_visto_em.sql`),
> então GTM e banco medem o mesmo momento.
> Atenção: essa tela abre para TODAS as trilhas (frentista incluso); conversão
> de lead de verdade continua sendo `conversao_diagnostico`. Desde 05/08 o
> e-mail é capturado na TELA INICIAL (o portão de e-mail do resultado virou
> fallback de sessão antiga), então dono/gerente chegam aqui já convertidos.
| `report_generation_started` | Geração do PDF inicia | — |
| `report_generated` | Upload do PDF concluído | path, size |
| `report_generation_failed` | Erro na geração ou upload | reason |
| `report_unlocked` | Trigger libera relatório (rayx_attended ou manual) | reason, rayx_id |

### CTAs
| Evento | Quando | Metadata |
|---|---|---|
| `specialist_cta_clicked` | Clica em "Falar com especialista" / WhatsApp | score_total |
| `rayx_cta_clicked` | Clica em "Agendar raio-x" / "Reservar vaga" | score_total |
| `rayx_scheduled` | Após criar requisição em diagnostic_rayx | scheduled_for, meet_url |

## Consultar eventos de uma sessão

```sql
SELECT created_at, event_name, event_category, metadata
  FROM diagnostic_events
 WHERE session_id = '<uuid>'
 ORDER BY created_at;
```

## Funil de conversão

```sql
SELECT
  COUNT(*) FILTER (WHERE event_name = 'page_viewed')          AS views,
  COUNT(*) FILTER (WHERE event_name = 'diagnostic_started')    AS started,
  COUNT(*) FILTER (WHERE event_name = 'contact_form_submitted') AS contact,
  COUNT(*) FILTER (WHERE event_name = 'result_viewed')         AS result,
  COUNT(*) FILTER (WHERE event_name = 'specialist_cta_clicked') AS whatsapp_cta,
  COUNT(*) FILTER (WHERE event_name = 'rayx_cta_clicked')      AS rayx_cta,
  COUNT(*) FILTER (WHERE event_name = 'rayx_scheduled')        AS rayx_scheduled
FROM diagnostic_events
WHERE created_at >= now() - interval '30 days';
```

## Eventos enviados também para GA/Pixel
Tudo que passa por `track()` em [src/lib/tracking.ts](src/lib/tracking.ts) também dispara `gtag('event', ...)` e `fbq('trackCustom', ...)`. Configurar GA4/Pixel via `<script>` no index.html (não está no projeto hoje — é pendência se quiser tracking duplo).

## Conversões no RD Station (backend — 05/08)

O envio ao RD é 100% do banco/Edge Functions (o front NÃO chama mais a função
RD; o antigo best-effort era um no-op que marcava `rd_enviado` à toa e foi
removido). Endpoint: evento de conversão padrão
(`POST /platform/conversions?api_key=…`, corpo `event_type: CONVERSION`).

| Conversão (identifier) | Quando dispara | Payload relevante |
|---|---|---|
| `iniciou-diagnostico-posto` | Coluna `email` é preenchida (trigger `rd_diagnostico_inicio` → `rd-diagnostico-conversion`). Como o e-mail entra na tela inicial, o lead sobe pro RD no COMEÇO do fluxo. Dedup: `rd_inicio_enviado`. Não roda se a ficha já concluiu. | email, name, mobile_phone, **traffic_source/medium/campaign/value** (utm_* da linha; fallback `origem_source`), tag `diagnostico-iniciado` |
| `fez-diagnostico-posto` | Flip de `concluiu` (trigger `rd_diagnostico_conversion`; retry no sweep da esteira). Dedup: `rd_enviado` + ficha irmã. Lógica de conclusão INALTERADA. | + job_title, mobile_phone, **traffic_***, cf_score/nivel/dimensao_fraca/frente_interesse, `cf_url_do_diagnostico` (URL do quiz — a API do RD não tem "URL da Conversão" nativo; o campo custom precisa existir no RD), tag `diagnostico-realizado` |
| `confirmou-raiox-posto` | `raiox_status = confirmado`. Dedup: `rd_raiox_enviado`. | tag `raiox-confirmado` |
| `fez-raiox-posto` | `participou_raiox` (só esteira). Dedup: `rd_participou_enviado`. | tag `raiox-realizado` |

> **Validação do tráfego pago:** a campanha deve apontar pro quiz com UTMs
> (`?utm_source=…&utm_medium=…&utm_campaign=…`). Elas são gravadas no INSERT da
> sessão e viajam nos campos `traffic_*` da conversão — no RD, o lead aparece
> com origem da conversão preenchida e dá pra segmentar/contar por
> `iniciou-diagnostico-posto` + campanha. Frentista continua fora do RD e o
> e-mail é obrigatório na entrada, então todo lead que inicia o quiz sobe.
