# MenuFlow Lite — GitHub Pages (etapa 1)

Esta versão usa HTML/CSS/JavaScript estáticos e consulta o cardápio no Google Apps Script.

## Publicação

Envie **o conteúdo desta pasta** para a raiz do repositório e configure GitHub Pages para publicar a branch principal a partir de `/ (root)`.

## O que funciona

- Estrutura visual original do cardápio preservada.
- Consulta pública ao Google Sheets pela API implantada.
- Tradução básica das colunas em português para o modelo usado pelo frontend.

## Ainda não funciona nesta etapa

- Finalização de pedidos e cálculo validado no servidor.
- Login e operações do painel administrativo.
- Central de pedidos e alarme conectado a pedidos reais.
- Upload para Drive, fidelidade e resgates.

Os arquivos das telas administrativas foram mantidos para migração, mas **não devem ser utilizados para operação real** até a API autenticada estar pronta. Não adicione senhas nem tokens a arquivos do GitHub.

**Atenção:** o código Apps Script de teste retorna dados públicos sem filtro de campos; não coloque informações privadas nas abas consultadas. Antes de usar em produção, restringir a API pública a colunas permitidas.
