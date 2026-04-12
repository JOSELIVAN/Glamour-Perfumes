# Perfume Glamour - Site de Vendas

Um site moderno e simples para venda de perfumes, desenvolvido com HTML, CSS e React.

## 🚀 Como executar

### Método 1: Via linha de comando (Recomendado)
```bash
cd pasta-do-projeto
npm install
npm start
```
Depois acesse: `http://localhost:5500`

### Método 2: Servidor Local
1. Execute `node server.js`
2. Abra seu navegador e acesse: `http://localhost:5500`

> **Importante**: Não abra `index.html` diretamente no navegador, pois as funcionalidades de API não funcionarão devido a restrições de CORS.

## 📋 Funcionalidades

- ✅ Catálogo de perfumes com imagens
- ✅ Carrinho de compras interativo
- ✅ Pagamento via Pix (QR Code)
- ✅ Pagamento via Stripe (Cartão/Boleto)
- ✅ Interface moderna em português
- ✅ Notificações por email
- ✅ Persistência de pedidos
- ✅ Design responsivo e acessível
- ✅ Dados salvos localmente (localStorage)
- ✅ Integração com Stripe Checkout para pagamentos de cartão
- ✅ Fluxo de checkout seguro e rápido
- ✅ Interface otimizada para mobile

## 🎨 Design Moderno

- Tema roxo/rosa elegante com gradientes suaves
- Cards de produto com hover effects
- Modal de checkout responsivo
- Tipografia moderna (Inter font)
- Sombras e bordas arredondadas
- Animações suaves de transição

## 💳 Sistema de Pagamentos com Stripe

### Integração com Stripe Checkout
- **Pagamentos Seguros**: Processamento seguro com Stripe Checkout
- **Cartão de Crédito**: Suporte completo para cartões de crédito e débito
- **Confirmação Automática**: Verificação automática do status do pagamento

### ⚠️ Configuração Necessária para Pagamentos Reais

Para que os pagamentos **realmente depositem dinheiro** em sua conta, siga estes passos:

1. **Crie uma conta no Stripe**:
   - Acesse [stripe.com](https://stripe.com) e crie uma conta
   - Complete a verificação da conta

2. **Obtenha suas chaves API**:
   - No dashboard do Stripe, vá em "Developers" > "API keys"
   - Copie a "Secret key" (começa com sk_test_ para teste ou sk_live_ para produção)

3. **Configure a chave secreta** no arquivo `server.js`:
   ```javascript
   const stripe = require('stripe')('SUA_SECRET_KEY_AQUI');
   ```

4. **Configure as URLs de webhook** (opcional para produção):
   - No dashboard do Stripe, configure webhooks para receber notificações de pagamento

### Como Testar o Stripe:

1. **Adicione produtos** ao carrinho
2. **Finalize compra** inserindo nome e email
3. **Será redirecionado** para o Stripe Checkout
4. **Use cartões de teste** do Stripe (ex: 4242 4242 4242 4242)
5. **Após pagamento**, será redirecionado de volta com confirmação

### Cartões de Teste do Stripe:
- **Número**: 4242 4242 4242 4242
- **Data de validade**: Qualquer data futura
- **CVC**: Qualquer 3 dígitos
- **Nome**: Qualquer nome

**Nota**: Esta implementação usa Stripe Checkout para simplicidade e segurança. Para personalização avançada, considere usar Stripe Elements.

## 🛠️ Tecnologias

- **Versão React**: React 17 (CDN) + Babel
- **Versão Offline**: HTML/CSS/JS puro
- CSS moderno com variáveis
- LocalStorage para persistência

## 📁 Estrutura dos arquivos

```
perfume/
├── index.html      # Página principal (React)
├── styles.css      # Estilos CSS
├── app.js          # Aplicação React
├── server.bat      # Script para servidor
└── README.md       # Este arquivo
```

## 🔧 Solução de problemas

### Site não carrega?
1. Use o `server.bat` para iniciar o servidor local
2. Verifique se a porta 5500 não está sendo usada por outro programa
3. Abra `index.html` no navegador

### Erro no console do navegador?
- Pressione F12 para abrir as ferramentas do desenvolvedor
- Vá na aba "Console" para ver mensagens de erro
- Scripts externos podem ser bloqueados por firewall/antivírus
- Tente desabilitar temporariamente o bloqueador de anúncios

### Problemas comuns:
- **CORS errors**: Use servidor local em vez de abrir arquivo diretamente
- **Scripts não carregam**: Verifique conexão com internet
- **React não funciona**: Abra `index-simple.html` como alternativa

## 💡 Dicas

- O site funciona completamente offline após o primeiro carregamento
- Dados são salvos localmente no navegador
- Interface otimizada para desktop e mobile