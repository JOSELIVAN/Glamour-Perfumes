# 🌹 Perfume Glamour - Cloud Edition (Firebase)

Uma loja premium de perfumes totalmente na nuvem com Firebase, desenvolvida com HTML, CSS, React e Firebase Functions.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────┐
│  Firebase Hosting (Frontend)                │
│  - index.html, app.js, styles.css          │
│  - React 18 - Sem build necessário         │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Firebase Functions (Backend API)           │
│  - /api/products                           │
│  - /api/orders                             │
│  - /api/admin                              │
│  - /webhook (Stripe)                       │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Firestore Database                         │
│  ├── collections/products                  │
│  ├── collections/orders                    │
│  └── collections/categories                │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Cloud Storage (Imágenes)                   │
│  └── gs://glamour-perfumes/img/            │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  External Services                          │
│  ├── Stripe (Pagos)                         │
│  ├── Nodemailer (Email)                     │
│  └── Twilio (SMS)                           │
└──────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Pré-requisitos
- Node.js 18+
- Conta Firebase (cria em https://firebase.google.com)
- Firebase CLI: `npm install -g firebase-tools`

### 2. Clonar e instalar

```bash
cd perfume
npm install
cd functions && npm install && cd ..
```

### 3. Configurar Firebase

```bash
firebase init
# Selecciona: Firestore, Functions, Hosting, Storage, Emulators
```

### 4. Configurar variables de entorno

Crea `.env` en raíz y `functions/.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_...
ADMIN_USER=admin
ADMIN_PASSWORD=tu-password-segura
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
```

### 5. Migrar datos existentes

```bash
# Descarga credenciales de Firebase y guarda como serviceAccountKey.json
node migrate-to-firestore.js
```

### 6. Ejecutar localmente

```bash
firebase emulators:start
# Accede a http://localhost:5000
```

### 7. Desplegar a producción

```bash
firebase deploy
```

## 📋 Funcionalidades

### 🛍️ Tienda
- ✅ Catálogo dinámico desde Firestore
- ✅ Búsqueda y filtrado de productos
- ✅ Imágenes desde Cloud Storage
- ✅ Carrito de compras con sincronización

### 💳 Checkout
- ✅ Pagamento con Pix (QR Code)
- ✅ Stripe Checkout (cartão/boleto)
- ✅ Múltiples opciones de pago
- ✅ Validación de CEP automática

### 👨‍💼 Panel Admin
- ✅ Login seguro
- ✅ Gestión de productos (CRUD)
- ✅ Visualizar órdenes
- ✅ Editar estados de pedidos
- ✅ Galerería de imágenes desde Storage

### 📧 Notificaciones
- ✅ Email de confirmación
- ✅ SMS de pedido (Twilio)
- ✅ Etiqueta de envío personalizada
- ✅ Notificaciones a administrador

## 🔐 Seguridad

### Firestore Rules
- Lectura pública de productos
- Órdenes protegidas con validación
- Escritura solo via Functions

### Storage Rules
- Imágenes públicas (lectura)
- Upload solo por admin

### Firebase Security
- Variables de entorno cifradas
- No exponemos claves en frontend
- Webhook de Stripe verificado

## 📁 Estructura

```
perfume/
├── index.html                  # HTML principal
├── app.js                      # React App
├── styles.css                  # Estilos
├── firebase.json               # Config Firebase
├── firestore.rules             # Reglas DB
├── storage.rules               # Reglas Storage
├── FIREBASE-DEPLOY.md          # Guía completa
├── migrate-to-firestore.js     # Script migración
└── functions/
    ├── index.js                # Código Functions
    ├── package.json            # Dependencies
    └── .env.example            # Variables plantilla
```

## 🌐 URLs después del Deploy

| Servicio | URL |
|----------|-----|
| Frontend | https://glamour-perfumes.web.app |
| API | https://us-central1-glamour-perfumes.cloudfunctions.net/api |
| Firestore | https://console.firebase.google.com/project/glamour-perfumes |
| Storage | gs://glamour-perfumes.appspot.com |

## 📊 Monitoreo

```bash
# Logs en tiempo real
firebase functions:log --follow

# Estadísticas de uso
firebase console

# Uso de Firestore
firebase firestore:indexes
```

## 🐛 Troubleshooting

**"Emulators no inician"**
```bash
firebase emulators:start --import=./backup
```

**"Error de permisos en Firestore"**
- Verifica `firestore.rules`
- Login: `firebase login`

**"Imágenes no cargan"**
- Sube a Storage: `gsutil -m cp -r ./img/* gs://glamour-perfumes.appspot.com/img/`

## 📚 Documentación extra

- [Firebase Functions](https://firebase.google.com/docs/functions)
- [Firestore](https://firebase.google.com/docs/firestore)
- [Cloud Storage](https://firebase.google.com/docs/storage)
- [GUÍA COMPLETA DEPLOY](./FIREBASE-DEPLOY.md)

## 🎯 Próximas mejoras

- [ ] Autenticación con Google/Email
- [ ] Dashboard analytics avanzado
- [ ] Sistema de reseñas
- [ ] Recomendaciones con ML
- [ ] App móvil con React Native

---

**Versión:** 2.0.0 (Cloud)  
**Última actualización:** 16 de abril de 2026
