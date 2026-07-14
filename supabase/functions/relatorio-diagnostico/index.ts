// Painel vivo do Diagnóstico de Saúde do Posto - v12.
// Filtros gravados na URL (#): compartilhar o link reproduz exatamente a mesma tela.
// v11: coluna "Respostas" na tabela de pessoas expande as respostas completas
// da sessão (pergunta a pergunta, agrupadas por frente, com pontos).
// v12: o Supabase passou a rebaixar text/html para text/plain no domínio de
// funções (anti-phishing), então a PÁGINA oficial virou o espelho estático em
// https://diagnostico-clubpetro.web.app/painel/ (public/painel/index.html),
// que busca os dados daqui via format=json. O CORS abaixo libera essa leitura.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data: rows, error } = await supabase
    .from("diagnostico_respostas")
    .select("nome, telefone, email, papel, conhece, score, concluiu, mql, agendou_raiox, raiox_observacao, interesse, pontuacao_pilares, pdf_comercial_url, respostas, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    return new Response("Erro ao ler o banco: " + error.message, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(rows ?? []), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        // O painel em diagnostico-clubpetro.web.app lê os dados daqui; a chave
        // na query segue sendo o portão de acesso.
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const dataJson = JSON.stringify(rows ?? []).replace(/</g, "\\u003c");
  const html = PAGE_TOP + dataJson + PAGE_BOTTOM;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
});

const PAGE_TOP = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light">
<title>Diagnóstico ClubPetro - Painel vivo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
<style>
  :root{
    color-scheme:light;
    --page:#E9EDF3;
    --bloom-a:rgba(242,102,0,.20); --bloom-b:rgba(85,90,116,.18); --bloom-c:rgba(242,102,0,.12);
    --ink:#1F2028; --muted:#4C5165;
    --accent:#F26600; --accent-deep:#A13C0B; --accent-ink:#FFFFFF; --bar:#CC4D02;
    --comp:rgba(31,32,40,.24);
    --down:#B3323C;
    --row-hover:rgba(242,102,0,.07);
    --accent-tint:rgba(242,102,0,.12); --accent-tint-bd:rgba(242,102,0,.34); --accent-tint-ink:#A13C0B;
    --border-soft:rgba(31,32,40,.09);
    --glass:rgba(255,255,255,.74); --glass-strong:rgba(255,255,255,.90); --glass-solid:#FFFFFF;
    --glass-bd:rgba(255,255,255,.9); --glass-edge:rgba(255,255,255,.95);
    --glass-shadow:0 16px 40px rgba(31,32,40,.16), 0 4px 12px rgba(31,32,40,.08), 0 0 0 1px rgba(31,32,40,.05);
    --lift-shadow:0 28px 64px rgba(31,32,40,.22), 0 10px 24px rgba(31,32,40,.12), 0 0 0 1px rgba(31,32,40,.05);
    --th-bg:#26272F; --th-ink:#FFFFFF;
    --zebra:rgba(31,32,40,.04); --track:rgba(31,32,40,.09);
    --ok-bg:rgba(31,138,92,.12); --ok-ink:#17694A; --ok-bd:rgba(31,138,92,.34);
    --neutral-bg:rgba(31,32,40,.06); --neutral-ink:#464A5E; --neutral-bd:rgba(31,32,40,.18);
    --link:#A13C0B;
    --bar-glow:0 8px 20px rgba(242,102,0,.32);
    --font-display:"Montserrat","Segoe UI",Arial,sans-serif;
    --font-sans:"Open Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --font-ui:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    background-color:var(--page);
    background-image:
      radial-gradient(760px 500px at 10% -8%, var(--bloom-a), transparent 62%),
      radial-gradient(680px 560px at 98% 10%, var(--bloom-b), transparent 64%),
      radial-gradient(800px 640px at 45% 112%, var(--bloom-c), transparent 62%);
    background-attachment:fixed;
    color:var(--ink); font-family:var(--font-sans); font-size:14px; line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  .shell{max-width:1120px; margin:0 auto; padding:40px 24px 64px}
  @media (max-width:720px){ .shell{padding:20px 12px 48px} }

  .glass{
    background:var(--glass);
    -webkit-backdrop-filter:blur(20px) saturate(160%);
    backdrop-filter:blur(20px) saturate(160%);
    border:1px solid var(--glass-bd);
    box-shadow:var(--glass-shadow), inset 0 1px 0 var(--glass-edge);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
    .glass{background:var(--glass-solid)}
  }

  .eyebrow{font-family:var(--font-ui); font-size:11px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--accent-deep); margin:0 0 8px}
  h1{font-family:var(--font-display); font-weight:800; font-size:clamp(22px,4vw,30px); line-height:1.2; margin:0 0 4px; letter-spacing:-.01em}
  .sub{font-size:13.5px; color:var(--muted); margin:0}
  section{margin-top:44px}
  h2{font-family:var(--font-display); font-weight:700; font-size:17px; margin:0 0 4px; display:flex; align-items:center; gap:8px}
  h2::before{content:""; display:inline-block; width:16px; height:4px; border-radius:2px; background:var(--accent); flex:none}
  .hint{font-size:12.5px; color:var(--muted); margin:0 0 12px; max-width:76ch}

  .topbar{display:flex; gap:12px; align-items:center; margin-top:20px; flex-wrap:wrap}
  .btn-filtros{
    font-family:var(--font-ui); font-size:13px; font-weight:600; color:var(--neutral-ink);
    background:var(--glass-strong); border:1px solid var(--neutral-bd); border-radius:999px;
    padding:8px 24px; cursor:pointer; min-height:48px; display:inline-flex; align-items:center; gap:8px;
    box-shadow:0 4px 12px rgba(31,32,40,.12), inset 0 1px 0 var(--glass-edge);
    transition:transform .15s ease, box-shadow .15s ease;
  }
  .btn-filtros:hover{transform:translateY(-2px); box-shadow:0 8px 20px rgba(31,32,40,.16), inset 0 1px 0 var(--glass-edge)}
  .btn-filtros:active{transform:scale(.97)}
  .btn-filtros[aria-expanded="true"]{background:var(--accent-tint); border-color:var(--accent-tint-bd); color:var(--accent-tint-ink)}
  .btn-filtros:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  .fcount{display:none; background:var(--bar); color:#FFFFFF; border-radius:999px; min-width:20px; height:20px; padding:0 6px; font-size:11px; font-weight:700; align-items:center; justify-content:center}
  .fcount.on{display:inline-flex}
  .stamp{font-family:var(--font-ui); font-size:11.5px; color:var(--muted); margin-left:auto; display:flex; gap:8px; align-items:center}
  .pulse{display:inline-block; width:8px; height:8px; border-radius:999px; background:var(--ok-ink); animation:pulsar 2.4s ease-in-out infinite}
  @keyframes pulsar{ 0%,100%{opacity:1} 50%{opacity:.35} }
  .novos{font-family:var(--font-ui); font-size:11.5px; font-weight:600; color:var(--ok-ink); background:var(--ok-bg); border:1px solid var(--ok-bd); border-radius:999px; padding:2px 10px; display:none}

  .painel{display:none; border-radius:20px; padding:16px; margin-top:12px; flex-direction:column; gap:12px}
  .painel.aberto{display:flex}
  .f-line{display:flex; gap:12px; flex-wrap:wrap; align-items:end}
  .f-lb{font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:4px}
  .f-field input{font-family:var(--font-sans); font-size:13.5px; color:var(--ink); background:var(--glass-solid); border:1px solid var(--neutral-bd); border-radius:12px; padding:8px 12px; min-height:48px; cursor:pointer}
  .f-field input[type="search"]{cursor:text}
  .f-field input:focus-visible{outline:2px solid var(--accent); outline-offset:1px}
  .f-help{display:block; font-size:11px; color:var(--muted); margin-top:4px}
  .seg{display:inline-flex; background:var(--neutral-bg); border:1px solid var(--neutral-bd); border-radius:999px; padding:4px; gap:4px; flex-wrap:wrap}
  .seg button{
    font-family:var(--font-ui); font-size:12px; font-weight:600; color:var(--neutral-ink);
    background:transparent; border:1px solid transparent; border-radius:999px; padding:8px 16px; cursor:pointer; min-height:44px;
    transition:transform .12s ease;
  }
  .seg button:active{transform:scale(.96)}
  .seg button.active{background:var(--accent-tint); border-color:var(--accent-tint-bd); color:var(--accent-tint-ink)}
  .seg button:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  .limpar{font-family:var(--font-ui); font-size:12px; font-weight:600; color:var(--link); background:none; border:none; cursor:pointer; padding:8px; min-height:48px; text-decoration:underline; text-underline-offset:2px}
  .limpar:focus-visible{outline:2px solid var(--accent); outline-offset:2px}

  .kpis{display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:12px; margin-top:16px}
  .kpi{
    border-radius:16px; padding:16px;
    background:var(--glass-strong); border:1px solid var(--glass-bd);
    box-shadow:var(--glass-shadow), inset 0 1px 0 var(--glass-edge);
    border-top:3px solid var(--accent);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .kpi:hover{transform:translateY(-4px) scale(1.02); box-shadow:var(--lift-shadow), inset 0 1px 0 var(--glass-edge)}
  .kpi b{display:block; font-family:var(--font-display); font-size:30px; font-weight:800; line-height:1.15; font-variant-numeric:tabular-nums}
  .kpi span{font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--muted)}
  .kpi .delta-l{display:block; font-family:var(--font-sans); font-size:12px; letter-spacing:0; text-transform:none; font-weight:400; color:var(--muted); margin-top:4px}
  .delta{font-weight:600}
  .delta.up{color:var(--ok-ink)}
  .delta.down{color:var(--down)}

  .ins{margin:12px 0 0; padding:0; list-style:none; display:grid; gap:8px}
  .ins li{
    background:var(--glass-strong); border:1px solid var(--glass-bd); border-left:4px solid var(--bar);
    border-radius:12px; padding:12px 16px; font-size:13px;
    box-shadow:var(--glass-shadow), inset 0 1px 0 var(--glass-edge);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .ins li:hover{transform:translateY(-2px); box-shadow:var(--lift-shadow), inset 0 1px 0 var(--glass-edge)}
  .ins b{font-family:var(--font-display); font-size:13px}

  .card{border-radius:20px; padding:24px}
  @media (max-width:720px){ .card{padding:16px; border-radius:16px} }
  .f-legend{font-size:12px; color:var(--muted); margin:0 0 12px; display:flex; gap:16px; flex-wrap:wrap; align-items:center}
  .sw{display:inline-block; width:12px; height:12px; border-radius:4px; margin-right:6px; vertical-align:-1px}
  .sw-a{background:var(--bar)}
  .sw-b{background:var(--comp)}
  .f-row{display:grid; grid-template-columns:200px 1fr; gap:16px; align-items:center; padding:8px 0}
  @media (max-width:640px){ .f-row{grid-template-columns:124px 1fr; gap:8px} }
  .f-label{font-size:13px; font-weight:600; text-align:right}
  .f-label small{display:block; color:var(--muted); font-weight:400; font-size:11.5px}
  .f-bar{
    background-color:var(--bar);
    background-image:linear-gradient(180deg, rgba(255,255,255,.4), rgba(255,255,255,.05) 34%, rgba(0,0,0,.10) 92%);
    color:var(--accent-ink); height:36px; border-radius:0 12px 12px 0;
    display:flex; align-items:center; justify-content:flex-end; padding:0 12px;
    font-family:var(--font-display); font-weight:700; font-size:15px; font-variant-numeric:tabular-nums; min-width:36px;
    box-shadow:var(--bar-glow), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -2px 4px rgba(0,0,0,.12);
    transition:width .5s cubic-bezier(.16,1,.3,1);
  }
  .f-bar-b{
    background:var(--comp); color:var(--ink); height:20px; border-radius:0 8px 8px 0;
    display:flex; align-items:center; justify-content:flex-end; padding:0 10px;
    font-family:var(--font-ui); font-size:11.5px; font-weight:600; font-variant-numeric:tabular-nums;
    min-width:28px; margin-top:4px; transition:width .5s cubic-bezier(.16,1,.3,1);
  }
  .f-total{font-size:13px; color:var(--muted); margin:16px 0 0}
  .f-total strong{color:var(--ink)}

  .table-wrap{overflow-x:auto; margin-top:12px; border-radius:16px}
  .table-wrap:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  table{border-collapse:collapse; width:100%; font-size:13px; min-width:800px}
  th{background:var(--th-bg); color:var(--th-ink); text-align:left; font-family:var(--font-ui); font-weight:600; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; padding:12px 16px; white-space:nowrap}
  th .thb{font:inherit; color:inherit; letter-spacing:inherit; text-transform:inherit; background:none; border:none; padding:0; cursor:pointer; display:inline-flex; align-items:center; gap:4px}
  th .thb:focus-visible{outline:2px solid var(--th-ink); outline-offset:2px}
  th .dir{font-size:11px; text-transform:none; letter-spacing:0}
  td{padding:12px 16px; border-bottom:1px solid var(--border-soft); vertical-align:middle; transition:background .15s ease}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:nth-child(even) td{background:var(--zebra)}
  tbody tr:hover td{background:var(--row-hover)}
  td.num{font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; font-family:var(--font-display); font-weight:700}
  th.num{text-align:right}
  td.nowrap{white-space:nowrap}
  td .who{font-weight:600}
  td .obs{display:block; font-size:11.5px; color:var(--muted)}
  a{color:var(--link); text-decoration-thickness:1px; text-underline-offset:2px}
  a:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  .chip{display:inline-block; font-family:var(--font-ui); border-radius:999px; padding:4px 12px; font-size:11.5px; font-weight:600; border:1px solid var(--neutral-bd); background:var(--neutral-bg); color:var(--neutral-ink); white-space:nowrap; box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
  .chip.ok{background:var(--ok-bg); color:var(--ok-ink); border-color:var(--ok-bd)}
  .chip.cli{background:var(--accent-tint); color:var(--accent-tint-ink); border-color:var(--accent-tint-bd)}
  .empty{padding:24px; color:var(--muted); font-size:13px; text-align:center}

  .resp-btn{
    font-family:var(--font-ui); font-size:11.5px; font-weight:600; color:var(--accent-tint-ink);
    background:var(--accent-tint); border:1px solid var(--accent-tint-bd); border-radius:999px;
    padding:4px 14px; cursor:pointer; white-space:nowrap; min-height:32px;
  }
  .resp-btn:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  .resp-btn[aria-expanded="true"]{background:var(--th-bg); color:var(--th-ink); border-color:var(--th-bg)}
  tbody tr.rrow td{background:rgba(242,102,0,.05) !important; padding:16px 20px}
  .resp-wrap{display:grid; grid-template-columns:1fr 1fr; gap:16px 28px}
  @media (max-width:860px){ .resp-wrap{grid-template-columns:1fr} }
  .resp-dim{font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--accent-deep); margin:0 0 6px; border-bottom:1px solid var(--border-soft); padding-bottom:4px}
  .resp-item{margin:0 0 10px}
  .resp-q{margin:0; font-size:11.5px; color:var(--muted); line-height:1.45}
  .resp-a{margin:2px 0 0; font-size:12.5px; font-weight:600; color:var(--ink); line-height:1.45}
  .resp-pts{display:inline-block; margin-left:8px; font-family:var(--font-ui); font-size:10.5px; font-weight:600; color:var(--muted); background:var(--neutral-bg); border:1px solid var(--neutral-bd); border-radius:999px; padding:1px 8px; vertical-align:1px}
  .resp-pts.resp-vague{color:var(--down); border-color:rgba(179,50,60,.35); background:rgba(179,50,60,.08)}

  .themes{display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:16px}
  @media (max-width:760px){ .themes{grid-template-columns:1fr} }
  .t-card{border-radius:16px; padding:20px 24px}
  .t-cap{font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 0 12px}
  .t-row{display:grid; grid-template-columns:164px 1fr 32px; gap:12px; align-items:center; padding:4px 0}
  @media (max-width:640px){ .t-row{grid-template-columns:124px 1fr 32px; gap:8px} }
  .t-row .t-name{font-size:12.5px; text-align:right}
  .t-track{background:var(--track); border-radius:0 4px 4px 0; height:16px}
  .t-fill{background-color:var(--bar); background-image:linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.02) 45%, rgba(0,0,0,.08)); height:16px; border-radius:0 4px 4px 0; min-width:4px; box-shadow:inset 0 1px 0 rgba(255,255,255,.4), inset 0 -1px 2px rgba(0,0,0,.10); transition:width .5s cubic-bezier(.16,1,.3,1)}
  .t-val{font-size:12.5px; font-variant-numeric:tabular-nums; color:var(--muted); font-weight:600}

  footer{margin-top:56px; padding-top:16px; border-top:1px solid var(--border-soft); font-family:var(--font-ui); font-size:11.5px; color:var(--muted); display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap}
  @media (prefers-reduced-motion: reduce){
    .kpi,.ins li,.btn-filtros{transition:none}
    .kpi:hover,.ins li:hover,.btn-filtros:hover{transform:none}
    .f-bar,.f-bar-b,.t-fill{transition:none}
    .seg button{transition:none}
    .pulse{animation:none}
  }
</style>
</head>
<body>
<div class="shell">
  <header>
    <p class="eyebrow">ClubPetro - Inteligência Comercial - Uso interno</p>
    <h1>Diagnóstico de Saúde do Posto</h1>
    <p class="sub" id="sub">Carregando</p>
  </header>

  <div class="topbar">
    <button type="button" class="btn-filtros" id="btn-filtros" aria-expanded="false" aria-controls="painel-filtros">Filtrar<span class="fcount" id="fcount"></span></button>
    <span class="stamp" role="status"><span class="pulse" aria-hidden="true"></span><span id="stamp">ao vivo</span><span class="novos" id="novos"></span></span>
  </div>
  <div class="painel glass" id="painel-filtros">
    <div class="f-line">
      <div class="f-field"><label class="f-lb" for="f-de">De</label><input type="date" id="f-de"></div>
      <div class="f-field"><label class="f-lb" for="f-ate">Até</label><input type="date" id="f-ate"></div>
      <div class="f-field"><span class="f-lb" id="lb-periodo">Período</span>
        <div class="seg" role="group" aria-labelledby="lb-periodo">
          <button type="button" data-preset="semana" aria-pressed="false">Esta semana</button>
          <button type="button" data-preset="7" aria-pressed="false">7 dias</button>
          <button type="button" data-preset="tudo" aria-pressed="false">Tudo</button>
        </div>
      </div>
      <div class="f-field" style="flex:1;min-width:170px"><label class="f-lb" for="f-nome">Buscar por nome</label><input type="search" id="f-nome" placeholder="Digite um nome" style="width:100%"></div>
    </div>
    <div class="f-line">
      <div class="f-field"><label class="f-lb" for="f-comp-de">Comparação: de</label><input type="date" id="f-comp-de"></div>
      <div class="f-field"><label class="f-lb" for="f-comp-ate">Comparação: até</label><input type="date" id="f-comp-ate"><span class="f-help">Vazio compara com o período anterior</span></div>
      <div class="f-field"><span class="f-lb" id="lb-papel">Relação</span>
        <div class="seg" role="group" aria-labelledby="lb-papel" id="seg-papel">
          <button type="button" data-v="todos" class="active" aria-pressed="true">Todos</button>
          <button type="button" data-v="dono" aria-pressed="false">Dono</button>
          <button type="button" data-v="gerente" aria-pressed="false">Gerente</button>
          <button type="button" data-v="outro" aria-pressed="false">Outro</button>
        </div>
      </div>
      <div class="f-field"><span class="f-lb" id="lb-status">Status (age na tabela)</span>
        <div class="seg" role="group" aria-labelledby="lb-status" id="seg-status">
          <button type="button" data-v="todos" class="active" aria-pressed="true">Todos</button>
          <button type="button" data-v="confirmou" aria-pressed="false">Confirmou</button>
          <button type="button" data-v="agendou" aria-pressed="false">Agendou</button>
          <button type="button" data-v="sem_agendar" aria-pressed="false">Sem agendar</button>
          <button type="button" data-v="abandonou" aria-pressed="false">Não finalizou</button>
        </div>
      </div>
      <button type="button" class="limpar" id="limpar">Limpar filtros</button>
    </div>
  </div>

  <section>
    <h2>Resumo do período</h2>
    <div class="kpis" id="kpis"></div>
  </section>

  <section>
    <h2>Funil</h2>
    <p class="hint">Percentual sempre sobre a etapa anterior. Começaram conta sessões; das etapas seguintes em diante, pessoas únicas. A barra cinza mostra o período de comparação com os mesmos filtros. O filtro de status age só na tabela de pessoas.</p>
    <div class="card glass" id="funnel"></div>
  </section>

  <section>
    <h2>Leitura analítica</h2>
    <p class="hint">Reavaliada a cada 60 segundos junto com o banco e refeita a cada filtro: se o cenário muda, a leitura muda.</p>
    <ul class="ins" id="insights"></ul>
  </section>

  <section>
    <h2 id="t-pessoas">Pessoas</h2>
    <p class="hint">Uma linha por pessoa do período principal (vale a sessão que converteu, ou a mais recente). O nome abre o PDF quando disponível; o botão Ver abre as respostas completas da pessoa, pergunta a pergunta. Clique em Nome, Nota ou Início para ordenar.</p>
    <div class="table-wrap glass" tabindex="0" role="region" aria-label="Tabela de pessoas"><table>
      <thead><tr>
        <th class="sort" data-k="nome" aria-sort="none"><button type="button" class="thb">Nome<span class="dir" id="d-nome"></span></button></th>
        <th>Telefone</th><th>Relação</th><th>Se conhece</th>
        <th class="num sort" data-k="nota" aria-sort="none"><button type="button" class="thb">Nota<span class="dir" id="d-nota"></span></button></th>
        <th>Frente fraca</th><th>Status</th>
        <th class="sort" data-k="inicio" aria-sort="descending"><button type="button" class="thb">Início<span class="dir" id="d-inicio"></span></button></th>
        <th>Respostas</th>
      </tr></thead>
      <tbody id="tb-pessoas"></tbody>
    </table></div>
  </section>

  <section>
    <h2>Temas e dores do período</h2>
    <div class="themes">
      <div class="t-card glass"><p class="t-cap">Dores declaradas (citações)</p><div id="dores"></div></div>
      <div class="t-card glass"><p class="t-cap">Frentes mais fracas (média 0 a 100)</p><div id="pilares"></div></div>
    </div>
  </section>

  <footer>
    <span>Fonte: Supabase - diagnostico_respostas - dados ao vivo</span>
    <span>Atualiza sozinho a cada 60 segundos, sem recarregar</span>
  </footer>
</div>
<script id="data" type="application/json">`;

const PAGE_BOTTOM = `</script>
<script>
(function(){
  "use strict";
  var RAW = JSON.parse(document.getElementById("data").textContent || "[]");
  var BRT_MS = 3 * 60 * 60 * 1000;
  var DIA_MS = 86400000;
  var KEY = new URLSearchParams(location.search).get("key") || "";
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function brtDate(iso){ return new Date(new Date(iso).getTime() - BRT_MS); }
  function ymd(d){ return d.toISOString().slice(0,10); }
  function dUTC(s){ var p = s.split("-"); return Date.UTC(+p[0], +p[1]-1, +p[2]); }
  function fmtBr(s){ if (!s) return ""; var p = s.split("-"); return p[2] + "/" + p[1]; }
  function fmtDia(iso){
    var d = brtDate(iso);
    var p = function(n){ return (n<10?"0":"")+n; };
    return p(d.getUTCDate())+"/"+p(d.getUTCMonth()+1)+" "+p(d.getUTCHours())+":"+p(d.getUTCMinutes());
  }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>\"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function norm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,""); }
  function chave(r){ return norm(r.email) || String(r.telefone||"") || norm(r.nome) || ("anon-" + r.created_at); }
  function confirmouRow(r){ return !!(r.raiox_observacao && String(r.raiox_observacao).indexOf("Confirmou presen") === 0); }

  function foneInfo(t){
    if (!t) return { texto: "n/d", link: null };
    var d = String(t).replace(/\\D/g, "");
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11) return { texto: "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7), link: "https://wa.me/55" + d };
    if (d.length === 10) return { texto: "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6), link: "https://wa.me/55" + d };
    return { texto: String(t), link: null };
  }

  var CONHECE = { cliente: "Já é cliente", conhece: "Conhece de nome", primeira: "Primeira vez" };
  var PAPEL = { dono: "Dono", gerente: "Gerente", outro: "Outro" };
  var DOR = { equipe: "Equipe e atendimento", concorrencia: "Pressão da concorrência", margem: "Margem e caixa", fidelizar: "Cliente que não volta", padrao: "Padrão de atendimento" };
  var PILAR = { pessoas: "Pessoas", marca: "Marca", comercial: "Comercial", fidelizacao: "Fidelização", dados: "Dados", resiliencia: "Resiliência" };
  var INICIATIVA = {
    pessoas: "rotina de treinamento e padrão de atendimento na pista",
    marca: "construir motivo de escolha além do preço, na experiência e na comunicação do posto",
    comercial: "método de margem e ativação do mix (aditivada, serviços, loja)",
    fidelizacao: "programa de recorrência para o cliente voltar, a alavanca central do ClubPetro",
    dados: "painel simples para decidir com o número na mão",
    resiliencia: "plano de fôlego de caixa e resposta à guerra de preço"
  };
  var ST_RANK = { confirmou: 3, agendou: 2, sem_agendar: 1, abandonou: 0 };
  var ST_CHIP = {
    confirmou: '<span class="chip ok">Confirmou</span>',
    agendou: '<span class="chip">Agendou</span>',
    sem_agendar: '<span class="chip">Sem agendar</span>',
    abandonou: '<span class="chip">Não finalizou</span>'
  };

  var state = { de:"", ate:"", q:"", papel:"todos", status:"todos", compDe:"", compAte:"", sk:"inicio", sd:"desc" };

  var deInput = document.getElementById("f-de");
  var ateInput = document.getElementById("f-ate");
  var compDeInput = document.getElementById("f-comp-de");
  var compAteInput = document.getElementById("f-comp-ate");
  var nomeInput = document.getElementById("f-nome");

  [deInput, ateInput, compDeInput, compAteInput].forEach(function(inp){
    inp.addEventListener("click", function(){
      if (typeof inp.showPicker === "function"){ try { inp.showPicker(); } catch(e){} }
    });
  });

  function statusRow(r){
    if (!r.concluiu) return "abandonou";
    if (r.agendou_raiox) return confirmouRow(r) ? "confirmou" : "agendou";
    return "sem_agendar";
  }
  function chipConhece(r){
    if (r.conhece === "cliente") return '<span class="chip cli">Já é cliente</span>';
    if (CONHECE[r.conhece]) return '<span class="chip">' + CONHECE[r.conhece] + '</span>';
    return "n/d";
  }
  function pontoFraco(r){
    var p = r.pontuacao_pilares; if (!p) return "n/d";
    var min = null, nome = "";
    for (var k in PILAR){ if (typeof p[k] === "number" && (min === null || p[k] < min)){ min = p[k]; nome = PILAR[k]; } }
    return min === null ? "n/d" : nome + " (" + min + ")";
  }

  /* ------- respostas completas por pessoa ------- */
  var respAbertos = {};
  function respChave(r){ return chave(r) + "|" + r.created_at; }
  // O texto da pergunta vem cru do app: resolve o plural {{singular|plural}}
  // pela forma singular e tira as tags de destaque.
  function limparTexto(s){
    return String(s == null ? "" : s).replace(/\\{\\{([^|}]*)\\|[^}]*\\}\\}/g, "$1").replace(/<[^>]*>/g, "");
  }
  function temRespostas(r){
    if (!r.respostas || typeof r.respostas !== "object") return false;
    for (var k in r.respostas){ if (k.charAt(0) !== "_") return true; }
    return false;
  }
  function respostasHtml(r){
    var grupos = {}, ordem = [];
    for (var k in r.respostas){
      if (k.charAt(0) === "_") continue;
      var it = r.respostas[k];
      if (!it || typeof it !== "object") continue;
      var dim = it.dimension_label || "Outras";
      if (!grupos[dim]){ grupos[dim] = []; ordem.push(dim); }
      grupos[dim].push(it);
    }
    return '<div class="resp-wrap">' + ordem.map(function(dim){
      return '<div><p class="resp-dim">' + esc(dim) + '</p>' + grupos[dim].map(function(it){
        var extras = "";
        if (typeof it.pts === "number") extras += '<span class="resp-pts">' + it.pts + ' pt' + (it.pts === 1 ? "" : "s") + '</span>';
        if (it.vague) extras += '<span class="resp-pts resp-vague">resposta vaga</span>';
        return '<div class="resp-item"><p class="resp-q">' + esc(limparTexto(it.question_text)) + '</p><p class="resp-a">' + esc(limparTexto(it.label)) + extras + '</p></div>';
      }).join("") + '</div>';
    }).join("") + '</div>';
  }

  function passaBase(r){
    if (state.q && norm(r.nome).indexOf(state.q) < 0) return false;
    if (state.papel !== "todos" && (r.papel || "") !== state.papel) return false;
    return true;
  }
  function linhasJanela(de, ate){
    return RAW.filter(function(r){
      if (!passaBase(r)) return false;
      var dia = ymd(brtDate(r.created_at));
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      return true;
    });
  }
  function diasPeriodo(){
    if (state.de && state.ate && state.de <= state.ate){
      return Math.round((dUTC(state.ate) - dUTC(state.de)) / DIA_MS) + 1;
    }
    return 7;
  }
  function janelaComp(){
    if (state.compDe && state.compAte && state.compDe <= state.compAte){
      return { de: state.compDe, ate: state.compAte };
    }
    if (state.compDe){
      var ini = dUTC(state.compDe);
      var fim = ini + (diasPeriodo() - 1) * DIA_MS;
      return { de: state.compDe, ate: ymd(new Date(fim)) };
    }
    if (!(state.de && state.ate) || state.de > state.ate) return null;
    var ini2 = dUTC(state.de), fim2 = dUTC(state.ate);
    var dias = Math.round((fim2 - ini2) / DIA_MS) + 1;
    var ate2 = ini2 - DIA_MS;
    var de2 = ate2 - (dias - 1) * DIA_MS;
    return { de: ymd(new Date(de2)), ate: ymd(new Date(ate2)) };
  }
  function pessoasDe(rows){
    var best = {};
    rows.forEach(function(r){
      var k = chave(r);
      var atual = best[k];
      if (!atual || ST_RANK[statusRow(r)] > ST_RANK[statusRow(atual)]) best[k] = r;
    });
    var out = [];
    for (var k in best) out.push(best[k]);
    return out;
  }
  function funilDe(rows){
    var pessoas = pessoasDe(rows);
    var ag = pessoas.filter(function(r){ return r.agendou_raiox; });
    return {
      pessoas: pessoas,
      comecaram: rows.length,
      terminaram: pessoas.filter(function(r){ return r.concluiu; }).length,
      mql: pessoas.filter(function(r){ return r.mql && r.email; }).length,
      ag: ag.length,
      agLista: ag,
      conf: ag.filter(confirmouRow).length,
      cli: pessoas.filter(function(r){ return r.conhece === "cliente"; }).length
    };
  }

  function deltaHtml(a, b){
    if (b === 0) return a > 0 ? ' <span class="delta up">(novo)</span>' : "";
    var d = Math.round((a - b) / b * 100);
    var cls = d > 0 ? "up" : (d < 0 ? "down" : "");
    var sinal = d > 0 ? "+" : "";
    return ' <span class="delta ' + cls + '">(' + sinal + d + '%)</span>';
  }
  function kpiDelta(a, fB, campo, textoSem){
    if (!fB) return textoSem;
    return "antes: " + fB[campo] + deltaHtml(a, fB[campo]);
  }

  function bar(rotulo, sub, valor, pct, compValor, compPct){
    var h = '<div class="f-row"><div class="f-label">' + rotulo + '<small>' + sub + '</small></div><div>';
    h += '<div class="f-bar" style="width:' + pct + '%">' + valor + '</div>';
    if (compValor !== null) h += '<div class="f-bar-b" style="width:' + compPct + '%">' + compValor + '</div>';
    h += '</div></div>';
    return h;
  }
  function tbar(nome, val, max){
    var pct = max > 0 ? Math.max(4, Math.round(val / max * 100)) : 4;
    return '<div class="t-row"><span class="t-name">' + esc(nome) + '</span><div class="t-track"><div class="t-fill" style="width:' + pct + '%"></div></div><span class="t-val">' + val + '</span></div>';
  }
  function pc(a, b){ return b > 0 ? Math.round(a / b * 100) : 0; }

  var kpiPrev = [];
  function contar(el, de, para){
    if (RM || de === para){ el.textContent = para; return; }
    var ini = performance.now(), dur = 400;
    function passo(t){
      var f = Math.min(1, (t - ini) / dur);
      f = 1 - Math.pow(1 - f, 3);
      el.textContent = Math.round(de + (para - de) * f);
      if (f < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }
  function anima(el){
    if (RM || !el.animate) return;
    el.animate([{ opacity: .35, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: "ease-out" });
  }

  // ------- filtros na URL: compartilhar o link reproduz a mesma tela -------
  function gravarHash(){
    var p = new URLSearchParams();
    if (state.de) p.set("de", state.de);
    if (state.ate) p.set("ate", state.ate);
    var qRaw = nomeInput.value.trim();
    if (qRaw) p.set("q", qRaw);
    if (state.papel !== "todos") p.set("papel", state.papel);
    if (state.status !== "todos") p.set("status", state.status);
    if (state.compDe) p.set("cde", state.compDe);
    if (state.compAte) p.set("cate", state.compAte);
    if (state.sk !== "inicio") p.set("ord", state.sk);
    if (state.sd !== "desc") p.set("dir", state.sd);
    var s = p.toString();
    try { history.replaceState(null, "", location.pathname + location.search + (s ? "#" + s : "")); } catch(e){}
  }
  function setSeg(id, v){
    document.getElementById(id).querySelectorAll("button").forEach(function(b){
      var ativo = b.getAttribute("data-v") === v;
      b.classList.toggle("active", ativo);
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
  }
  function lerHash(){
    var h = location.hash.replace(/^#/, "");
    if (!h) return false;
    var p = new URLSearchParams(h);
    var chaves = ["de","ate","q","papel","status","cde","cate","ord","dir"];
    var tem = chaves.some(function(k){ return p.get(k) != null && p.get(k) !== ""; });
    if (!tem) return false;
    state.de = p.get("de") || "";
    state.ate = p.get("ate") || "";
    var qRaw = p.get("q") || "";
    nomeInput.value = qRaw; state.q = norm(qRaw);
    state.papel = p.get("papel") || "todos";
    state.status = p.get("status") || "todos";
    state.compDe = p.get("cde") || "";
    state.compAte = p.get("cate") || "";
    state.sk = p.get("ord") || "inicio";
    state.sd = p.get("dir") || "desc";
    deInput.value = state.de; ateInput.value = state.ate;
    compDeInput.value = state.compDe; compAteInput.value = state.compAte;
    setSeg("seg-papel", state.papel);
    setSeg("seg-status", state.status);
    var h1 = hojeBRT(); var dow = (h1.getUTCDay() + 6) % 7;
    var semDe = ymd(new Date(h1.getTime() - dow*86400000)), hoje = ymd(h1);
    var seteDe = ymd(new Date(h1.getTime() - 6*86400000));
    var qual = "";
    if (!state.de && !state.ate) qual = "tudo";
    else if (state.de === semDe && state.ate === hoje) qual = "semana";
    else if (state.de === seteDe && state.ate === hoje) qual = "7";
    document.querySelectorAll("[data-preset]").forEach(function(b){
      var ativo = b.getAttribute("data-preset") === qual;
      b.classList.toggle("active", ativo);
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
    return true;
  }

  // ------- inteligência de análise -------
  function nomesCurto(lista, n){
    var nomes = lista.slice(0, n).map(function(r){ return esc((r.nome || "(sem nome)").split(" ")[0]); });
    var resto = lista.length - nomes.length;
    return nomes.join(", ") + (resto > 0 ? " e mais " + resto : "");
  }
  function nivelDe(score){
    if (score == null) return null;
    if (score <= 30) return "improviso";
    if (score <= 60) return "construcao";
    return "consistente";
  }
  function analise(fA, fB, compW, convertidos, dList, pList){
    var itens = [];
    var pessoas = fA.pessoas;

    if (state.q && pessoas.length === 1){
      var r = pessoas[0], st = statusRow(r);
      var acaoP = st === "confirmou" ? "Presença confirmada: preparar a conversa do Raio X com a frente fraca dela como pauta."
        : st === "agendou" ? "Agendou e ainda não confirmou: vale um toque no WhatsApp antes da sessão."
        : st === "sem_agendar" ? "Concluiu sem agendar: oferecer a vaga do Raio X diretamente."
        : "Não finalizou o diagnóstico: resgatar pelo telefone e ajudar a concluir.";
      itens.push("<b>" + esc(r.nome || "(sem nome)") + "</b>: nota " + (r.score == null ? "sem nota" : r.score) + ", frente fraca " + pontoFraco(r) + ", " + (CONHECE[r.conhece] || "relação com a marca não informada") + ". " + acaoP);
      return itens;
    }
    if (fA.comecaram === 0){
      itens.push("<b>Recorte vazio.</b> Nenhuma sessão no período e filtros atuais. Amplie o período ou limpe os filtros.");
      return itens;
    }

    if (RAW.length){
      var horas = (Date.now() - new Date(RAW[0].created_at).getTime()) / 3600000;
      if (horas < 1) itens.push("<b>Movimento agora:</b> a última sessão entrou há " + Math.max(1, Math.round(horas * 60)) + " minuto(s). O funil já conta com ela.");
      else if (horas >= 24) itens.push("<b>Alerta de ritmo: sem sessão nova há " + Math.floor(horas) + " horas.</b> Vale checar os canais que trazem gente para o diagnóstico (anúncio, WhatsApp, base).");
    }

    var etapas = [];
    if (fA.comecaram > 0) etapas.push({ rot: "Começaram para Terminaram", pct: pc(fA.terminaram, fA.comecaram), perda: fA.comecaram - fA.terminaram, un: "sessão(ões) sem concluir", acao: "resgatar quem deixou telefone no meio do caminho e revisar onde o questionário perde a pessoa." });
    if (fA.terminaram > 0) etapas.push({ rot: "Terminaram para MQL", pct: pc(fA.mql, fA.terminaram), perda: fA.terminaram - fA.mql, un: "conclusão(ões) que não viraram contato", acao: "perfil Outro ou sem e-mail: decidir se vale abordagem por telefone." });
    if (fA.mql > 0) etapas.push({ rot: "MQL para agendamento", pct: pc(fA.ag, fA.mql), perda: fA.mql - fA.ag, un: "MQL(s) sem agenda", acao: "MQL esfria rápido: contato direto oferecendo a vaga do Raio X." });
    if (fA.ag > 0) etapas.push({ rot: "Agendamento para confirmação", pct: pc(fA.conf, fA.ag), perda: fA.ag - fA.conf, un: "agendado(s) sem confirmação", acao: "rodar a confirmação por WhatsApp antes da sessão." });
    if (etapas.length){
      var pior = etapas.reduce(function(a, b){ return b.pct < a.pct ? b : a; });
      itens.push("<b>Gargalo do recorte: " + pior.rot + " (" + pior.pct + "%).</b> São " + pior.perda + " " + pior.un + " paradas nessa etapa. Próximo passo: " + pior.acao);
    }

    var notas = pessoas.filter(function(r){ return r.concluiu && r.score != null; });
    if (notas.length >= 3){
      var somaN = 0, nvl = { improviso: 0, construcao: 0, consistente: 0 };
      notas.forEach(function(r){ somaN += r.score; var nv = nivelDe(r.score); if (nv) nvl[nv]++; });
      var media = Math.round(somaN / notas.length);
      itens.push("<b>Qualidade do grupo: nota média " + media + ".</b> " + nvl.consistente + " em operação consistente, " + nvl.construcao + " em construção e " + nvl.improviso + " em improviso. " + (nvl.improviso > nvl.consistente ? "Grupo chega com muita dor exposta: conversa de fundamentos." : "Grupo maduro: conversa pode ir direto para alavancas de resultado."));
    }

    var donosMql = pessoas.filter(function(r){ return r.papel === "dono" && r.mql && r.email; });
    var gerMql = pessoas.filter(function(r){ return r.papel === "gerente" && r.mql && r.email; });
    if (donosMql.length >= 2 && gerMql.length >= 2){
      var pd = pc(donosMql.filter(function(r){ return r.agendou_raiox; }).length, donosMql.length);
      var pg = pc(gerMql.filter(function(r){ return r.agendou_raiox; }).length, gerMql.length);
      if (Math.abs(pd - pg) >= 20){
        var quem = pd < pg ? "Donos" : "Gerentes";
        itens.push("<b>Donos agendam a " + pd + "% e gerentes a " + pg + "%.</b> " + quem + " estão ficando para trás no agendamento: vale abordagem específica para esse perfil.");
      }
    }

    var resgMql = pessoas.filter(function(r){ return statusRow(r) === "sem_agendar" && r.mql && r.email; });
    var resgTel = pessoas.filter(function(r){ return statusRow(r) === "abandonou" && r.telefone && !convertidos[chave(r)]; });
    if (resgMql.length || resgTel.length){
      var partes = [];
      if (resgMql.length) partes.push(resgMql.length + " MQL sem agendar (" + nomesCurto(resgMql, 3) + ")");
      if (resgTel.length) partes.push(resgTel.length + " abandono(s) com telefone (" + nomesCurto(resgTel, 3) + ")");
      itens.push("<b>Fila de resgate: " + (resgMql.length + resgTel.length) + " pessoa(s).</b> " + partes.join(" e ") + ". Começar pelos MQLs, que já deixaram e-mail.");
    }

    var probs = [];
    var pend = fA.agLista.filter(function(r){ return !confirmouRow(r); });
    if (pend.length) probs.push(pend.length + " agendado(s) ainda sem confirmação (" + nomesCurto(pend, 3) + ")");
    var semPdf = pessoas.filter(function(r){ return r.concluiu && !r.pdf_comercial_url; });
    if (semPdf.length) probs.push(semPdf.length + " conclusão(ões) sem PDF gerado");
    var semContato = pessoas.filter(function(r){ return statusRow(r) === "abandonou" && !r.telefone && !r.email; });
    if (semContato.length) probs.push(semContato.length + " abandono(s) sem nenhum contato deixado");
    if (probs.length) itens.push("<b>Problemas do período:</b> " + probs.join("; ") + ".");

    if (fB && compW){
      var movs = [
        { rot: "sessões", a: fA.comecaram, b: fB.comecaram },
        { rot: "conclusões", a: fA.terminaram, b: fB.terminaram },
        { rot: "MQLs", a: fA.mql, b: fB.mql },
        { rot: "agendamentos", a: fA.ag, b: fB.ag },
        { rot: "confirmações", a: fA.conf, b: fB.conf }
      ].filter(function(m){ return m.b > 0; });
      if (movs.length){
        var txt = movs.map(function(m){
          var d = Math.round((m.a - m.b) / m.b * 100);
          return m.rot + " " + (d >= 0 ? "+" : "") + d + "% (" + m.b + " para " + m.a + ")";
        }).join("; ");
        itens.push("<b>Contra " + fmtBr(compW.de) + " a " + fmtBr(compW.ate) + ":</b> " + txt + ". Conversão ponta a ponta: " + pc(fB.ag, fB.comecaram) + "% antes, " + pc(fA.ag, fA.comecaram) + "% agora.");
      }
    }

    if (fA.ag > 0){
      var cliAg = fA.agLista.filter(function(r){ return r.conhece === "cliente"; });
      if (cliAg.length) itens.push("<b>" + cliAg.length + " de " + fA.ag + " que marcaram o Raio X já são clientes</b> (" + nomesCurto(cliAg, 4) + "). Conversa de expansão de uso, não venda fria.");
    }

    if (dList.length){
      var temas = dList.slice(0, 2).map(function(d){ return d[0].toLowerCase() + " (" + d[1] + ")"; }).join(" e ");
      itens.push("<b>Temas para abordar na próxima conversa:</b> " + temas + (pList.length ? ", cruzando com a frente " + pList[0][0] + " que é a mais fraca do grupo (média " + pList[0][1] + ")." : "."));
    }
    if (pList.length){
      var ini1 = "<b>Iniciativas sugeridas:</b> " + pList[0][0] + " pede " + (INICIATIVA[pList[0][2]] || "plano dedicado");
      if (pList.length > 1) ini1 += "; " + pList[1][0] + " pede " + (INICIATIVA[pList[1][2]] || "plano dedicado");
      itens.push(ini1 + ".");
    }

    return itens.slice(0, 10);
  }

  function render(){
    var rows = linhasJanela(state.de, state.ate);
    var fA = funilDe(rows);
    var compW = janelaComp();
    var fB = compW ? funilDe(linhasJanela(compW.de, compW.ate)) : null;
    var pessoas = fA.pessoas;

    var nAtivos = (state.q ? 1 : 0) + (state.papel !== "todos" ? 1 : 0) + (state.status !== "todos" ? 1 : 0) + (state.compDe || state.compAte ? 1 : 0);
    var fc = document.getElementById("fcount");
    fc.textContent = nAtivos;
    fc.classList.toggle("on", nAtivos > 0);

    var kpisEl = document.getElementById("kpis");
    var vals = [fA.comecaram, fA.terminaram, fA.mql, fA.ag, fA.conf, fA.cli];
    kpisEl.innerHTML =
      '<div class="kpi"><b>0</b><span>Começaram</span><span class="delta-l">' + kpiDelta(fA.comecaram, fB, "comecaram", "sessões no período") + '</span></div>' +
      '<div class="kpi"><b>0</b><span>Terminaram</span><span class="delta-l">' + kpiDelta(fA.terminaram, fB, "terminaram", pc(fA.terminaram, fA.comecaram) + "% das sessões") + '</span></div>' +
      '<div class="kpi"><b>0</b><span>Viraram MQL</span><span class="delta-l">' + kpiDelta(fA.mql, fB, "mql", pc(fA.mql, fA.terminaram) + "% de conversão") + '</span></div>' +
      '<div class="kpi"><b>0</b><span>Marcaram o Raio X</span><span class="delta-l">' + kpiDelta(fA.ag, fB, "ag", pc(fA.ag, fA.mql) + "% dos MQLs") + '</span></div>' +
      '<div class="kpi"><b>0</b><span>Confirmaram</span><span class="delta-l">' + kpiDelta(fA.conf, fB, "conf", pc(fA.conf, fA.ag) + "% dos agendados") + '</span></div>' +
      '<div class="kpi"><b>0</b><span>Já são clientes</span><span class="delta-l">' + kpiDelta(fA.cli, fB, "cli", "no período filtrado") + '</span></div>';
    var bs = kpisEl.querySelectorAll(".kpi b");
    for (var i = 0; i < bs.length; i++){
      contar(bs[i], kpiPrev[i] || 0, vals[i]);
    }
    kpiPrev = vals;

    var maxF = Math.max(fA.comecaram, fB ? fB.comecaram : 0, 1);
    function w(v){ return Math.round(v / maxF * 100); }
    var legenda = "";
    if (fB && compW){
      legenda = '<p class="f-legend"><span><span class="sw sw-a" aria-hidden="true"></span>Período atual</span><span><span class="sw sw-b" aria-hidden="true"></span>Comparação: ' + fmtBr(compW.de) + ' a ' + fmtBr(compW.ate) + '</span></p>';
    }
    function cv(campo){ return fB ? fB[campo] : null; }
    function cw(campo){ return fB ? w(fB[campo]) : 0; }
    var funEl = document.getElementById("funnel");
    funEl.innerHTML = legenda +
      bar("Começaram", "sessões abertas" + (fB ? deltaHtml(fA.comecaram, fB.comecaram) : ""), fA.comecaram, w(fA.comecaram), cv("comecaram"), cw("comecaram")) +
      bar("Terminaram", pc(fA.terminaram, fA.comecaram) + "% de conversão" + (fB ? deltaHtml(fA.terminaram, fB.terminaram) : ""), fA.terminaram, w(fA.terminaram), cv("terminaram"), cw("terminaram")) +
      bar("Viraram MQL", pc(fA.mql, fA.terminaram) + "% de conversão" + (fB ? deltaHtml(fA.mql, fB.mql) : ""), fA.mql, w(fA.mql), cv("mql"), cw("mql")) +
      bar("Marcaram o Raio X", pc(fA.ag, fA.mql) + "% de conversão" + (fB ? deltaHtml(fA.ag, fB.ag) : ""), fA.ag, w(fA.ag), cv("ag"), cw("ag")) +
      bar("Confirmaram presença", pc(fA.conf, fA.ag) + "% até agora" + (fB ? deltaHtml(fA.conf, fB.conf) : ""), fA.conf, w(fA.conf), cv("conf"), cw("conf")) +
      '<p class="f-total">Conversão ponta a ponta (começou e marcou o Raio X): <strong>' + pc(fA.ag, fA.comecaram) + '%</strong>' + (fB ? ' - no período de comparação foi ' + pc(fB.ag, fB.comecaram) + '%' : '') + '.</p>';
    anima(funEl);

    var lista = pessoas.slice();
    if (state.status !== "todos") lista = lista.filter(function(r){ return statusRow(r) === state.status; });
    lista.sort(function(a, b){
      var dir = state.sd === "asc" ? 1 : -1;
      if (state.sk === "nome"){
        var na = norm(a.nome), nb = norm(b.nome);
        if (na === nb) return a.created_at < b.created_at ? 1 : -1;
        return (na < nb ? -1 : 1) * dir;
      }
      if (state.sk === "nota"){
        var sa = a.score == null ? -1 : a.score, sb = b.score == null ? -1 : b.score;
        if (sa === sb) return a.created_at < b.created_at ? 1 : -1;
        return (sa - sb) * dir;
      }
      return (a.created_at < b.created_at ? -1 : 1) * dir;
    });
    document.getElementById("t-pessoas").textContent = "Pessoas (" + lista.length + ")";
    document.getElementById("d-nome").textContent = state.sk === "nome" ? (state.sd === "asc" ? "A-Z" : "Z-A") : "";
    document.getElementById("d-nota").textContent = state.sk === "nota" ? (state.sd === "asc" ? "menor" : "maior") : "";
    document.getElementById("d-inicio").textContent = state.sk === "inicio" ? (state.sd === "asc" ? "antigos" : "recentes") : "";
    document.querySelectorAll("th.sort").forEach(function(th){
      var k = th.getAttribute("data-k");
      th.setAttribute("aria-sort", state.sk === k ? (state.sd === "asc" ? "ascending" : "descending") : "none");
    });

    var convertidos = {};
    RAW.forEach(function(r){ if (r.concluiu) convertidos[chave(r)] = true; });
    var tb = document.getElementById("tb-pessoas");
    tb.innerHTML = lista.length ? lista.map(function(r, i){
      var st = statusRow(r);
      var nome = r.pdf_comercial_url
        ? '<a class="who" href="' + esc(r.pdf_comercial_url) + '" target="_blank" rel="noopener">' + esc(r.nome || "(sem nome)") + '</a>'
        : '<span class="who">' + esc(r.nome || "(sem nome)") + '</span>';
      var obs = "";
      if (st === "abandonou" && convertidos[chave(r)]) obs = '<span class="obs">Reabertura: já concluiu em outra sessão.</span>';
      else if (st === "sem_agendar" && r.mql && r.email) obs = '<span class="obs">MQL com e-mail. Prioridade de resgate.</span>';
      else if (r.concluiu && !r.pdf_comercial_url) obs = '<span class="obs">PDF não gerado.</span>';
      var f = foneInfo(r.telefone);
      var fone = f.link ? '<a href="' + f.link + '" target="_blank" rel="noopener">' + esc(f.texto) + '</a>' : esc(f.texto);
      // Coluna de respostas completas: botão que expande a linha de detalhe.
      // O estado aberto sobrevive ao re-render de 60s via respAbertos.
      var celResp = '<span class="obs">n/d</span>', detalhe = "";
      if (temRespostas(r)){
        var rid = "resp-" + i;
        var ck = respChave(r);
        var aberto = !!respAbertos[ck];
        celResp = '<button type="button" class="resp-btn" data-alvo="' + rid + '" data-ck="' + esc(ck) + '" aria-expanded="' + (aberto ? "true" : "false") + '">' + (aberto ? "Fechar" : "Ver") + '</button>';
        detalhe = '<tr class="rrow" id="' + rid + '"' + (aberto ? "" : " hidden") + '><td colspan="9">' + respostasHtml(r) + '</td></tr>';
      }
      return '<tr><td>' + nome + obs + '</td><td class="nowrap">' + fone + '</td><td>' + (PAPEL[r.papel] || "n/d") + '</td><td>' + chipConhece(r) + '</td><td class="num">' + (r.score == null ? "-" : r.score) + '</td><td>' + pontoFraco(r) + '</td><td>' + ST_CHIP[st] + '</td><td class="nowrap">' + fmtDia(r.created_at) + '</td><td>' + celResp + '</td></tr>' + detalhe;
    }).join("") : '<tr><td colspan="9" class="empty">Ninguém no filtro atual.</td></tr>';
    anima(tb);

    var dores = {}, abertas = 0;
    pessoas.forEach(function(r){
      if (!r.interesse) return;
      if (DOR[r.interesse]) dores[DOR[r.interesse]] = (dores[DOR[r.interesse]] || 0) + 1;
      else abertas++;
    });
    var dList = Object.keys(dores).map(function(k){ return [k, dores[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
    var dMax = dList.length ? dList[0][1] : 0;
    document.getElementById("dores").innerHTML = (dList.map(function(d){ return tbar(d[0], d[1], dMax); }).join("") || '<p class="empty">Sem respostas no filtro.</p>') + (abertas ? '<p style="font-size:12px;color:var(--muted);margin:12px 0 0">Mais ' + abertas + ' resposta(s) aberta(s) do perfil Outro.</p>' : "");

    var soma = {}, qtd = {};
    pessoas.forEach(function(r){
      if (!r.concluiu || !r.pontuacao_pilares) return;
      for (var k in PILAR){ if (typeof r.pontuacao_pilares[k] === "number"){ soma[k] = (soma[k]||0) + r.pontuacao_pilares[k]; qtd[k] = (qtd[k]||0) + 1; } }
    });
    var pList = Object.keys(PILAR).filter(function(k){ return qtd[k]; }).map(function(k){ return [PILAR[k], Math.round(soma[k]/qtd[k]), k]; }).sort(function(a,b){ return a[1]-b[1]; });
    document.getElementById("pilares").innerHTML = pList.map(function(p){ return tbar(p[0], p[1], 100); }).join("") || '<p class="empty">Sem diagnósticos concluídos no filtro.</p>';

    var insEl = document.getElementById("insights");
    var itens = analise(fA, fB, compW, convertidos, dList, pList);
    insEl.innerHTML = itens.length
      ? itens.map(function(i){ return "<li>" + i + "</li>"; }).join("")
      : '<li><b>Sem leitura para este recorte.</b> Amplie o período ou limpe os filtros.</li>';
    anima(insEl);

    document.getElementById("sub").textContent =
      (state.de || state.ate ? "Período: " + (state.de ? state.de.split("-").reverse().join("/") : "início") + " até " + (state.ate ? state.ate.split("-").reverse().join("/") : "hoje") : "Período: todo o histórico") +
      (compW ? " - comparando com " + fmtBr(compW.de) + " a " + fmtBr(compW.ate) : "") +
      (state.q ? ' - nome: "' + state.q + '"' : "") + " - horário de Brasília";

    gravarHash();
  }

  /* ------- filtros ------- */
  var btnF = document.getElementById("btn-filtros");
  btnF.addEventListener("click", function(){
    var p = document.getElementById("painel-filtros");
    var aberto = p.classList.toggle("aberto");
    btnF.setAttribute("aria-expanded", aberto ? "true" : "false");
    if (aberto) anima(p);
  });

  function hojeBRT(){ return new Date(Date.now() - BRT_MS); }
  function aplicarPreset(qual){
    if (qual === "semana"){
      var h = hojeBRT(); var dow = (h.getUTCDay() + 6) % 7;
      state.de = ymd(new Date(h.getTime() - dow*86400000)); state.ate = ymd(h);
    } else if (qual === "7"){
      var h2 = hojeBRT(); state.de = ymd(new Date(h2.getTime() - 6*86400000)); state.ate = ymd(h2);
    } else { state.de = ""; state.ate = ""; }
    deInput.value = state.de; ateInput.value = state.ate;
    document.querySelectorAll("[data-preset]").forEach(function(b){
      var ativo = b.getAttribute("data-preset") === qual;
      b.classList.toggle("active", ativo);
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
    render();
  }
  document.querySelectorAll("[data-preset]").forEach(function(b){
    b.addEventListener("click", function(){ aplicarPreset(b.getAttribute("data-preset")); });
  });
  deInput.addEventListener("change", function(){ state.de = deInput.value; desmarcaPresets(); render(); });
  ateInput.addEventListener("change", function(){ state.ate = ateInput.value; desmarcaPresets(); render(); });
  compDeInput.addEventListener("change", function(){ state.compDe = compDeInput.value; render(); });
  compAteInput.addEventListener("change", function(){ state.compAte = compAteInput.value; render(); });
  nomeInput.addEventListener("input", function(){ state.q = norm(nomeInput.value); render(); });
  function desmarcaPresets(){
    document.querySelectorAll("[data-preset]").forEach(function(b){ b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); });
  }

  function ligaSeg(id, campo){
    var seg = document.getElementById(id);
    seg.addEventListener("click", function(ev){
      var alvo = ev.target.closest("button"); if (!alvo) return;
      state[campo] = alvo.getAttribute("data-v");
      seg.querySelectorAll("button").forEach(function(b){
        var ativo = b === alvo;
        b.classList.toggle("active", ativo);
        b.setAttribute("aria-pressed", ativo ? "true" : "false");
      });
      render();
    });
  }
  ligaSeg("seg-papel", "papel");
  ligaSeg("seg-status", "status");

  document.getElementById("limpar").addEventListener("click", function(){
    state.q = ""; nomeInput.value = "";
    state.papel = "todos"; state.status = "todos";
    state.compDe = ""; state.compAte = "";
    compDeInput.value = ""; compAteInput.value = "";
    ["seg-papel","seg-status"].forEach(function(id){
      document.getElementById(id).querySelectorAll("button").forEach(function(b){
        var ativo = b.getAttribute("data-v") === "todos";
        b.classList.toggle("active", ativo);
        b.setAttribute("aria-pressed", ativo ? "true" : "false");
      });
    });
    aplicarPreset("tudo");
  });

  document.querySelectorAll("th.sort").forEach(function(th){
    th.addEventListener("click", function(){
      var k = th.getAttribute("data-k");
      if (state.sk === k) state.sd = state.sd === "asc" ? "desc" : "asc";
      else { state.sk = k; state.sd = k === "nome" ? "asc" : "desc"; }
      render();
    });
  });

  // Abre/fecha as respostas completas (delegado: o tbody sobrevive aos re-renders).
  document.getElementById("tb-pessoas").addEventListener("click", function(ev){
    var b = ev.target.closest(".resp-btn"); if (!b) return;
    var alvo = document.getElementById(b.getAttribute("data-alvo")); if (!alvo) return;
    var abre = alvo.hasAttribute("hidden");
    if (abre) alvo.removeAttribute("hidden"); else alvo.setAttribute("hidden", "");
    b.setAttribute("aria-expanded", abre ? "true" : "false");
    b.textContent = abre ? "Fechar" : "Ver";
    var ck = b.getAttribute("data-ck");
    if (abre) respAbertos[ck] = true; else delete respAbertos[ck];
  });

  /* ------- atualização ao vivo, sem recarregar ------- */
  function stampAgora(){
    var ag = new Date(Date.now() - BRT_MS);
    var p = function(n){ return (n<10?"0":"")+n; };
    document.getElementById("stamp").textContent = "dados de " + p(ag.getUTCHours()) + ":" + p(ag.getUTCMinutes()) + " (Brasília)";
  }
  var maxCriado = RAW.length ? RAW[0].created_at : "";
  var timerBadge = null;
  function buscar(){
    fetch(location.pathname + "?key=" + encodeURIComponent(KEY) + "&format=json", { cache: "no-store" })
      .then(function(r){ if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function(dados){
        var novos = dados.filter(function(r){ return maxCriado && r.created_at > maxCriado; }).length;
        if (dados.length) maxCriado = dados[0].created_at;
        RAW = dados;
        stampAgora(); render();
        if (novos > 0){
          var badge = document.getElementById("novos");
          badge.textContent = "+" + novos + (novos === 1 ? " novo" : " novos");
          badge.style.display = "inline-block";
          if (timerBadge) clearTimeout(timerBadge);
          timerBadge = setTimeout(function(){ badge.style.display = "none"; }, 30000);
        }
      })
      .catch(function(){ /* rede oscilou: tenta no próximo ciclo */ });
  }
  setInterval(buscar, 60000);
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) buscar(); });

  stampAgora();
  if (lerHash()){ render(); } else { aplicarPreset("semana"); }
})();
</script>
</body>
</html>`;
