# GitHub, Vercel e Supabase

Este projeto esta preparado como uma aplicacao Vite + React + TypeScript.

## Git

O repositorio deve versionar o codigo-fonte e ignorar dependencias, builds e variaveis de ambiente.

Arquivos e pastas ignorados:

- `node_modules/`
- `dist/`
- `.vercel/`
- `.env`
- `.env.local`
- `.env.*.local`
- `.next/`
- `*.tsbuildinfo`

## Comandos para enviar ao GitHub

Substitua `<URL_DO_REPOSITORIO>` pela URL criada no GitHub.

```bash
git add .
git commit -m "Prepare Vite app for GitHub Vercel and Supabase"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Vercel

Configuracao correta do projeto:

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

O arquivo `vercel.json` ja define essa configuracao.

## Supabase

Variaveis de ambiente necessarias na Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

O client Supabase existe em:

- `src/lib/supabase/client.ts`

As telas ainda nao usam Supabase. O `localStorage` continua sendo a fonte ativa de dados.

## Ordem segura de migracao

1. Manter o app atual rodando com `localStorage`.
2. Aplicar as migrations Supabase.
3. Criar services separados para leitura/escrita no Supabase.
4. Migrar primeiro Perfil e Clientes.
5. Validar fallback para `localStorage`.
6. Migrar modulos operacionais aos poucos.
7. Migrar Dashboard somente depois dos dados principais estarem estaveis.
