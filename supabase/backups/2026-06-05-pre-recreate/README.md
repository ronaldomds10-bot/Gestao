# Backup Status

Backup completo: nao.

Este diretorio contem um backup parcial antes de recriar o banco:

- estrutura das tabelas solicitadas
- resumo das policies RLS
- resumo dos triggers
- contagem de linhas por tabela
- CSV exportado de `profiles`

A exportacao completa dos dados nao foi salva porque a resposta de dados completa do Supabase MCP foi truncada pela interface durante a coleta.

Nao apagar/recriar o banco ainda sem um dump completo dos dados.
