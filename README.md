# MenuFlow – GitHub Pages + Supabase (projeto "cardapio", região São Paulo)

Catálogo público sem login. `admin.html` e `orders.html` exigem Supabase Auth (e-mail + senha) e a lista `mf_admins`.
O navegador só tem a chave **publicável**; a `service_role` fica apenas dentro da Edge Function.

## Colocar no ar (projeto novo)

1. **SQL Editor** → cole e execute `supabase/schema.sql` (tabelas, índices, função de checkout, bucket de imagens).
2. **Authentication → Users** → crie seu usuário (e-mail + senha forte). Copie o UUID dele e execute:
   `insert into public.mf_admins(user_id) values ('SEU-UUID');`
3. Publique a função (na pasta do projeto):
   ```
   supabase login
   supabase link --project-ref dedbrpfewhcpfjxkgmaq
   supabase functions deploy menuflow --no-verify-jwt
   ```
   Refaça este passo sempre que atualizar `supabase/functions/menuflow/index.ts`.
4. `config.js` já aponta para o projeto novo. `region: 'sa-east-1'` mantém a função perto do banco (São Paulo).
   Confirme em *Project Settings* que o projeto está em *South America (São Paulo)*.
   Se a função devolver erro citando a região, apague a linha `region`.
5. Suba os arquivos para o GitHub (apague do repositório `uploads/`, `api.js`, `app.js` e `alert.mp3`, que não são mais usados).
6. No painel: **Configurações → Chave Pix** (obrigatória para gerar o "copia e cola") e crie categorias/produtos.

## Fluxos

- **Cardápio (admin):** crie a categoria → dentro dela "+ Produto" → botão "⊕ Complementos" no produto (grupos de escolha e adicionais) ou "⊕ Complementos da categoria" (vale para todos os produtos dela).
- **Imagens:** são reduzidas e convertidas para WebP no navegador (foto + miniatura) e gravadas no Storage (`menu-images`, criado automaticamente se faltar). O botão Salvar fica travado enquanto a imagem sobe.
- **Checkout:** Pix gera código "copia e cola" já com o valor; Dinheiro pergunta se precisa de troco e para quanto; Cartão é pago na entrega/retirada.
- **Central de pedidos (`orders.html`):** toque em "Iniciar painel" uma vez (libera o som). Atualiza sozinha (10/15/30/60 s), o alerta repete a cada 3 s até todos os pedidos novos serem aceitos, mantém a tela acesa e renova o login sozinha.

## Segurança / limites

- Ative proteção anti-spam (rate limit/CAPTCHA) para o `checkout` antes de receber pedidos reais.
- A sessão do admin fica em `localStorage` (para o tablet da cozinha não pedir login toda hora). Use apenas em dispositivos seus.
- O painel carrega os 500 pedidos mais recentes; a central de pedidos carrega só os ativos e os 25 últimos finalizados.
- O Pix não é confirmado automaticamente: a loja confere o recebimento no app do banco.
