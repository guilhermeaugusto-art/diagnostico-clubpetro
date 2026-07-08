-- Colunas mortas da era do PDF único (0 linhas preenchidas, zero referências
-- no app, no BI e nas funções — substituídas por pdf_comercial_*/pdf_cliente_*).
-- Backup integral pré-remoção: public.diagnostico_respostas_backup_20260708.
-- Aplicada em produção via MCP em 08/07/2026.
alter table public.diagnostico_respostas
  drop column if exists pdf_path,
  drop column if exists pdf_gerado_em;

comment on column public.diagnostico_respostas.relacao_posto is 'Relação composta oficial (Dono(a) ou Diretor(a) / Gerente ou Supervisor(a) / Frentista), derivada de papel pelo trigger fn_diagnostico_relacao_posto';
comment on column public.diagnostico_respostas.duplicado_de is 'Preenchido = ficha duplicada; aponta para a ficha canônica da pessoa. Robôs (esteira, presença, conversão RD) ignoram fichas marcadas';
comment on column public.diagnostico_respostas.rd_oportunidade_enviado is 'Evento OPPORTUNITY enviado ao RD (participou do Raio-X, não-cliente, não-frentista) — dedup da diagnostico-esteira';
comment on column public.diagnostico_respostas.kommo_enviado is 'Lead criado/etiquetado no Kommo (pipeline Fidelidade, tag raiox-realizado) — dedup da diagnostico-esteira';
comment on column public.diagnostico_respostas.kommo_lead_id is 'ID do lead no Kommo (clubpetro.kommo.com)';
comment on column public.diagnostico_respostas.kommo_erro is 'Último erro de envio ao Kommo; limpo após sucesso. Retry automático no sweep de 10 min';
comment on table public.raiox_presenca_log is 'Relatório de cada execução do sync-raiox-presenca (marcados/revisar/internos) — a lista revisar exige olho humano na terça';
comment on table public.diagnostico_esteira_log is 'Resumo de cada execução da diagnostico-esteira (ações e erros por lead/etapa)';

analyze public.diagnostico_respostas;
