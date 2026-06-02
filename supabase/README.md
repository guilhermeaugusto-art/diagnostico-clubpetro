# Diagnóstico ClubPetro · Backend (Supabase)

Modelo **tabela única**: tudo do diagnóstico vive em `diagnostico_respostas`.
Cada lead tem uma linha; respostas, resultado, PDF, raio-x, ações comerciais,
eventos e UTMs ficam como colunas (ou jsonb) na mesma linha.

## Migrations a aplicar (em ordem)

```
supabase/migrations/
├── 20260602100000_diagnostic_full_schema.sql       # cria diagnostico_respostas base (e tabelas extras)
├── 20260602100100_storage_diagnostic_reports.sql   # bucket privado diagnostic-reports
└── 20260602110000_consolidate_into_single_table.sql # DROP extras + ADD colunas em diagnostico_respostas
```

A migration `20260602110000` **derruba** as tabelas extras (`diagnostic_answers`,
`diagnostic_results`, `diagnostic_reports`, `diagnostic_events`, `diagnostic_rayx`,
`diagnostic_commercial_actions`) e adiciona **todas as colunas necessárias**
na `diagnostico_respostas`.

### Aplicar

```bash
# Opção A · Supabase CLI
supabase link --project-ref azmtxhjtqodtaeoshrye
supabase db push
```

Ou colar no SQL Editor do painel as 3 migrations em ordem.

## Colunas da `diagnostico_respostas`

### Identificação
`id` (uuid PK) · `created_at` · `updated_at` · `started_at` · `completed_at` · `status` (`started`/`in_progress`/`completed`/`abandoned`/`archived`)

### Lead
`lead_name` · `lead_email` · `lead_whatsapp` · `company_name` · `station_name` · `city` · `state`

### Origem / contexto
`source` · `utm_source` · `utm_medium` · `utm_campaign` · `utm_content` · `utm_term` · `referrer` · `landing_url` · `user_agent` · `device_type` · `browser` · `os` · `screen_width` · `screen_height` · `locale` · `ip_address`

### Versão / privacidade
`diagnostic_version` · `lgpd_consent` · `lgpd_consent_at` · `notes_internal`

### Respostas (1 coluna por question_id)
`answer_s1`, `answer_s2`, `answer_s3` (multi separado por `" | "`),
`answer_c1`..`answer_c4`, `answer_f1`..`answer_f3`,
`answer_d1`..`answer_d4`, `answer_m1`..`answer_m3`,
`answer_p1`..`answer_p3`, `answer_r1`, `answer_r2`,
`answer_z1`, `answer_z2`.

`answers_full` (jsonb): payload completo `{ qid: { kind, label, value, pts, vague, dimension_key, dimension_label, question_text } }`.

### Qualificação (atalho pro funil)
`papel` (S1) · `conhece` (Z1) · `interesse` (Z2) · `readiness`

### Resultado consolidado
`overall_score` · `score_range_label` · `urgency_tone` (`critical`/`warning`/`attention`/`healthy`/`strong`) · `signal` (`critico`/`neutro`/`avancado`)

### Score por frente
| Bloco | Colunas |
|---|---|
| pessoas | `pillar_pessoas_pct`, `pillar_pessoas_earned`, `pillar_pessoas_possible` |
| marca | `pillar_marca_pct`, `pillar_marca_earned`, `pillar_marca_possible` |
| comercial | `pillar_comercial_pct`, `pillar_comercial_earned`, `pillar_comercial_possible` |
| fidelizacao | `pillar_fidelizacao_pct`, `pillar_fidelizacao_earned`, `pillar_fidelizacao_possible` |
| dados | `pillar_dados_pct`, `pillar_dados_earned`, `pillar_dados_possible` |
| resiliencia | `pillar_resiliencia_pct`, `pillar_resiliencia_earned`, `pillar_resiliencia_possible` |

`strongest_dimension_key/label/score` · `weakest_dimension_key/label/score`

### Dor e leitura consultiva
`main_pain_title` · `main_pain_description` · `main_pain_risk` · `radar_summary` · `radar_summary_extra` · `next_improvement_title` · `next_improvement_description`

### Recomendações e soluções (jsonb)
`recommendations_open` · `recommendations_locked` · `clubpetro_solutions`

### Leitura comercial (jsonb)
`commercial_summary` (texto) · `commercial_reading` (jsonb com `frentesCriticas`, `impacto`, `oportunidades`, `abordagem`, `perguntasParaConversa`, `objecoesProvaveis`, `proximosPassos`) · `approach_message`

### PDF / Relatório
`report_status` (`pending`/`generating`/`generated`/`failed`) · `report_storage_bucket` · `report_storage_path` · `report_file_name` · `report_file_size` · `report_generated_at` · `report_generation_error` · `report_is_user_unlocked` · `report_unlocked_at` · `report_unlocked_reason` · `report_unlocked_by` · `report_user_download_count` · `report_commercial_open_count` · `report_last_user_download_at` · `report_last_commercial_open_at`

### Raio-X
`rayx_status` (`requested`/`scheduled`/`confirmed`/`attended`/`no_show`/`canceled`/`rescheduled`) · `rayx_requested_at` · `rayx_scheduled_for` · `rayx_timezone` · `rayx_google_meet_url` · `rayx_google_calendar_event_id` · `rayx_calendar_provider` · `rayx_attended` · `rayx_attended_at` · `rayx_no_show` · `rayx_no_show_at` · `rayx_specialist_name` · `rayx_specialist_email` · `rayx_notes`

### Comercial
`commercial_owner` · `commercial_status` (`novo`/`em_contato`/`qualificado`/`ganho`/`perdido`) · `commercial_last_contact_at` · `commercial_actions` (jsonb array, livre)

### CTAs
`result_viewed_at` · `specialist_cta_clicked_at` · `specialist_cta_count` · `rayx_cta_clicked_at` · `rayx_cta_count`

### Eventos comportamentais (log)
`events` (jsonb array compacto: `[{ at, name, category, ...metadata }]`) · `event_count`

## Trigger automático

Quando alguém do back-office faz:
```sql
UPDATE diagnostico_respostas
   SET rayx_attended = true,
       rayx_specialist_email = 'especialista@clubpetro.com',
       rayx_specialist_name  = 'Nome'
 WHERE id = '<uuid>';
```

O trigger `unlock_report_on_rayx_attended` automaticamente:
- `report_is_user_unlocked = true`
- `report_unlocked_at = now()`
- `report_unlocked_reason = 'rayx_attended'`
- `report_unlocked_by = specialist_email`
- `rayx_attended_at = now()`
- `rayx_status = 'attended'`

## View `diagnostic_summary`

Linha por lead com as colunas mais úteis pro painel comercial:
```sql
SELECT * FROM diagnostic_summary
 WHERE lead_email ILIKE '%cliente%'
 LIMIT 50;
```

Colunas: `id, created_at, completed_at, status, lead_name, lead_email, lead_whatsapp, station_name, city, state, overall_score, score_range_label, urgency_tone, weakest_dimension_label, strongest_dimension_label, main_pain_title, next_improvement_title, report_status, report_is_user_unlocked, rayx_status, rayx_scheduled_for, rayx_attended, commercial_status, commercial_owner, specialist_cta_count, rayx_cta_count, event_count`.

## Storage

Bucket `diagnostic-reports` privado.
- Anon: só `INSERT` (front sobe o PDF gerado)
- Authenticated: read/write/delete
- Download externo: signed URL via service_role / Edge Function

Path do PDF: `YYYY-MM-DD/<session_id>.pdf` (visível em `report_storage_path`).

## Workflow do time comercial

### 1. Localizar lead
```sql
SELECT * FROM diagnostic_summary
 WHERE lead_email ILIKE '%@%' OR lead_whatsapp LIKE '%99999%'
 ORDER BY created_at DESC LIMIT 50;
```

### 2. Ver diagnóstico completo
```sql
SELECT
  lead_name, lead_email, lead_whatsapp,
  overall_score, score_range_label, urgency_tone,
  main_pain_title, main_pain_description, main_pain_risk,
  weakest_dimension_label, strongest_dimension_label,
  next_improvement_title, next_improvement_description,
  commercial_reading,
  answers_full,
  answer_s1, answer_c1, answer_f1, answer_d1
FROM diagnostico_respostas
WHERE id = '<uuid>';
```

### 3. Baixar PDF (via painel Supabase Storage ou signed URL)
```js
const { data } = await supabase.storage
  .from('diagnostic-reports')
  .createSignedUrl(storage_path, 60 * 60);
```

### 4. Marcar Raio-X como atendido (libera relatório automático)
```sql
UPDATE diagnostico_respostas
   SET rayx_attended = true,
       rayx_specialist_email = 'voce@clubpetro.com',
       rayx_specialist_name  = 'Seu Nome'
 WHERE id = '<uuid>';
```

### 5. Liberar manualmente (sem raio-x)
```sql
UPDATE diagnostico_respostas
   SET report_is_user_unlocked = true,
       report_unlocked_at = now(),
       report_unlocked_reason = 'manual_specialist_release',
       report_unlocked_by = 'voce@clubpetro.com'
 WHERE id = '<uuid>';
```

### 6. Registrar ação comercial (anexa no array `commercial_actions`)
```sql
UPDATE diagnostico_respostas
   SET commercial_actions = commercial_actions || jsonb_build_array(
         jsonb_build_object(
           'at', now(),
           'type', 'whatsapp_contact',
           'status', 'completed',
           'specialist', 'voce@clubpetro.com',
           'notes', 'Cliente respondeu, agendou RaioX'
         )
       ),
       commercial_last_contact_at = now(),
       commercial_owner = 'voce@clubpetro.com',
       commercial_status = 'em_contato'
 WHERE id = '<uuid>';
```

## Funil de conversão por UTM

```sql
SELECT
  utm_source, utm_campaign,
  COUNT(*) AS sessions,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE specialist_cta_count > 0) AS clicked_whatsapp,
  COUNT(*) FILTER (WHERE rayx_cta_count > 0) AS clicked_rayx,
  COUNT(*) FILTER (WHERE rayx_attended) AS attended_rayx,
  AVG(overall_score) AS avg_score
FROM diagnostico_respostas
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY sessions DESC;
```

## RLS

| Role | INSERT | UPDATE | SELECT |
|---|---|---|---|
| `anon` (front)         | ✅ | ✅ | ❌ |
| `authenticated` (BO)   | ✅ | ✅ | ✅ |

Anon precisa UPDATE pra atualizar a própria linha conforme o fluxo
(nome, contato, respostas, resultado). Se quiser endurecer, mover esses
UPDATEs pra Edge Function com service_role.

## Pendências

- **Edge Function `release-report`**: pra gerar signed URL ao liberar
  manualmente + enviar e-mail com o link pro lead.
- **IP do usuário**: campo `ip_address` é nullable; coletar via Edge
  Function que vê o `x-forwarded-for` do request.
- **Painel comercial**: por enquanto consultas direto no SQL Editor.
  Próximo passo é uma página dedicada (Next.js/Retool/Supabase Studio).
- **Claims por papel** (`role: commercial | specialist | admin`):
  RLS hoje libera tudo pra authenticated; refinar quando o painel existir.
