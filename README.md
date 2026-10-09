# Cardápio original recuperado — GitHub Pages + Google Sheets + Drive

Este pacote preserva o **layout, CSS, HTML e os fluxos do frontend Python** do `cardapio.zip` enviado, substituindo somente o acesso ao FastAPI/Excel por uma integração Apps Script. Os protótipos antigos devem ser usados como referência; **não envie o backend Python, a pasta `data` ou as dependências do FastAPI ao GitHub Pages**.

## 1. Apps Script

No projeto Apps Script **já conectado à sua planilha**, atualize o conteúdo de `Code.gs` com `apps-script/Code.gs`. Crie também o arquivo `LegacyData.gs` e cole o conteúdo de `apps-script/LegacyData.gs` (opcional, para importar os dados de exemplo e pedidos históricos do Excel enviado).

As **Propriedades do script** devem continuar exatamente como já foram cadastradas:

- `SPREADSHEET_ID` — ID da planilha existente
- `DRIVE_FOLDER_ID` — ID da pasta das imagens
- `ADMIN_PASSWORD` — senha usada na administração

Execute `setup()` uma vez. Esse processo **cria abas e acrescenta colunas ausentes sem excluir as linhas que você já tem**. Para incorporar também o conteúdo histórico do arquivo Excel, execute **`importLegacyData()`**: essa rotina só inclui IDs/chaves que não existem; não substitui registros atuais. Os pedidos importados da versão local são dados históricos: revise-os antes de abrir a operação real.

**Importante:** `setup` amplia o layout das abas. Não exclua as abas já existentes e não reordene colunas manualmente. Mantenha a planilha privada.

## 2. Publicar o Apps Script

Implantar > Gerenciar implantações > Editar > **Nova versão** > Aplicativo da Web > Executar como **Eu** > Quem tem acesso **Qualquer pessoa**. Copie a URL que termina em `/exec`.

## 3. GitHub Pages

Edite apenas o arquivo `config.js` e cole sua URL `/exec` em `apiUrl`. Coloque **todos os arquivos da raiz deste pacote**, inclusive `imagens/`, em uma pasta pública do repositório (preferencialmente raiz). Em Settings > Pages, escolha Branch `main`, pasta `/ (root)`. Acesse `index.html`, `admin.html` e `orders.html` pela URL do GitHub Pages.

Nenhuma senha ou ID privado deve ser escrito em `config.js`. **Nunca envie as Propriedades do Script ao GitHub.**

## 4. Recursos do layout original mantidos

Cardápio, busca, categorias, galeria, estoque, promoções, complementos avulsos, grupos de escolhas opcionais e obrigatórios, carrinho e checkout em etapas, cupons, Pix copia-e-cola, banners, painel de gestão, relatório inicial, ordenação arrastando, central de pedidos com áudio, status, pontos e catálogo de recompensas. As telas foram mantidas no desenho original; a camada de dados foi adaptada ao Sheets.

Imagens *novas* enviadas no painel são salvas na pasta indicada no Drive. As imagens locais legadas também estão incluídas em `imagens/` como arquivos estáticos, e URLs antigas `/uploads/nome.webp` são reconhecidas quando exibidas pelo catálogo.

## 5. Limites e verificação necessária

- **Não há testes ponta a ponta contra a sua conta Google nesta entrega.** É necessário verificar na implantação real: login, cadastro, upload, pedido com complementos, cupons, estoque, Pix, mudança de status e pontos.
- O Apps Script não fornece a mesma transação de banco de dados que PostgreSQL. Usa-se `LockService` para serializar gravações concorrentes, mas um erro do Google depois de registrar pedido e antes de atualizar estoque ainda pode exigir correção manual.
- Uploads usam até 4 MB; o Apps Script não realiza o processamento WebP/EXIF que o backend Python fazia. Use imagens já redimensionadas quando possível.
- Resgate de pontos pela interface pública **permanece desativado**, tal como no protótipo, até haver validação segura da identidade do cliente.
- A autenticação por senha compartilhada é uma proteção básica. Para uso de alto volume, dados sensíveis de clientes ou equipe com permissões, recomenda-se um backend autenticado dedicado.
- O transporte de operações do Apps Script usa POST + consulta de resultado por identificador temporário. O navegador não recebe a resposta diretamente via CORS; por isso, em falhas de rede, confira a planilha antes de repetir um pedido ou salvamento.
- A exibição de imagens públicas via URL do Google Drive depende das regras de compartilhamento e da disponibilidade do endpoint de miniaturas do Google.
- Pix gera um código de pagamento, **não confirma recebimento automaticamente**. Status e conciliação são manuais.

## 6. Teste recomendado

1. Confirme `setup()` e, opcionalmente, `importLegacyData()`.
2. Confira no GitHub Pages se categorias, produtos e banners aparecem.
3. Entre em `admin.html` com a senha de `ADMIN_PASSWORD`.
4. Crie uma categoria e produto de teste, envie imagem e confira o Drive e as abas.
5. Teste pedido de retirada e entrega, cupom, complemento e grupo obrigatório.
6. Confira valores, pedido e estoque no Sheets.
7. Em `orders.html`, marque pedido como concluído e confira os pontos.

Se o login não responder, verifique **Apps Script > Execuções** e a versão da implantação, depois a aba Rede do navegador. **Não execute `importLegacyData()` repetidamente para testes**, mesmo sendo idempotente por chave.
