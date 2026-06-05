# Supabase Migration Plan

Este arquivo documenta a estrutura criada para uma migracao futura do RM Milhas para Supabase.

Importante: nesta etapa nenhuma tela foi conectada ao Supabase, o `localStorage` continua sendo a fonte de dados ativa e nenhuma funcionalidade existente foi substituida.

## Arquivos criados

- `supabase/migrations/003_appdata_compatible_schema.sql`
- `src/lib/supabase/client.ts`
- `src/services/supabaseTypes.ts`

## Tabelas criadas

### `profiles`

Perfil do usuario autenticado no Supabase.

Campos principais:

- `id`
- `user_id`
- `name`
- `email`
- `phone`
- `created_at`
- `updated_at`

### `clients`

Representa os clientes gerenciados dentro do app atual. Equivale ao item raiz de `AppData`.

Campos principais:

- `id`
- `user_id`
- `name`
- `email`
- `phone`
- `joined_at`
- `plan`
- `created_at`
- `updated_at`

### `credit_cards`

Equivale a `cards` no `AppData`.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `bank`
- `card_name`
- `limit_value`
- `points_balance`
- `points_per_dollar`
- `due_day`
- `created_at`
- `updated_at`

### `points_programs`

Equivale a `pointsPrograms` no `AppData`.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `type`
- `program_name`
- `balance`
- `cpm`
- `expiration_date`
- `created_at`
- `updated_at`

### `miles_programs`

Equivale a `milesPrograms` no `AppData`.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `airline`
- `balance`
- `cpm`
- `bonus_percentage`
- `expiration_date`
- `created_at`
- `updated_at`

### `bonus_transfers`

Equivale a `transfers` no `AppData`.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `origin_program_id`
- `destination_program_id`
- `origin_program_name`
- `destination_program_name`
- `sent_amount`
- `bonus_percentage`
- `transfer_date`
- `created_at`
- `updated_at`

### `flight_redemptions`

Equivale a `redemptions` no `AppData`.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `redemption_date`
- `origin`
- `destination`
- `airline`
- `regular_price`
- `paid_price`
- `miles_used`
- `cpm`
- `airport_fee`
- `created_at`
- `updated_at`

### `goals`

Equivale a `goals` no `AppData`.

Campos principais:

- `id`
- `user_id`
- `client_id`
- `title`
- `destination`
- `required_miles`
- `deadline`
- `created_at`
- `updated_at`

## Segurança

Todas as tabelas novas possuem Row Level Security habilitado.

Para cada tabela foram criadas policies separadas para:

- `SELECT`: apenas registros com `user_id = auth.uid()`
- `INSERT`: apenas registros com `user_id = auth.uid()`
- `UPDATE`: apenas registros com `user_id = auth.uid()`
- `DELETE`: apenas registros com `user_id = auth.uid()`

## Variaveis de ambiente

O client Supabase para Vite espera:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Essas variaveis ainda nao foram conectadas a nenhuma tela.

## Proximos passos recomendados

1. Criar um fluxo de autenticacao Supabase sem remover o estado atual.
2. Criar services de leitura/escrita por tabela.
3. Criar uma funcao de migracao de `localStorage` para Supabase.
4. Migrar primeiro `profiles` e `clients`.
5. Migrar `credit_cards`, pois e o modulo mais isolado.
6. Migrar `points_programs` e `miles_programs`.
7. Migrar `bonus_transfers`, validando se o saldo continua derivado corretamente.
8. Migrar `flight_redemptions`, mantendo compatibilidade com `cpm` e `airport_fee`.
9. Migrar `goals`.
10. Somente depois trocar a fonte principal de dados de `localStorage` para Supabase.

## Modulos que devem ser migrados primeiro

Ordem sugerida:

1. Perfil e clientes
2. Cartoes
3. Programas bancarios e companhias aereas
4. Transferencias bonificadas
5. Emissoes
6. Metas
7. Dashboard e graficos

## Observacoes importantes

- O app atual calcula saldos de pontos e milhas a partir de registros base mais transferencias.
- A tabela `bonus_transfers` guarda nomes e ids opcionais dos programas para facilitar compatibilidade durante a transicao.
- O `localStorage` deve permanecer ativo ate a migracao ser validada.
- Nenhuma tela deve depender diretamente das tabelas ate os services estarem prontos.
