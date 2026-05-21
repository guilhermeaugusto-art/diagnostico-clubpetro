# Diagnóstico de Saúde do Posto · ClubPetro

Quiz de diagnóstico (página única HTML) que mostra a saúde da operação de um
posto numa nota de 0 a 100, captura leads e grava as respostas no Supabase.

## Stack

- **Front-end:** HTML/CSS/JS puro, página única (`public/index.html`)
- **Banco de dados:** Supabase (PostgreSQL) — tabela `diagnostico_respostas`
- **Hospedagem:** Firebase Hosting

## Como funciona

1. O visitante responde 9 perguntas (6 pontuadas + 3 de qualificação).
2. A página calcula uma nota de 0 a 100 e mostra o nível da operação.
3. As respostas são gravadas no Supabase via `INSERT` anônimo (RLS ligado:
   só `INSERT`, sem `SELECT` público — os leads não são legíveis pelo navegador).
4. O CTA final abre o WhatsApp com um resumo do diagnóstico.

## Configuração

As credenciais ficam no objeto `CONFIG` no topo do `<script>` em
`public/index.html`:

| Chave | Descrição |
|---|---|
| `CLUBPETRO_WHATSAPP` | Número de WhatsApp (só dígitos: DDI+DDD+número) |
| `SUPABASE_URL` | URL base do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave `anon`/`public` (pode ser pública; nunca usar a `service_role`) |

## Deploy

```bash
firebase deploy --only hosting
```

## Desenvolvimento local

Basta abrir `public/index.html` no navegador.
