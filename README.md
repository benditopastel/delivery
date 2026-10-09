# MenuFlow — Base GitHub Pages + Google Sheets

## Conteúdo
Frontend original preservado: index.html, admin.html, orders.html, scripts, estilos, imagens e som. `common.js` contém o adaptador de leitura para o Apps Script já implantado.

## Publicar
Envie o conteúdo do ZIP (sem pasta intermediária) para a raiz do repositório; configure GitHub Pages na branch principal, pasta `/ (root)`.

## Situação real
- Leitura do cardápio: implementada no adaptador, **ainda requer teste no navegador publicado**. Google Apps Script pode bloquear fetch entre origens por CORS/redirecionamentos.
- Checkout, login administrativo, gravação, upload, fidelidade e monitoramento: **não implementados** no backend novo. O adaptador rejeita essas operações explicitamente; não use este pacote para vendas reais.
- Admin e central de pedidos são telas preservadas para migração, não estão operacionais.
- Não há código de servidor Python ou configuração de infraestrutura anterior neste pacote.

## Próximo passo técnico
Validar `fetch` do GitHub Pages à implantação do Apps Script. Se houver erro CORS, usar transporte adequado (por exemplo, proxy/serverless seguro) antes de integrar escrita; JSONP pode ser usado somente para informações públicas e não confidenciais, jamais para autenticação ou pedidos.

## Segurança
Não publicar senhas, chaves, tokens administrativos nem dados de clientes no GitHub. Toda alteração e consulta privada deve ser autorizada no servidor.
