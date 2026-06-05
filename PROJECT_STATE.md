# PROJECT STATE - Gestao Milhas

## Visao Geral

Projeto principal em Vite + React + TypeScript para gestao de milhas, pontos, cartoes, emissoes, economias e metas de viagem.

## App Principal

- `src/App.tsx`: aplicacao principal, componentes, estado local e regras atuais.
- `src/main.tsx`: entrada React.
- `src/styles.css`: estilos globais Tailwind.
- `index.html`: template HTML do Vite.
- `vite.config.ts`: configuracao Vite.

## Deploy

O deploy correto e Vite.

- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Arquivo de configuracao:

- `vercel.json`

## GitHub

Repositorio Git preparado para GitHub.

Arquivos de build, dependencias e variaveis de ambiente devem permanecer fora do versionamento:

- `node_modules/`
- `dist/`
- `.vercel/`
- `.env`
- `.env.local`
- `.env.*.local`

Guia operacional:

- `GITHUB_VERCEL_SUPABASE_SETUP.md`

## Persistencia Atual

O sistema em producao local ainda usa `localStorage`.

Chaves atuais:

- `rm-miles-hub-clients`
- `rm-miles-hub-data` para migracao legada

## Supabase

Supabase esta preparado apenas para migracao futura.

Arquivos existentes:

- `src/lib/supabase/client.ts`
- `src/services/supabaseTypes.ts`
- `supabase/migrations/`
- `SUPABASE_MIGRATION_PLAN.md`

Nenhuma tela foi conectada ao Supabase ainda.

## Observacao

A estrutura antiga de rotas server-side foi removida/neutralizada para evitar deteccao incorreta na Vercel. O app ativo e Vite.
