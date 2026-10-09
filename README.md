# MenuFlow — GitHub Pages + Google Sheets + Google Drive

Sistema de cardápio digital com **catálogo, carrinho, pedidos, painel administrativo, controle de produtos/categorias, estoque, imagens no Drive e central de pedidos**.

## Instalação (necessária: o sistema não pode criar/autorizar sua planilha ou implantação sem acesso à sua conta)

1. Crie uma **planilha Google Sheets vazia**. Copie seu ID da URL entre `/d/` e `/edit`.
2. Crie uma **pasta no Google Drive** para imagens. Copie o ID da URL após `/folders/`.
3. Entre em [script.google.com](https://script.google.com) → Novo projeto → substitua `Code.gs` pelo conteúdo de **`apps-script/Code.gs`** deste pacote.
4. Em **Configurações do projeto → Propriedades do script**, crie exatamente estas 3 propriedades:
   - `SPREADSHEET_ID` → ID da planilha
   - `DRIVE_FOLDER_ID` → ID da pasta
   - `ADMIN_PASSWORD` → uma **senha forte e exclusiva** (não coloque em arquivos do GitHub)
5. No editor do Apps Script, selecione a função `setup` e clique **Executar**. Autorize acesso ao Google Sheets e Drive. A função cria as abas e configurações padrão.
6. Clique em **Implantar → Nova implantação → Aplicativo da Web**. Escolha **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa** (necessário para receber pedidos públicos). Confirme e copie a URL terminada em `/exec`.
7. Edite `config.js`, substituindo `COLE_AQUI_A_URL_DO_APPS_SCRIPT_EXEC` pela URL `/exec`. Não coloque senhas, IDs secretos nem tokens nesse arquivo.
8. No GitHub crie um repositório e envie **o conteúdo desta pasta** à raiz (não a pasta `MenuFlow-Pronto`). Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/(root)`. Use a URL gerada pelo GitHub Pages.
9. Abra `admin.html` no endereço publicado e entre com `ADMIN_PASSWORD`. Crie ao menos uma categoria, cadastre produtos e configure nome, abertura e taxa de entrega. `index.html` é o cardápio público e `orders.html` é a central de pedidos.

### Atualização do Apps Script
Sempre que modificar o `Code.gs`, vá a **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**. A URL `/exec` permanece a mesma se você editar a implantação existente.

## Segurança e limites

- O administrador informa sua senha ao usar `admin.html`; a senha **não fica no GitHub** e é guardada somente na sessão do navegador (`sessionStorage`). Feche a sessão em um computador compartilhado. Recomenda-se usar uma senha longa, exclusiva, e HTTPS (Pages já usa HTTPS).
- **Atenção:** esse é um aplicativo simples para pequenas operações. A senha compartilhada não oferece usuários com perfis distintos, MFA, bloqueio por tentativas ou prevenção avançada de abuso. O endpoint de checkout é público por necessidade e pode receber spam; acompanhe a planilha e as cotas do Google Apps Script.
- Dados de clientes e pedidos permanecem privados na planilha e só podem ser consultados pelo painel com senha. O catálogo público usa JSONP apenas para dados públicos; as escritas usam formulário POST + iframe com resposta `postMessage`, evitando problemas de CORS no GitHub Pages.
- As imagens enviadas são disponibilizadas pelo Drive por link público de visualização. NÃO envie imagens confidenciais. O Drive pode ter limitações de exibição/bloqueios por permissão ou quota.
- A taxa de entrega configurada é única (não depende do bairro). Pagamento Pix é apenas a **exibição da chave**, sem confirmação automática. Não há gateway de pagamento, entregador, cupons ou fidelidade nesta versão.
- O estoque `-1` significa ilimitado. A validação do pedido e o recálculo do preço são feitos no servidor. O Google Apps Script impõe cotas, limites e disponibilidade próprios.
- O envio de fotos pelo painel aceita JPG, PNG, WebP e GIF com tamanho máximo de 4 MB.
- Não compartilhe a senha de administração por e-mail público nem em capturas de tela.

## Diagnóstico

Se aparecer “Configure a URL”, atualize `config.js` com o link `/exec`. Se uma escrita retornar “Sem resposta”, confira implantação pública como “Executar como Eu”, permissões Google, console do navegador, e a versão do deployment. Se imagens não renderizarem, confira as restrições de compartilhamento do Drive. Se ocorrer erro de acesso à planilha, execute `setup` e confirme que os IDs e permissões estão corretos.

## Arquivos

`index.html` + `app.js`: cliente; `admin.html` + `admin.js`: painel; `orders.html` + `orders.js`: pedidos; `api.js`: comunicação; `config.js`: URL da API; `style.css`: visual; `apps-script/Code.gs`: backend; `imagens/`: imagens originais disponibilizadas como referência.
