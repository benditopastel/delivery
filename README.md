# MenuFlow — protótipo de cardápio digital

Primeira versão funcional para testes locais. Design inspirado nas referências: painel desktop limpo e cardápio mobile com tons `#961406` e `#d5411a`.

## Como executar

Requer Python 3.10+.

```bash
pip install -r requirements.txt
python start.py
```

- **Painel da loja:** http://127.0.0.1:8000/admin
- **Cardápio do cliente:** http://127.0.0.1:8000/

O arquivo `data/cardapio.xlsx` é criado automaticamente na primeira execução com categorias, produtos, complementos, banner e cupom `BEMVINDO10` de demonstração.

## O que funciona nesta primeira versão

- Loja: dashboard, cadastros de produtos, categorias, complementos globais, banners e cupons; pausa e ativação; estoque configurável; preço promocional; múltiplas imagens por produto; configuração de operação, taxa e frete grátis; visão de pedidos e alteração de status; relatórios básicos.
- Cliente: busca, categorias, itens, galeria de imagens, adicionais compartilhados, carrinho, barra de frete grátis e checkout em quatro etapas; cupom; pedido registrado no Excel.
- Imagens: validação, limite de 10 MB, rotação via EXIF, redimensionamento até 1600px, conversão WebP, miniaturas 420px.
- Código: backend FastAPI separado do frontend HTML/CSS/JS; acesso aos dados centralizado em `backend/store.py`.

## Limitações deliberadas (protótipo)

**Não disponibilize na internet ou para pedidos reais:** não há autenticação no painel nem controle transacional sobre o estoque. O Excel não suporta concorrência segura, e o pagamento Pix/cartão/dinheiro é apenas declarado, não cobrado. A precificação é calculada novamente pelo servidor, mas a integração de pagamento, as entregas por bairro, o abatimento efetivo de estoque, a fidelidade, os relatórios avançados, as promoções agendadas e os disparos de notificações serão implementados em etapas futuras. Cupons de teste não têm limite de uso. O campo de observação do item ainda não é enviado ao backend.

Para uso real: migrar para Supabase/Postgres, criar autenticação e permissões, migrations, transações de estoque, validações completas, políticas LGPD, storage de imagens e integração com pagamentos. Idealmente, construir uma camada de repositório assíncrona com contratos estáveis, permitindo substituir o adapter Excel sem reescrever telas e regras de negócio.

## Arquivos importantes

- `backend/main.py`: rotas e regras iniciais de pedido
- `backend/store.py`: persistência em Excel, com dados de exemplo
- `frontend/admin.js`: painel da loja
- `frontend/customer.js`: cardápio e checkout mobile
- `frontend/common.js`: utilitários compartilhados
- `frontend/style.css`: design system e responsividade

## Próximos módulos sugeridos

1. Login, segurança e controle de permissões.
2. Regras de grupos de complementos obrigatórios/opcionais e limite de seleção.
3. Gestão transacional de estoque, carrinho persistido e configurações avançadas de entrega.
4. Banners com imagens de verdade no cardápio, múltiplos blocos e programação.
5. Fidelidade com resgate de pontos e histórico, cupons com regras de uso.
6. Supabase, storage, pagamentos e deploy.
