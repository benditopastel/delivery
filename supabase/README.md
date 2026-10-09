# Supabase (opcional)

1. Crie um projeto Supabase (login GitHub é apenas o login da sua conta).
2. Execute `schema.sql` em **SQL Editor**.
3. Em **Project Settings > API**, obtenha Project URL e a **service_role** secret key.
4. Configure as variáveis de ambiente **somente no servidor**:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Antes de mudar o backend, faça backup do Excel. Na raiz do projeto execute
   `python -m supabase.migrate_excel` na raiz do projeto.
6. Ative `STORAGE_BACKEND=supabase` e reinicie.

**Importante:** GitHub Pages hospeda somente frontend estático; este projeto tem
FastAPI e precisa de um host de backend (Render, Railway, VPS etc.). Não inclua
chaves privadas no repositório. O adaptador JSONB é para migração e testes,
não é esquema de produção com transações de pontos/estoque. Ainda faltam
login, verificação por telefone, RLS por loja e transações atômicas.
