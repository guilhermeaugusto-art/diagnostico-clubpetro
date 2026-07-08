-- Relação composta com o posto (taxonomia oficial dos formulários ClubPetro)
-- + colunas de controle da esteira RD/Kommo (dedup por etapa).
-- Aplicada em produção via MCP em 08/07/2026.
alter table public.diagnostico_respostas
  add column if not exists relacao_posto text,
  add column if not exists rd_oportunidade_enviado boolean not null default false,
  add column if not exists rd_oportunidade_em timestamp with time zone,
  add column if not exists kommo_enviado boolean not null default false,
  add column if not exists kommo_lead_id bigint,
  add column if not exists kommo_enviado_em timestamp with time zone;

create or replace function public.fn_diagnostico_relacao_posto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.relacao_posto := case lower(coalesce(new.papel, ''))
    when 'dono' then 'Dono(a) ou Diretor(a)'
    when 'gerente' then 'Gerente ou Supervisor(a)'
    when 'outro' then 'Frentista'
    when 'frentista' then 'Frentista'
    else new.relacao_posto
  end;
  return new;
end;
$$;

drop trigger if exists trg_diagnostico_relacao_posto on public.diagnostico_respostas;
create trigger trg_diagnostico_relacao_posto
before insert or update of papel on public.diagnostico_respostas
for each row execute function public.fn_diagnostico_relacao_posto();
