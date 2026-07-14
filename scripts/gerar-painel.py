# -*- coding: utf-8 -*-
# Gera public/painel/index.html a partir do fonte da Edge Function
# supabase/functions/relatorio-diagnostico/index.ts.
#
# Por que existe: o Supabase rebaixa text/html para text/plain no dominio de
# funcoes (anti-phishing), entao a pagina oficial do painel e servida pelo
# Firebase Hosting. Este script extrai o HTML/JS da funcao e aplica os ajustes
# de hospedagem externa:
#   1. dados via fetch na funcao (format=json), nao mais embutidos;
#   2. FALLBACK automatico: se a funcao falhar, busca direto do banco pela
#      RPC public.relatorio_diagnostico_dados (migration
#      20260714120000_rpc_relatorio_diagnostico_dados.sql), mesma chave;
#   3. aviso quando a URL vem sem ?key=.
#
# Uso: python scripts/gerar-painel.py  (depois: npm run deploy)
import re
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, 'supabase', 'functions', 'relatorio-diagnostico', 'index.ts')
OUT = os.path.join(RAIZ, 'public', 'painel', 'index.html')

SUPABASE_URL = 'https://azmtxhjtqodtaeoshrye.supabase.co'
# Chave anon (publica por design; e a mesma que vai no bundle do app).
ANON = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bXR4aGp0'
        'cW9kdGFlb3NocnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI4NTM1ODUsImV4cCI6MjAyODQyOTU4'
        'NX0.KvQovDvmATwBPc50oqnY_yJqjqoywZdSXm_bz5qn4V0')

src = open(SRC, encoding='utf-8').read()

def extrai(nome):
    m = re.search(r'const ' + nome + r' = `(.*?)`;', src, re.S)
    assert m, nome + ' nao encontrado no index.ts'
    return m.group(1)

def unescape(s):
    assert '${' not in s, 'template interpolation inesperada'
    return s.replace('\\\\', '\\')

top = unescape(extrai('PAGE_TOP'))
bottom = unescape(extrai('PAGE_BOTTOM'))
html = top + '[]' + bottom  # dados iniciais vazios; o fetch preenche

# 1) Constantes das duas rotas de dados, logo apos KEY.
antes = 'var KEY = new URLSearchParams(location.search).get("key") || "";'
depois = (antes
          + '\n  var FN = "' + SUPABASE_URL + '/functions/v1/relatorio-diagnostico";'
          + '\n  var RPC = "' + SUPABASE_URL + '/rest/v1/rpc/relatorio_diagnostico_dados";'
          + '\n  var ANON = "' + ANON + '";')
assert antes in html
html = html.replace(antes, depois)

# 2) buscar() com fallback: funcao -> RPC no banco.
antes = ('fetch(location.pathname + "?key=" + encodeURIComponent(KEY) + "&format=json", { cache: "no-store" })\n'
         '      .then(function(r){ if (!r.ok) throw new Error("http " + r.status); return r.json(); })\n'
         '      .then(function(dados){')
depois = ('buscarFuncao().catch(function(){ return buscarBanco(); })\n'
          '      .then(function(dados){')
assert antes in html
html = html.replace(antes, depois)

antes = '  var maxCriado = RAW.length ? RAW[0].created_at : "";'
helpers = (
    '  function buscarFuncao(){\n'
    '    return fetch(FN + "?key=" + encodeURIComponent(KEY) + "&format=json", { cache: "no-store" })\n'
    '      .then(function(r){ if (!r.ok) throw new Error("http " + r.status); return r.json(); });\n'
    '  }\n'
    '  // Rota reserva: RPC direto no banco (PostgREST). Se a Edge Function\n'
    '  // cair, o painel segue vivo por aqui, sem ninguem precisar mexer.\n'
    '  function buscarBanco(){\n'
    '    return fetch(RPC, { method: "POST", cache: "no-store",\n'
    '      headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },\n'
    '      body: JSON.stringify({ chave: KEY }) })\n'
    '      .then(function(r){ if (!r.ok) throw new Error("http " + r.status); return r.json(); })\n'
    '      .then(function(d){ if (!d) throw new Error("chave invalida"); return d; });\n'
    '  }\n')
assert antes in html
html = html.replace(antes, helpers + antes)

# 3) Boot: dispara a primeira busca imediatamente.
antes = '  stampAgora();\n  if (lerHash()){ render(); } else { aplicarPreset("semana"); }'
assert antes in html
html = html.replace(antes, antes + '\n  buscar();')

# 4) Sem chave na URL: avisa em vez de ficar "Carregando".
antes = '<p class="sub" id="sub">Carregando</p>'
aviso = ('<script>if(!new URLSearchParams(location.search).get("key")){'
         'document.addEventListener("DOMContentLoaded",function(){'
         'document.getElementById("sub").textContent='
         '"Falta a chave de acesso na URL (?key=...). Peça o link completo ao time.";});}</'
         'script>')
assert antes in html
html = html.replace(antes, antes + '\n    ' + aviso)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8', newline='\n').write(html)
print('gerado:', OUT, '-', len(html), 'chars')
assert 'buscarBanco' in html and 'var FN =' in html and 'var RPC =' in html
print('ok: fallback presente')
