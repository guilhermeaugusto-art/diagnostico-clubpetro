# Tracking · Diagnóstico ClubPetro

Eventos gravados em `diagnostic_events` durante o fluxo do usuário.

## Eventos por etapa

### Lifecycle
| Evento | Quando | Metadata |
|---|---|---|
| `page_viewed` | Boot da página | landing_url, referrer, utm_source, utm_campaign |
| `diagnostic_started` | Usuário clica em "Iniciar diagnóstico" | name |
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

### Resultado
| Evento | Quando | Metadata |
|---|---|---|
| `result_viewed` | Hero do resultado renderiza | score_total, nivel, signal |
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
