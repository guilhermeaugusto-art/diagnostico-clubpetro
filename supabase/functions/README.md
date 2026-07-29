# Edge Functions do Diagnóstico (produção: projeto azmtxhjtqodtaeoshrye)

Fontes espelhados do que está deployado em produção (08/07/2026). O deploy é
feito direto no Supabase (MCP/CLI); este diretório é o versionamento.

| Função | Versão | O que faz |
|---|---|---|
| `rd-diagnostico-conversion` (v9) | trigger AFTER UPDATE na `diagnostico_respostas` | Conversões RD em tempo real: `fez-diagnostico-posto` (tag diagnostico-realizado + cargo composto em job_title) e `confirmou-raiox-posto`/`fez-raiox-posto`. Campos custom sempre como STRING (número dava 400 no RD). Ignora frentista, sem e-mail e fichas duplicadas. |
| `diagnostico-esteira` (v15) | triggers em `participou_raiox` e `concluiu` (`?gatilho=concluiu`) + cron a cada 10 min | Reconciliador com dedup por coluna e retry: conversões RD, evento OPPORTUNITY (OAuth de vm_app_keys, refresh automático) e Kommo (pipeline Fidelidade 8166623, dedup por e-mail/telefone). **Regra 29/07/2026: concluiu o quiz = oportunidade (RD+Kommo), sem esperar o Raio-X — só fichas criadas a partir do corte; base antiga segue pela participação.** Card criado na conclusão nasce com tag `diagnostico-realizado` e ganha `raiox-realizado` + nota na primeira presença. Log em `diagnostico_esteira_log`. |
| `sync-raiox-presenca` (v7) | cron diário 06h UTC + terças 14-17h UTC a cada 10 min | Lê presença real do Google Meet (sala ado-rhwa-kvx), casa participante→lead agrupando por PESSOA (e-mail/telefone — fichas duplicadas não geram ambiguidade), marca `participou_raiox` (update condicional) e envia `fez-raiox-posto` ao RD. Relatório persistido em `raiox_presenca_log` (lista `revisar` = olho humano). |

**Fora do repo de propósito:** `confirmar-raiox` — o fonte em produção ainda tem
credenciais Google hardcoded (pendência: rotacionar e mover para
`integration_secrets`, como faz a sync-raiox-presenca). Versionar só depois disso.

Segredos: nada aqui contém token. RD público em `Armazena_Token_RD`; RD OAuth e
Kommo em `vm_app_keys`; Google Meet em `integration_secrets`.
