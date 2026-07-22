import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEETING_CODE = "ado-rhwa-kvx";
const CUTOFF_DEFAULT = "2026-06-23T00:00:00Z";
const MIN_SEGUNDOS = 60;

// Contas internas ClubPetro no Meet (nao sao leads)
const INTERNOS_ID = new Set([
  "104728690399652821553", // Marketing ClubPetro
  "105978899571642399077", // Guilherme Augusto
  "101001357730391988081", // Gabriel Premoli
]);
const INTERNOS_NOME = ["marketing clubpetro", "guilherme augusto", "gabriel premoli"];
const STOP = new Set(["posto","postos","auto","ltda","me","epp","eireli","conveniencia","comercio","combustiveis","distribuidora","servicos","and","the","cia"]);

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function toks(s: string) {
  return norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}
// Identidade da PESSOA (nao da linha): cadastros duplicados (mesmo telefone/email)
// nao podem contar como 2 candidatos — era isso que mandava Ivan/Ademar pro revisar.
function pessoaChave(L: any) {
  const em = norm(L.email || "").trim();
  if (em) return "e:" + em;
  const tel = (L.telefone || "").toString().replace(/\D/g, "");
  if (tel.length >= 8) return "t:" + tel.slice(-8);
  return "n:" + norm(L.nome || "").trim();
}

async function getCreds() {
  const { data, error } = await supabase.from("integration_secrets").select("key,value")
    .in("key", ["google_client_id", "google_client_secret", "meet_refresh_token"]);
  if (error) throw new Error("secrets: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  return m;
}
async function getAccessToken(m: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: m.google_client_id, client_secret: m.google_client_secret, refresh_token: m.meet_refresh_token, grant_type: "refresh_token" }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error("token: " + JSON.stringify(d));
  return d.access_token as string;
}
async function meet(path: string, token: string) {
  const res = await fetch("https://meet.googleapis.com/v2/" + path, { headers: { Authorization: "Bearer " + token } });
  const d = await res.json();
  if (!res.ok) throw new Error("meet " + path + ": " + JSON.stringify(d));
  return d;
}
// (envio RD removido em 22/07: o UPDATE de participou_raiox ja dispara a
// esteira via trigger, que envia fez-raiox-posto com payload completo e retry
// pelo sweep — o envio daqui era o segundo remetente da corrida dupla
// comprovada em 08/07, 14/07 e 21/07)

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry") === "1";
    const cutoff = url.searchParams.get("desde") || CUTOFF_DEFAULT;

    const creds = await getCreds();
    const token = await getAccessToken(creds);

    const space = await meet("spaces/" + MEETING_CODE, token);
    let recs: any[] = [];
    let pageToken: string | undefined;
    do {
      const q = new URLSearchParams({ filter: `space.name=\"${space.name}\"`, pageSize: "100" });
      if (pageToken) q.set("pageToken", pageToken);
      const d = await meet("conferenceRecords?" + q.toString(), token);
      recs = recs.concat(d.conferenceRecords || []);
      pageToken = d.nextPageToken;
    } while (pageToken);
    recs = recs.filter((r) => (r.startTime || "") >= cutoff);

    // sess = segundos POR conferenceRecord (chave = startTime da sessao): alimenta
    // raiox_participacoes, que e o que permite ao BI contar presenca por semana.
    const pessoas = new Map<string, { chave: string; displayName: string; segundos: number; ultima: string; interno: boolean; sess: Record<string, number> }>();
    for (const rec of recs) {
      const recId = rec.name.split("/")[1];
      let pt: string | undefined;
      do {
        const q = new URLSearchParams({ pageSize: "100" });
        if (pt) q.set("pageToken", pt);
        const d = await meet("conferenceRecords/" + recId + "/participants?" + q.toString(), token);
        for (const p of d.participants || []) {
          const su = p.signedinUser, au = p.anonymousUser, ph = p.phoneUser;
          const uid = su ? su.user.split("/")[1] : null;
          // "|| ?": displayName ausente nao pode virar undefined (viola o NOT NULL
          // de raiox_participacoes.meet_nome e derrubaria o lote inteiro do upsert)
          const dn = (su ? su.displayName : au ? au.displayName : ph ? ph.displayName : null) || "?";
          const seg = p.earliestStartTime && p.latestEndTime
            ? Math.max(0, (new Date(p.latestEndTime).getTime() - new Date(p.earliestStartTime).getTime()) / 1000) : 0;
          const interno = (uid && INTERNOS_ID.has(uid)) || INTERNOS_NOME.includes(norm(dn).trim());
          const key = uid ? "u:" + uid : "n:" + norm(dn).trim();
          const cur = pessoas.get(key);
          if (!cur) {
            pessoas.set(key, { chave: key, displayName: dn, segundos: seg, ultima: p.latestEndTime || rec.endTime, interno, sess: { [rec.startTime]: seg } });
          } else {
            cur.segundos += seg;
            cur.sess[rec.startTime] = (cur.sess[rec.startTime] || 0) + seg;
            // cur.ultima pode ter congelado undefined (conferencia ao vivo sem
            // endTime): sem o !cur.ultima, nunca mais seria preenchida
            if (p.latestEndTime && (!cur.ultima || p.latestEndTime > cur.ultima)) cur.ultima = p.latestEndTime;
          }
        }
        pt = d.nextPageToken;
      } while (pt);
    }

    // Fichas duplicadas (duplicado_de preenchido) ficam fora do match
    const { data: leads } = await supabase.from("diagnostico_respostas")
      .select("id,nome,email,telefone,concluiu,rd_participou_enviado,participou_raiox,ultima_participacao_raiox")
      .not("nome", "is", null)
      .is("duplicado_de", null);
    const leadById = new Map<string, any>((leads || []).map((L: any) => [L.id, L]));

    // Fichas que viraram duplicata: conciliacao antiga pode apontar para elas;
    // sem resolver a corrente ate a canonica o nivel 4 morre para sempre
    // (leadById so tem canonicas) e a presenca fica atribuida a ficha morta.
    const { data: dups } = await supabase.from("diagnostico_respostas")
      .select("id,duplicado_de").not("duplicado_de", "is", null);
    const dupPara = new Map<string, string>((dups || []).map((d: any) => [d.id, d.duplicado_de]));
    const resolveCanonica = (id: string): string => {
      let c = id;
      for (let i = 0; i < 5 && dupPara.has(c); i++) c = dupPara.get(c)!;
      return c;
    };

    // Conciliacoes: nome do Meet (normalizado) -> ficha. O sync grava as suas
    // ('auto') e humanos gravam as dificeis ('manual'). Duplo uso:
    //  (a) match direto e estavel entre rodadas;
    //  (b) desempate — ficha conciliada MANUALMENTE com outro nome sai da
    //      disputa. So a manual exclui: a mesma pessoa pode entrar no Meet com
    //      display diferente entre semanas, e uma conc 'auto' do nome antigo
    //      excluiria a ficha CERTA e casaria o nome novo com outra pessoa.
    const { data: concs } = await supabase.from("raiox_conciliacoes").select("meet_nome_norm,resposta_id,origem");
    const concPorNome = new Map<string, string>();
    const nomesPorResposta = new Map<string, Set<string>>();
    const concsRepontar: { nome: string; para: string }[] = [];
    for (const c of concs || []) {
      const rid = resolveCanonica(c.resposta_id);
      if (rid !== c.resposta_id) concsRepontar.push({ nome: c.meet_nome_norm, para: rid });
      concPorNome.set(c.meet_nome_norm, rid);
      if (c.origem === "manual") {
        if (!nomesPorResposta.has(rid)) nomesPorResposta.set(rid, new Set());
        nomesPorResposta.get(rid)!.add(c.meet_nome_norm);
      }
    }
    const novasConcs: { meet_nome_norm: string; resposta_id: string; origem: string }[] = [];

    const marcados: any[] = [], revisar: any[] = [], internos: any[] = [];
    // participacao por sessao de TODO externo (mesmo sem match): vira historico
    // em raiox_participacoes; resposta_id preenchido quando ha ficha conciliada
    const partRows: any[] = [];
    const agoraIso = new Date().toISOString();
    const registraParticipacoes = (pes: any, respostaId: string | null) => {
      for (const [ini, seg] of Object.entries(pes.sess)) {
        const s = Math.round(Number(seg));
        if (!(s > 0)) continue;
        partRows.push({
          meet_chave: pes.chave, sessao_inicio: ini, meet_nome: pes.displayName,
          segundos: s, resposta_id: respostaId, atualizado_em: agoraIso,
        });
      }
    };

    for (const pes of pessoas.values()) {
      const min = Math.round(pes.segundos / 60);
      if (pes.interno) { internos.push({ nome: pes.displayName, min }); continue; }
      const nomeNorm = norm(pes.displayName).trim();
      if (pes.segundos < MIN_SEGUNDOS) {
        // abaixo do minimo nao marca ficha, mas o historico por sessao fica
        registraParticipacoes(pes, concPorNome.get(nomeNorm) ?? null);
        continue;
      }

      const dnT = toks(pes.displayName);
      // Match em NIVEIS de confianca — empate so trava se for no mesmo nivel:
      //   3 = nome completo (primeiro nome + sobrenome batem no nome do Meet)
      //   2 = primeiro nome bate
      //   1 = so o email contem um token do nome do Meet
      // Sem isso, "Bianca Salim" (lead "Bianca", nivel 2) empatava com o lead
      // do Ozinaldo so porque o email dele contem "bianca" (nivel 1) — e a
      // pessoa ficava no revisar para sempre.
      // Token casa exato OU por prefixo com no maximo 1 letra de diferenca
      // (lado curto com 5+): cobre grafia truncada tipo "Jonhso" vs "jonhson"
      // SEM colar radicais de nomes distintos (Claudia vs Claudiana tem 2
      // letras de diferenca e continua separado).
      const casa = (a: string, b: string) =>
        a === b ||
        (Math.abs(a.length - b.length) <= 1 &&
          Math.min(a.length, b.length) >= 5 &&
          (a.startsWith(b) || b.startsWith(a)));
      const nivelLinha = (L: any): number => {
        const nT = toks(L.nome || "");
        const first = nT[0] || "";
        const primeiroBate = first.length >= 3 && dnT.some((d) => casa(d, first));
        if (primeiroBate) {
          const acertos = nT.filter((t) => dnT.some((d) => casa(d, t))).length;
          return acertos >= 2 ? 3 : 2;
        }
        const em = norm(L.email || "");
        for (const t of dnT) if (t.length >= 4 && em.includes(t)) return 1;
        return 0;
      };

      // Candidatos agrupados por PESSOA (email/telefone), nao por linha — e dentro
      // de cada pessoa preferimos a linha mais completa (concluiu > email).
      const porPessoa = new Map<string, { linhas: any[]; nivel: number }>();
      for (const L of (leads || [])) {
        const nv = nivelLinha(L);
        if (!nv) continue;
        const k = pessoaChave(L);
        const g = porPessoa.get(k) ?? { linhas: [], nivel: 0 };
        g.linhas.push(L);
        g.nivel = Math.max(g.nivel, nv);
        porPessoa.set(k, g);
      }
      const topo = Math.max(0, ...[...porPessoa.values()].map((g) => g.nivel));
      let finalistas = [...porPessoa.values()].filter((g) => g.nivel === topo);
      let nivelFinal = topo;

      // Conciliacao existente vence tudo (nivel 4): match direto e estavel.
      const concId = concPorNome.get(nomeNorm);
      if (concId && leadById.has(concId)) {
        finalistas = [{ linhas: [leadById.get(concId)], nivel: 4 }];
        nivelFinal = 4;
      } else if (finalistas.length > 1) {
        // Desempate: ficha ja conciliada com OUTRO nome do Meet sai da disputa.
        const livres = finalistas.filter((g) =>
          g.linhas.some((L: any) => {
            const donos = nomesPorResposta.get(L.id);
            return !donos || donos.has(nomeNorm);
          })
        );
        if (livres.length === 1) finalistas = livres;
      }

      if (finalistas.length === 1) {
        const linhas = finalistas[0].linhas;
        linhas.sort((a: any, b: any) =>
          (b.concluiu === true ? 4 : 0) + ((b.email || "").includes("@") ? 2 : 0)
          - (a.concluiu === true ? 4 : 0) - ((a.email || "").includes("@") ? 2 : 0));
        const candInfo = linhas[0];
        registraParticipacoes(pes, candInfo.id);
        if (nivelFinal !== 4) {
          novasConcs.push({ meet_nome_norm: nomeNorm, resposta_id: candInfo.id, origem: "auto" });
        }
        if (!dryRun) {
          // UPDATE condicional: so grava quando ha novidade (nao re-dispara os
          // triggers da tabela todo dia para o mesmo participante). E o proprio
          // UPDATE que aciona a esteira (trigger em participou_raiox), que
          // cuida do RD fez-raiox e do Kommo — daqui nao sai mais envio RD.
          const jaMarcado = candInfo.participou_raiox === true;
          // comparar INSTANTES: o Meet manda '...Z' e o PostgREST '...+00:00';
          // como string, 'Z' > '+' e o mesmo instante contava como "mais recente"
          const ultimaMs = candInfo.ultima_participacao_raiox ? Date.parse(candInfo.ultima_participacao_raiox) : NaN;
          const novaMs = pes.ultima ? Date.parse(pes.ultima) : NaN;
          const maisRecente = Number.isFinite(novaMs) && (!Number.isFinite(ultimaMs) || novaMs > ultimaMs);
          if (!jaMarcado || maisRecente) {
            await supabase.from("diagnostico_respostas").update({
              participou_raiox: true,
              ultima_participacao_raiox: pes.ultima,
              raiox_observacao: `Presenca Meet: ${min} min (${(pes.ultima || "").slice(0, 10)})`,
            }).eq("id", candInfo.id);
          }
        }
        marcados.push({ meet: pes.displayName, min, lead: candInfo.nome, email: candInfo.email, nivel: nivelFinal, rd_enviado: candInfo.rd_participou_enviado === true });
      } else {
        registraParticipacoes(pes, null);
        revisar.push({ meet: pes.displayName, min, candidatos: porPessoa.size, empate_no_nivel: finalistas.length > 1 ? topo : 0 });
      }
    }

    const relatorio = {
      dry_run: dryRun, desde: cutoff, sessoes: recs.length,
      total_no_meet: pessoas.size, participacoes: partRows.length,
      conciliacoes_novas: novasConcs.length, marcados, revisar, internos,
    };

    // Persistir historico por sessao + conciliacoes + relatorio (o pg_net
    // descarta a resposta HTTP do cron; sem isso a lista "revisar" some sem
    // ninguem ver). Erros de gravacao entram no relatorio: um lote que falha
    // em silencio deixaria o BI sem as sessoes da rodada.
    if (!dryRun) {
      const errosGravacao: string[] = [];
      // conciliacao que apontava para ficha que virou duplicata: repontar para a canonica
      for (const rp of concsRepontar) {
        const { error } = await supabase.from("raiox_conciliacoes")
          .update({ resposta_id: rp.para }).eq("meet_nome_norm", rp.nome);
        if (error) errosGravacao.push("repontar " + rp.nome + ": " + error.message);
      }
      if (novasConcs.length) {
        // ignoreDuplicates: conciliacao manual nunca e sobrescrita pela 'auto'
        const { error } = await supabase.from("raiox_conciliacoes")
          .upsert(novasConcs, { onConflict: "meet_nome_norm", ignoreDuplicates: true });
        if (error) errosGravacao.push("conciliacoes: " + error.message);
      }
      for (let i = 0; i < partRows.length; i += 500) {
        const { error } = await supabase.from("raiox_participacoes")
          .upsert(partRows.slice(i, i + 500), { onConflict: "meet_chave,sessao_inicio" });
        if (error) errosGravacao.push("participacoes lote " + i + ": " + error.message);
      }
      if (errosGravacao.length) (relatorio as any).erros_gravacao = errosGravacao;
      await supabase.from("raiox_presenca_log").insert({ relatorio });
    }

    return new Response(JSON.stringify(relatorio, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
