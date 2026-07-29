-- 5c da esteira (29/07/2026): alem do link na nota, o PDF comercial do
-- diagnostico e IMPORTADO como arquivo anexado ao card do Kommo (pedido do
-- dono). Flag de dedup do anexo; so marca apos anexar com sucesso.
alter table public.diagnostico_respostas
  add column if not exists kommo_pdf_enviado boolean not null default false;
