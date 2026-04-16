const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Inicializar Express
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Variables de configuración
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';

// ============ CONFIGURACIÓN DE EMAIL ============
const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined,
  secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: process.env.EMAIL_PORT === '587' ? { rejectUnauthorized: false } : undefined,
};

const emailEnabled = emailConfig.host && emailConfig.port && emailConfig.auth.user && emailConfig.auth.pass;
const transporter = emailEnabled ? nodemailer.createTransport(emailConfig) : null;
const emailRecipient = process.env.EMAIL_NOTIFICATION_TO?.split(',')[0]?.trim() || process.env.EMAIL_USER;

// ============ CONFIGURACIÓN DE SMS ============
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioClient = (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) 
  ? twilio(twilioAccountSid, twilioAuthToken) 
  : null;
const smsEnabled = !!twilioClient;

// ============ HELPERS ============
const sendEmailNotification = async (subject, html, recipient) => {
  if (!emailEnabled || !transporter) return;
  if (!recipient) return;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || emailConfig.auth.user,
      to: recipient,
      subject,
      html,
    });
    console.log('✅ Email enviado:', subject);
  } catch (error) {
    console.error('❌ Error al enviar email:', error.message);
  }
};

const sendSMSNotification = async (message, phoneNumber) => {
  if (!smsEnabled || !twilioClient) return;
  if (!phoneNumber) return;
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+55${phoneNumber.replace(/\D/g, '')}`;
    await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedPhone
    });
    console.log(`✅ SMS enviado a ${formattedPhone}`);
  } catch (error) {
    console.error(`❌ Error al enviar SMS:`, error.message);
  }
};

// ============ ENDPOINTS: PRODUCTOS ============
app.get('/api/products', async (req, res) => {
  try {
    const snapshot = await db.collection('products').get();
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    res.json(products);
  } catch (error) {
    console.error('Error al cargar productos:', error);
    res.status(500).json({ error: 'Error al cargar productos' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const products = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Se espera un array de productos.' });
    }

    // Limpiar colleción actual y agregar nuevos
    const batch = db.batch();
    const snapshot = await db.collection('products').get();
    snapshot.forEach(doc => batch.delete(doc.ref));

    products.forEach((product, index) => {
      const docRef = db.collection('products').doc(product.id || `product-${index}`);
      batch.set(docRef, product);
    });

    await batch.commit();
    res.json({ ok: true });
  } catch (error) {
    console.error('Error al guardar productos:', error);
    res.status(500).json({ error: 'Error al guardar productos' });
  }
});

// ============ ENDPOINTS: ÓRDENES ============
app.get('/api/order-status', async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) {
      return res.status(400).json({ error: 'order_id es requerido.' });
    }

    const doc = await db.collection('orders').doc(order_id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/api/order-by-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido.' });
    }

    const snapshot = await db.collection('orders')
      .where('stripeSessionId', '==', session_id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Pedido no encontrado para esta sesión.' });
    }

    const doc = snapshot.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/register-order', async (req, res) => {
  try {
    const { cliente, itens, total, metodoPagamento, parcelas, chavePix, qrCode, stripeSessionId, paymentUrl } = req.body;
    
    if (!cliente || !itens || typeof total !== 'number' || !metodoPagamento) {
      return res.status(400).json({ error: 'Datos de pedido incompletos.' });
    }

    const orderId = `PED-${Date.now()}`;
    const order = {
      id: orderId,
      cliente,
      itens,
      total,
      metodoPagamento,
      parcelas: parcelas || 1,
      status: metodoPagamento === 'pix' ? 'Aguardando Pagamento Pix' : 'Aguardando Pagamento',
      fecha: new Date().toLocaleString('pt-BR'),
      chavePix: chavePix || null,
      qrCode: qrCode || null,
      stripeSessionId: stripeSessionId || null,
      paymentUrl: paymentUrl || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('orders').doc(orderId).set(order);
    res.json({ orderId });
  } catch (error) {
    console.error('Error al registrar orden:', error);
    res.status(500).json({ error: 'Error al registrar pedido.' });
  }
});

app.post('/api/confirm-pix', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ error: 'order_id es requerido.' });
    }

    const doc = await db.collection('orders').doc(order_id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    await db.collection('orders').doc(order_id).update({
      status: 'Pago',
      paidAt: new Date().toLocaleString('pt-BR')
    });

    const order = (await db.collection('orders').doc(order_id).get()).data();
    res.json({ id: order_id, ...order });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al confirmar pago.' });
  }
});

app.post('/api/confirm-stripe-payment', async (req, res) => {
  try {
    const { session_id, order_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido.' });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });
    } catch (stripeError) {
      console.error('Error Stripe:', stripeError.message);
      return res.status(500).json({ error: 'No se pudo recuperar la sesión Stripe.' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: `Pago Stripe no confirmado aún. Estado: ${session.payment_status}` });
    }

    let orderId = order_id;
    if (!orderId && session_id) {
      const snapshot = await db.collection('orders')
        .where('stripeSessionId', '==', session_id)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        orderId = snapshot.docs[0].id;
      }
    }

    if (!orderId) {
      return res.status(404).json({ error: 'Pedido no encontrado para esta sesión.' });
    }

    await db.collection('orders').doc(orderId).update({
      status: 'Pago',
      stripeSessionId: session_id,
      paidAt: new Date().toLocaleString('pt-BR')
    });

    const order = (await db.collection('orders').doc(orderId).get()).data();
    res.json({ id: orderId, ...order });
  } catch (error) {
    console.error('Error confirm Stripe:', error);
    res.status(500).json({ error: 'Error al confirmar pago.' });
  }
});

// ============ ENDPOINTS: ADMIN ============
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

app.get('/api/admin/assets', async (req, res) => {
  try {
    const [files] = await bucket.getFiles({ prefix: 'img/' });
    const fileNames = files.map(f => f.name.replace('img/', '')).filter(Boolean);
    res.json({ files: fileNames });
  } catch (error) {
    console.error('Error listing assets:', error);
    res.status(500).json({ error: 'No se pudieron listar los archivos.' });
  }
});

// ============ STRIPE WEBHOOK ============
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
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.client_reference_id;
    if (orderId) {
      const doc = await db.collection('orders').doc(orderId).get();
      if (doc.exists) {
        await db.collection('orders').doc(orderId).update({
          status: 'Pago',
          stripeSessionId: session.id,
          paidAt: new Date().toLocaleString('pt-BR')
        });
        console.log(`Orden ${orderId} marcada como pago desde webhook.`);
      }
    }
  }

  res.json({ received: true });
});

// ============ OTROS ENDPOINTS ============
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'API funcionando' });
});

app.post('/api/test-email', async (req, res) => {
  try {
    await sendEmailNotification(
      'Teste de Email',
      '<h2>Teste de configuración SMTP</h2>',
      emailRecipient
    );
    res.json({ message: 'Email de teste enviado.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar email.' });
  }
});

// ============ EXPORTAR FUNCIÓN ============
exports.api = functions.https.onRequest(app);
