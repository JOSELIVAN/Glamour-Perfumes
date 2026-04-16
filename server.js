const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');
const cors = require('cors');

// Cargar .env si existe; si no existe, intentar cargar .env.example como fallback local.
if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
} else if (fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
  console.warn('Advertencia: cargando STRIPE_SECRET_KEY desde .env.example. Para producción, crea un .env real.');
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_STRIPE_SECRET_KEY';
const stripe = require('stripe')(stripeSecretKey);
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const validStripeKey = stripeSecretKey && !stripeSecretKey.includes('YOUR_STRIPE_SECRET_KEY');
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';

const ORDERS_FILE = 'orders.json';
const PRODUCTS_FILE = 'products-manager.json';

const loadOrders = () => {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')) || {};
    }
  } catch (error) {
    console.error('Error al cargar orders.json:', error);
  }
  return {};
};

const saveOrders = (orders) => {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar orders.json:', error);
  }
};

const loadProducts = () => {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')) || [];
    }
  } catch (error) {
    console.error('Error al cargar products.json:', error);
  }
  return [];
};

const saveProducts = (products) => {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar products.json:', error);
  }
};

const ordersStore = loadOrders();
const productsStore = loadProducts();

const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined,
  secure: process.env.EMAIL_SECURE
    ? process.env.EMAIL_SECURE === 'true'
    : Number(process.env.EMAIL_PORT) === 465,
  ...(process.env.EMAIL_SECURE !== 'true' && Number(process.env.EMAIL_PORT) === 587 ? {
    requireTLS: true,
    tls: {
      rejectUnauthorized: false,
    }
  } : {}),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
};

const emailNotificationRecipients = process.env.EMAIL_NOTIFICATION_TO
  ? process.env.EMAIL_NOTIFICATION_TO.split(',').map(email => email.trim()).filter(Boolean)
  : [];

const emailRecipient = emailNotificationRecipients.length > 0
  ? emailNotificationRecipients[0]
  : process.env.EMAIL_USER;

const emailEnabled = emailConfig.host && emailConfig.port && emailConfig.auth.user && emailConfig.auth.pass;

const transporter = emailEnabled ? nodemailer.createTransport(emailConfig) : null;
// Configuración de Twilio para SMS
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const twilioClient = (twilioAccountSid && twilioAuthToken && twilioPhoneNumber)
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;

const smsEnabled = !!twilioClient;
if (!validStripeKey) {
  console.warn('⚠️ Stripe secret key no configurada. Establece STRIPE_SECRET_KEY en el archivo .env.');
}

if (!emailEnabled) {
  console.warn('⚠️ Notificaciones por email deshabilitadas. Completa EMAIL_HOST, EMAIL_PORT, EMAIL_USER y EMAIL_PASS en .env.');
} else {
  transporter.verify().then(() => {
    console.log('✅ Configuración SMTP verificada.');
  }).catch((error) => {
    console.warn('⚠️ No se pudo verificar la configuración SMTP:', error.message);
  });
}

if (!smsEnabled) {
  console.warn('⚠️ Notificaciones por SMS deshabilitadas. Para habilitar, configura TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE_NUMBER en .env.');
} else {
  console.log('✅ Configuración Twilio verificada.');
}

const sendEmailNotification = async (subject, html, recipient) => {
  if (!emailEnabled || !transporter) {
    console.warn('Email no enviado: configuración SMTP incompleta.');
    return;
  }

  if (!recipient) {
    console.warn('Email no enviado: destinatario no definido.');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || emailConfig.auth.user,
      to: recipient,
      subject,
      html,
    });
    console.log('✅ Email enviado:', subject, 'a', recipient);
  } catch (error) {
    console.error('❌ Error al enviar email a', recipient, ':', error.message);
  }
};

const sendSMSNotification = async (message, phoneNumber) => {
  if (!smsEnabled || !twilioClient) {
    console.warn('SMS no enviado: configuración Twilio incompleta.');
    return;
  }

  if (!phoneNumber) {
    console.warn('SMS no enviado: número de teléfono no definido.');
    return;
  }

  try {
    // Formatar número de telefone (adicionar +55 se não tiver)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+55${phoneNumber.replace(/\D/g, '')}`;

    await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedPhone
    });
    console.log(`✅ SMS enviado a ${formattedPhone}`);
  } catch (error) {
    console.error(`❌ Error al enviar SMS a ${phoneNumber}:`, error.message);
  }
};

const sendNotification = async (order, notificationType = 'email') => {
  const orderId = order.id;
  const cliente = order.cliente || {};

  // Preparar dados do pedido
  const endereco = cliente.endereco || {};
  const labelUrl = `${appBaseUrl}/order-label?order_id=${encodeURIComponent(orderId)}`;

  const itensHtml = order.itens?.map(item =>
    `<li>${item.quantidade}x ${item.nome} - R$ ${(item.preco * item.quantidade).toFixed(2)}</li>`
  ).join('') || '<li>Sem itens</li>';

  const pagamentoDetalhes = order.metodoPagamento === 'pix'
    ? `<p><strong>Chave PIX:</strong> ${order.chavePix || 'N/A'}</p>`
    : `<p><strong>ID da Transação:</strong> ${order.stripeSessionId || 'N/A'}</p>`;

  const enderecoHtml = endereco.logradouro ? `
    <h3>Endereço de Entrega</h3>
    <p><strong>CEP:</strong> ${endereco.cep}</p>
    <p><strong>Rua:</strong> ${endereco.logradouro}, ${endereco.numero}</p>
    <p><strong>Complemento:</strong> ${endereco.complemento || 'N/A'}</p>
    <p><strong>Bairro:</strong> ${endereco.bairro}</p>
    <p><strong>Cidade / UF:</strong> ${endereco.cidade} / ${endereco.estado}</p>` : '';

  const labelHtml = generateShippingLabel(order);

  // Conteúdo para cliente
  const customerContent = {
    email: {
      subject: `Confirmação de Pagamento - Pedido ${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🎉 Pagamento Confirmado!</h2>
          <p>Olá <strong>${cliente.nome}</strong>,</p>
          <p>Seu pedido foi confirmado e está sendo processado. Aqui estão os detalhes:</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📦 Detalhes do Pedido #${orderId}</h3>
            <p><strong>Valor Total:</strong> R$ ${(order.total || 0).toFixed(2)}</p>
            <p><strong>Método de Pagamento:</strong> ${order.metodoPagamento}</p>
            ${pagamentoDetalhes}
            <p><strong>Data:</strong> ${order.data}</p>
          </div>

          <h3>🛍️ Itens do Pedido</h3>
          <ul style="background: #fff; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
            ${itensHtml}
          </ul>

          ${enderecoHtml}

          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <h4>🚚 Sobre o Envio</h4>
            <p>Seu pedido será enviado em até 2-3 dias úteis. Você receberá atualizações por email.</p>
            <p><a href="${labelUrl}" style="display:inline-block;margin:10px 0;padding:10px 15px;background:#2196f3;color:#fff;text-decoration:none;border-radius:5px;">Ver Etiqueta de Envio</a></p>
          </div>

          <p style="color: #666; font-size: 12px;">
            Obrigado por comprar na Glamour Perfums!<br>
            Qualquer dúvida, entre em contato conosco.
          </p>
        </div>
      `
    },
    sms: {
      message: `Glamour Perfums: Pagamento confirmado! Pedido ${orderId} - R$ ${(order.total || 0).toFixed(2)}. Em breve enviaremos atualizações.`
    }
  };

  // Conteúdo para admin
  const adminContent = {
    email: {
      subject: `PAGAMENTO CONFIRMADO - Pedido ${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">💰 Novo Pagamento Confirmado</h2>
          <p><strong>Pedido:</strong> ${orderId}</p>
          <p><strong>Cliente:</strong> ${cliente.nome} (${cliente.email})</p>
          <p><strong>Valor total:</strong> R$ ${(order.total || 0).toFixed(2)}</p>
          <p><strong>Método:</strong> ${order.metodoPagamento}</p>
          ${pagamentoDetalhes}

          <h3>📦 Itens do Pedido</h3>
          <ul>${itensHtml}</ul>

          ${enderecoHtml}

          <h3>🏷️ Etiqueta de Envio A6</h3>
          <div style="border:1px solid #ccc; padding:10px; background:#fafafa;">
            ${labelHtml}
          </div>
          <p><small>Abra a etiqueta em seu navegador para imprimir em papel A6.</small></p>
          <p><a href="${labelUrl}" target="_blank" style="display:inline-block;margin:12px 0;padding:10px 14px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;">Ver etiqueta A6 imprimible</a></p>
        </div>
      `
    },
    sms: {
      message: `ADMIN: Novo pagamento confirmado! Pedido ${orderId} - ${cliente.nome} - R$ ${(order.total || 0).toFixed(2)}`
    }
  };

  // Enviar notificação para o cliente
  if (notificationType === 'email' || notificationType === 'both') {
    if (cliente.email) {
      await sendEmailNotification(
        customerContent.email.subject,
        customerContent.email.html,
        cliente.email
      );
    }
  }

  if (notificationType === 'sms' || notificationType === 'both') {
    if (cliente.telefone) {
      await sendSMSNotification(
        customerContent.sms.message,
        cliente.telefone
      );
    }
  }

  // Sempre enviar email para admin (não SMS para evitar custos)
  if (emailRecipient && emailRecipient !== cliente.email) {
    await sendEmailNotification(
      adminContent.email.subject,
      adminContent.email.html,
      emailRecipient
    );
  }
};

const generateShippingLabel = (order) => {
  const { cliente, id } = order;
  const { endereco } = cliente;
  
  return `
    <div style="width: 100mm; height: 148mm; padding: 5mm; border: 2px solid #000; font-family: Arial, sans-serif; box-sizing: border-box; background: white; color: black; margin: 0 auto;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 5mm; margin-bottom: 5mm; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">PERFUME GLAMOUR</h2>
        <p style="margin: 5px 0; font-size: 12px;">DECLARAÇÃO DE CONTEÚDO / ETIQUETA DE ENVIO</p>
      </div>
      
      <div style="margin-bottom: 5mm;">
        <p style="margin: 0; font-weight: bold; font-size: 14px;">DESTINATÁRIO:</p>
        <p style="margin: 2px 0; font-size: 16px;">${cliente.nome.toUpperCase()}</p>
        <p style="margin: 2px 0; font-size: 14px;">${endereco.logradouro}, ${endereco.numero} ${endereco.complemento ? '- ' + endereco.complemento : ''}</p>
        <p style="margin: 2px 0; font-size: 14px;">${endereco.bairro}</p>
        <p style="margin: 2px 0; font-size: 14px;">${endereco.cidade} - ${endereco.estado}</p>
        <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">CEP: ${endereco.cep}</p>
      </div>

      <div style="border: 1px dashed #000; padding: 3mm; margin-bottom: 5mm;">
        <p style="margin: 0; font-weight: bold; font-size: 12px;">REMETENTE:</p>
        <p style="margin: 2px 0; font-size: 12px;">PERFUME GLAMOUR</p>
        <p style="margin: 2px 0; font-size: 12px;">RUA DOS PERFUMES, 123 - VILA ELEGÂNCIA</p>
        <p style="margin: 2px 0; font-size: 12px;">CEP: 13295-000 - ITUPEVA/SP</p>
      </div>

      <div style="text-align: center; margin-top: 10mm;">
        <p style="margin: 0; font-size: 12px;">PEDIDO: <strong>${id}</strong></p>
        <div style="margin-top: 5mm; border: 1px solid #000; padding: 5px; display: inline-block;">
            <p style="margin: 0; font-size: 10px;">PARA USO DOS CORREIOS / TRANSPORTADORA</p>
            <div style="width: 60mm; height: 15mm; background: #eee; margin: 5px auto;"></div>
        </div>
      </div>
    </div>
  `;
};

const updateOrderStatus = async (orderId, status, additional = {}) => {
  const order = ordersStore[orderId];
  if (!order) return null;

  const previousStatus = order.status;
  order.status = status;

  if (additional.stripeSessionId) order.stripeSessionId = additional.stripeSessionId;
  if (additional.paymentUrl) order.paymentUrl = additional.paymentUrl;
  if (additional.paidAt) order.paidAt = additional.paidAt;

  ordersStore[orderId] = order;
  saveOrders(ordersStore);

  // Solo enviar notificaciones si el status cambió a 'Pago' (no si ya estaba pagado)
  if (status === 'Pago' && previousStatus !== 'Pago') {
    console.log(`Enviando notificaciones de confirmación para pedido ${orderId}`);

    if (!order.cliente || !order.cliente.nome || !order.cliente.email) {
      console.error(`⚠️ Datos del cliente incompletos para pedido ${orderId}: ${JSON.stringify(order.cliente)}`);
      return order;
    }

    // Usar o sistema de notificações híbrido
    // Verificar se o cliente tem telefone e preferência de notificação
    const notificationType = order.cliente.telefone && order.cliente.notificationType
      ? order.cliente.notificationType
      : (order.cliente.telefone ? 'both' : 'email');
    await sendNotification(order, notificationType);
  }

  return order;
};

const createOrder = async ({ id, cliente, itens, total, metodoPagamento, parcelas, chavePix, qrCode, stripeSessionId, paymentUrl }) => {
  const orderId = id || `PED-${Date.now()}`;
  const order = {
    id: orderId,
    cliente: {
      ...cliente,
      endereco: cliente.endereco || null
    },
    itens,
    total,
    metodoPagamento,
    parcelas: parcelas || 1,
    status: metodoPagamento === 'pix' ? 'Aguardando Pagamento Pix' : 'Aguardando Pagamento',
    data: new Date().toLocaleString('pt-BR'),
    chavePix: chavePix || null,
    qrCode: qrCode || null,
    stripeSessionId: stripeSessionId || null,
    paymentUrl: paymentUrl || null,
  };

  ordersStore[orderId] = order;
  saveOrders(ordersStore);

  return order;
};

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5500;
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

/** Origen público para redirects de Checkout (respeta APP_BASE_URL y proxies). */
const getCheckoutOrigin = (req) => {
  const env = process.env.APP_BASE_URL && String(process.env.APP_BASE_URL).trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      /* continuar */
    }
  }
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) {
    try {
      return new URL(appBaseUrl).origin;
    } catch {
      return `http://localhost:${PORT}`;
    }
  }
  const rawProto = req.get('x-forwarded-proto') || (req.secure ? 'https' : req.protocol) || 'http';
  const proto = String(rawProto).split(',')[0].trim();
  return `${proto}://${host}`;
};

/**
 * Stripe Checkout sólo acepta imágenes HTTPS absolutas. Rutas relativas o http://
 * provocan "Not a valid URL". Si no hay URL HTTPS válida, no se envía el campo images.
 */
const buildStripeProductImages = (pictureUrl, siteOrigin) => {
  if (pictureUrl == null || typeof pictureUrl !== 'string') return null;
  const t = pictureUrl.trim();
  if (!t) return null;
  let base;
  try {
    base = new URL(siteOrigin);
  } catch {
    return null;
  }
  try {
    let u;
    if (/^https?:\/\//i.test(t)) {
      u = new URL(t);
    } else {
      const path = t.startsWith('/') ? t : `/${t}`;
      u = new URL(path, base);
    }
    if (u.protocol !== 'https:') {
      return null;
    }
    return [u.href];
  } catch {
    return null;
  }
};

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());
app.options(['/api/register-order', '/api/confirm-pix', '/api/confirm-stripe-payment', '/api/create-checkout-session', '/api/checkout'], cors());
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`REQ ${req.method} ${req.path}`);
  }
  next();
});

/** 
 * El webhook de Stripe DEBE definirse antes del parser JSON global 
 * para recibir el cuerpo raw necesario para validar la firma.
 */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event = null;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.client_reference_id;
    if (orderId && ordersStore[orderId]) {
      await updateOrderStatus(orderId, 'Pago', { 
        stripeSessionId: session.id, 
        paymentUrl: session.url, 
        paidAt: new Date().toLocaleString('pt-BR') 
      });
      console.log(`Orden ${orderId} marcada como pago desde webhook.`);
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static('.'));

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'Servidor API funcionando' });
});

app.get('/api/products', (req, res) => {
  res.json(productsStore);
});

app.post('/api/products', (req, res) => {
  const products = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Se espera un array de productos.' });
  }
  productsStore.length = 0;
  productsStore.push(...products);
  saveProducts(productsStore);
  res.json({ ok: true });
});

app.get('/api/order-status', (req, res) => {
  const { order_id } = req.query;
  if (!order_id) {
    return res.status(400).json({ error: 'order_id es requerido.' });
  }

  const order = ordersStore[order_id];
  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  }

  res.json(order);
});

app.get('/api/order-by-session', (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'session_id es requerido.' });
  }

  const order = Object.values(ordersStore).find(item => item.stripeSessionId === session_id);
  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado para esta sesión.' });
  }

  res.json(order);
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  if (username !== adminUser || password !== adminPassword) {
    return res.status(401).json({ error: 'Credenciales invalidas.' });
  }

  return res.json({ ok: true, user: username });
});

app.get('/api/admin/assets', (req, res) => {
  try {
    const assetsDir = 'img';
    if (!fs.existsSync(assetsDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(assetsDir)
      .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return res.json({ files });
  } catch (error) {
    console.error('Error listing admin assets:', error);
    return res.status(500).json({ error: 'No se pudieron listar los archivos locales.' });
  }
});

app.post('/api/register-order', async (req, res) => {
  try {
    const { cliente, itens, total, metodoPagamento, parcelas, chavePix, qrCode, stripeSessionId, paymentUrl } = req.body;
    if (!cliente || !itens || typeof total !== 'number' || !metodoPagamento) {
      return res.status(400).json({ error: 'Datos de pedido incompletos.' });
    }

    const order = await createOrder({
      cliente,
      itens,
      total,
      metodoPagamento,
      parcelas,
      chavePix,
      qrCode,
      stripeSessionId,
      paymentUrl,
    });

    res.json({ orderId: order.id });
  } catch (error) {
    console.error('Error registering order:', error);
    res.status(500).json({ error: 'Error al registrar pedido.' });
  }
});

app.post('/api/confirm-pix', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ error: 'order_id es requerido.' });
    }

    const order = ordersStore[order_id];
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const updated = await updateOrderStatus(order_id, 'Pago', { paidAt: new Date().toLocaleString('pt-BR') });
    res.json(updated);
  } catch (error) {
    console.error('Error confirming Pix payment:', error);
    res.status(500).json({ error: 'Error al confirmar pago Pix.' });
  }
});

// Endpoint para confirmar pagamento Stripe
app.post('/api/confirm-stripe-payment', async (req, res) => {
  try {
    const { session_id, order_id } = req.body;
    
    console.log(`📝 Confirmando pago: session_id=${session_id}, order_id=${order_id}`);
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido.' });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });
      console.log('Stripe session status:', session.status, 'payment_status:', session.payment_status);
    } catch (stripeError) {
      console.error('Error retrieving Stripe session:', stripeError.message || stripeError);
      return res.status(500).json({ error: 'No se pudo recuperar la sesión Stripe.' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: `Pago Stripe no confirmado aún. Estado actual: ${session.payment_status}` });
    }

    let orderId = order_id;
    
    // Si no viene order_id, buscar por session_id
    if (!orderId && session_id) {
      const foundOrder = Object.values(ordersStore).find(item => item.stripeSessionId === session_id);
      if (foundOrder) {
        orderId = foundOrder.id;
        console.log(`✅ Orden encontrada por sessionId: ${orderId}`);
      }
    }

    if (!orderId) {
      console.error(`❌ No se encontró pedido para session_id: ${session_id}`);
      console.error('Órdenes disponibles:', Object.keys(ordersStore));
      return res.status(404).json({ error: 'Pedido no encontrado para esta sesión.' });
    }

    const order = ordersStore[orderId];
    if (!order) {
      console.error(`❌ Pedido ${orderId} no existe en ordersStore`);
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    console.log('Cliente e-mail:', order.cliente ? order.cliente.email : 'no disponible');
    console.log(`📋 Estado actual del pedido: ${order.status}`);

    if (order.status === 'Pago') {
      console.log(`⚠️ Pedido ${orderId} ya estaba confirmado`);
      return res.json({ message: 'El pedido ya fue confirmado', order });
    }

    const updated = await updateOrderStatus(orderId, 'Pago', { 
      stripeSessionId: session_id || order.stripeSessionId,
      paidAt: new Date().toLocaleString('pt-BR') 
    });
    
    console.log(`✅ Pedido ${orderId} marcado como PAGO`);
    res.json(updated);
  } catch (error) {
    console.error('Error confirming Stripe payment:', error);
    res.status(500).json({ error: 'Error al confirmar pago.' });
  }
});

// Endpoint para crear sesión de checkout de Stripe
const handleCreateCheckoutSession = async (req, res) => {
  if (!validStripeKey) {
    return res.status(500).json({ error: 'Stripe secret key no configurada. Establece STRIPE_SECRET_KEY en el entorno.' });
  }

  try {
    const { items, customer_email, installments, order } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío o no se recibieron items.' });
    }

    const checkoutOrigin = getCheckoutOrigin(req);

    const lineItems = items.map((item) => {
      const imgs = buildStripeProductImages(item.picture_url, checkoutOrigin);
      const product_data = { name: item.title };
      if (imgs && imgs.length) {
        product_data.images = imgs;
      }
      return {
        price_data: {
          currency: 'brl',
          product_data,
          unit_amount: Math.round(Number(item.unit_price || 0) * 100), // Stripe usa centavos
        },
        quantity: Number(item.quantity || 1),
      };
    });

    let serverOrder = null;
    if (order) {
      serverOrder = await createOrder({
        cliente: order.cliente,
        itens: order.itens,
        total: order.total,
        metodoPagamento: 'stripe',
        parcelas: order.parcelas,
        stripeSessionId: 'pending',
      });
    }

    const sessionConfig = {
      payment_method_types: ['card', 'boleto'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer_email,
      success_url: `${checkoutOrigin}?payment=success&session_id={CHECKOUT_SESSION_ID}&order_id=${serverOrder ? encodeURIComponent(serverOrder.id) : ''}`,
      cancel_url: `${checkoutOrigin}?payment=cancel`,
      client_reference_id: serverOrder ? serverOrder.id : undefined,
    };

    if (installments && installments > 1) {
      sessionConfig.payment_method_options = {
        card: {
          installments: {
            enabled: true,
          },
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    if (serverOrder && session && session.id) {
      const orderId = serverOrder.id;
      ordersStore[orderId].stripeSessionId = session.id;
      ordersStore[orderId].paymentUrl = session.url;
      saveOrders(ordersStore);
      console.log(`✅ Orden ${orderId} actualizada con Stripe sessionId: ${session.id}`);
    }

    res.json({
      sessionId: session.id,
      url: session.url,
      orderId: serverOrder ? serverOrder.id : undefined,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const message = error && error.message ? error.message : 'Error interno al crear sesión de checkout';
    res.status(500).json({ error: message });
  }
};

app.options('/api/create-checkout-session', cors());
app.options('/api/checkout', cors());
app.post('/api/create-checkout-session', handleCreateCheckoutSession);
app.post('/api/checkout', handleCreateCheckoutSession);
app.all('/api/create-checkout-session', (req, res) => res.status(405).json({ error: 'Method Not Allowed: use POST' }));
app.all('/api/checkout', (req, res) => res.status(405).json({ error: 'Method Not Allowed: use POST' }));

app.get('/order-label', (req, res) => {
  const { order_id } = req.query;
  if (!order_id) {
    return res.status(400).send('<h1>Pedido inválido</h1><p>Falta order_id.</p>');
  }

  const order = ordersStore[order_id];
  if (!order) {
    return res.status(404).send('<h1>Pedido no encontrado</h1><p>Verifica el ID del pedido.</p>');
  }

  const labelHtml = generateShippingLabel(order);
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Etiqueta A6 - Pedido ${order_id}</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f3f4f6; }
          .container { max-width: 100mm; min-height: 148mm; margin: 20px auto; background: #fff; padding: 10px; box-shadow: 0 0 10px rgba(0,0,0,.1); }
          .print-button { display: inline-block; margin-bottom: 12px; padding: 10px 14px; background: #111827; color: white; text-decoration: none; border-radius: 6px; }
          .print-button:hover { opacity: 0.95; }
        </style>
      </head>
      <body>
        <div class="container">
          <a class="print-button" href="#" onclick="window.print(); return false;">Imprimir etiqueta A6</a>
          ${labelHtml}
        </div>
      </body>
    </html>
  `);
});

// Endpoint para verificar el estado del pago
app.get('/api/test-email', async (req, res) => {
  try {
    await sendEmailNotification(
      'Teste de Email - Perfume Glamour',
      '<h2>Teste de Configuração SMTP</h2><p>Este é um email de teste para verificar se a configuração SMTP está funcionando.</p>',
      emailRecipient
    );
    res.json({ message: 'Email de teste enviado com sucesso.' });
  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
    res.status(500).json({ error: 'Erro ao enviar email de teste.' });
  }
});

// Endpoint temporal para probar envío a cliente
app.post('/api/test-customer-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido.' });
    }

    const testHtml = `
      <h2>Teste de Email para Cliente</h2>
      <p>Este é um email de teste enviado para: ${email}</p>
      <p>Se você recebeu este email, significa que os emails para clientes estão funcionando.</p>
    `;

    await sendEmailNotification(
      'Teste de Email Cliente - Perfume Glamour',
      testHtml,
      email
    );

    res.json({ message: `Email de teste enviado para ${email}.` });
  } catch (error) {
    console.error('Erro ao enviar email de teste para cliente:', error);
    res.status(500).json({ error: `Erro ao enviar email de teste: ${error.message}` });
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event = null;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.client_reference_id;
    if (orderId && ordersStore[orderId]) {
      await updateOrderStatus(orderId, 'Pago', { stripeSessionId: session.id, paymentUrl: session.url, paidAt: new Date().toLocaleString('pt-BR') });
      console.log(`Orden ${orderId} marcada como pago desde webhook.`);
    }
  }

  res.json({ received: true });
});

// === ENDPOINTS DE GESTIÓN DE PEDIDOS ===

// Eliminar pedido
app.delete('/api/orders/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;

    if (!ordersStore[orderId]) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    delete ordersStore[orderId];
    saveOrders(ordersStore);

    console.log(`Pedido ${orderId} eliminado.`);
    res.json({ message: 'Pedido eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Cancelar pedido
app.post('/api/orders/:orderId/cancel', (req, res) => {
  try {
    const { orderId } = req.params;

    if (!ordersStore[orderId]) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const order = ordersStore[orderId];

    // Solo permitir cancelar si no está pagado o completado
    if (order.status.toLowerCase().includes('pago') || order.status.toLowerCase().includes('completado')) {
      return res.status(400).json({ error: 'No se puede cancelar un pedido pagado o completado.' });
    }

    order.status = 'Cancelado';
    ordersStore[orderId] = order;
    saveOrders(ordersStore);

    console.log(`Pedido ${orderId} cancelado.`);
    res.json({ message: 'Pedido cancelado exitosamente.', order });
  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Completar pedido
app.post('/api/orders/:orderId/complete', (req, res) => {
  try {
    const { orderId } = req.params;

    if (!ordersStore[orderId]) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const order = ordersStore[orderId];

    // Solo permitir completar si está pagado
    if (!order.status.toLowerCase().includes('pago')) {
      return res.status(400).json({ error: 'Solo se pueden completar pedidos pagados.' });
    }

    order.status = 'Completado';
    ordersStore[orderId] = order;
    saveOrders(ordersStore);

    console.log(`Pedido ${orderId} completado.`);
    res.json({ message: 'Pedido completado exitosamente.', order });
  } catch (error) {
    console.error('Error al completar pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Reenviar confirmación
app.post('/api/orders/:orderId/resend-confirmation', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!ordersStore[orderId]) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const order = ordersStore[orderId];

    // Solo permitir reenviar si está pagado
    if (!order.status.toLowerCase().includes('pago')) {
      return res.status(400).json({ error: 'Solo se pueden reenviar confirmaciones de pedidos pagados.' });
    }

    // Usar el sistema de notificaciones
    const notificationType = order.cliente.telefone ? 'both' : 'email';
    await sendNotification(order, notificationType);

    console.log(`Confirmación reenviada para pedido ${orderId}.`);
    res.json({ message: 'Confirmación reenviada exitosamente.' });
  } catch (error) {
    console.error('Error al reenviar confirmación:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`⚠️ Puerto ${port} en uso. Intentando puerto ${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error('Error al iniciar el servidor:', error);
      process.exit(1);
    }
  });
};

startServer(PORT);
