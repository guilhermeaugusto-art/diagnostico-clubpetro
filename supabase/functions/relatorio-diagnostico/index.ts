// API de dados do painel do Diagnóstico de Saúde do Posto - v14
// (v14: + participou_raiox no shape; o KPI virou "Participaram do Raio X").
//
// A PÁGINA do painel vive em https://diagnostico-clubpetro.web.app/painel/
// (public/painel/index.html, deployada com o app no Firebase Hosting).
// Esta função é só a fonte de dados + compatibilidade de link:
//   - ?format=json  -> dados das sessões (o painel busca a cada 60s);
//   - sem format    -> 302 para o painel no Firebase, preservando a chave
//     (o link antigo *.supabase.co continua funcionando para sempre).
//
// Por que a página saiu daqui: o Supabase rebaixa text/html para text/plain
// no domínio de funções (anti-phishing), então HTML servido daqui não
// renderiza mais no navegador.
//
// Rota RESERVA de dados: se esta função cair, o painel cai sozinho para a
// RPC public.relatorio_diagnostico_dados (migration 20260714120000), que
// devolve o mesmo shape direto do banco via PostgREST.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAINEL_URL = "https://diagnostico-clubpetro.web.app/painel/";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getSecret(): Promise<string | null> {
  const { data } = await supabase
    .from("integration_secrets")
    .select("value")
    .eq("key", "relatorio_diagnostico_key")
    .maybeSingle();
  return data?.value ?? null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const secret = await getSecret();
  if (!secret || key !== secret) {
    return new Response("Não autorizado.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Link antigo do painel: redireciona para a página no Firebase. O navegador
  // preserva o #hash de filtros por conta própria ao seguir o 302.
  if (url.searchParams.get("format") !== "json") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: PAINEL_URL + "?key=" + encodeURIComponent(key),
        "Cache-Control": "no-store",
      },
    });
  }

  const { data: rows, error } = await supabase
    .from("diagnostico_respostas")
    .select("nome, telefone, email, papel, conhece, score, concluiu, mql, contato_especialista, contato_especialista_em, agendou_raiox, participou_raiox, raiox_observacao, interesse, pontuacao_pilares, pdf_comercial_url, respostas, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    return new Response("Erro ao ler o banco: " + error.message, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return new Response(JSON.stringify(rows ?? []), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      // O painel em diagnostico-clubpetro.web.app lê os dados daqui; a chave
      // na query segue sendo o portão de acesso.
      "Access-Control-Allow-Origin": "*",
    },
  });
});
