# 🚀 Guía de Deploy a Firebase - Perfume Glamour

## Requisitos previos

1. **Cuenta Firebase**
   - Ve a https://firebase.google.com
   - Crea un proyecto nuevo llamado "glamour-perfumes"
   
2. **Google Cloud SDK**
   - Descarga desde: https://cloud.google.com/sdk/docs/install
   - Instala y configura: `gcloud init`

3. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

## Pasos para publicar

### 1. Conectar tu proyecto a Firebase

```bash
cd f:\perfume
firebase init
```

Selecciona:
- ✅ Firestore
- ✅ Functions
- ✅ Hosting
- ✅ Storage
- ✅ Emulators

Cuando pregunte por directorio, usa `.` (directorio actual)

### 2. Configurar variables de entorno

Crea `.env.local` en la raíz del proyecto:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_KEY
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@perfume-glamour.com
EMAIL_NOTIFICATION_TO=admin@perfume-glamour.com
ADMIN_USER=admin
ADMIN_PASSWORD=your-secure-password
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Configurar variables en Firebase

```bash
firebase functions:config:set stripe.secret_key="sk_test_YOUR_KEY" 
firebase functions:config:set admin.user="admin"
firebase functions:config:set admin.password="your-password"
firebase functions:config:set email.host="smtp.gmail.com"
firebase functions:config:set email.port="587"
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.pass="your-password"
```

### 4. Migrar datos a Firestore

#### Crear colección products:
```bash
firebase firestore:bulk-import products firestore-products-export.json
```

O manualmente en la consola Firebase:
1. Ve a Firestore Database
2. Crea colección `products`
3. Importa tus productos actuales

#### Crear colección orders:
```bash
firebase firestore:bulk-import orders firestore-orders-export.json
```

### 5. Subir imágenes a Storage

```bash
# Subir carpeta img/ entera
gsutil -m cp -r ./img/* gs://glamour-perfumes.appspot.com/img/
```

O manualmente:
1. Ve a Storage en consola Firebase
2. Crea carpeta "img"
3. Sube tus imágenes

### 6. Deploy

```bash
# Deploy de todo (Functions + Hosting + Firestore)
firebase deploy

# O específicamente:
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 7. Verificar Logs

```bash
firebase functions:log
```

## Estructura actual

```
perfume/
├── index.html              # Frontend
├── app.js                  # Aplicación React
├── styles.css              # CSS
├── firebase.json           # Configuración Firebase
├── firestore.rules         # Reglas Firestore
├── storage.rules           # Reglas Storage
├── functions/
│   ├── index.js            # Código de Functions
│   └── package.json        # Dependencias Functions
```

## Variables de entorno en Firebase Functions

En `functions/.env.local` (durante desarrollo):
```
STRIPE_SECRET_KEY=sk_test_xxx
ADMIN_USER=admin
ADMIN_PASSWORD=xxx
EMAIL_HOST=...
EMAIL_USER=...
EMAIL_PASS=...
```

## URLs después del deploy

- **Frontend (Hosting):** https://glamour-perfumes.web.app
- **API (Functions):** https://us-central1-glamour-perfumes.cloudfunctions.net/api
- **Firestore:** https://console.firebase.google.com/project/glamour-perfumes/firestore

## Emuladores locales (desarrollo)

```bash
firebase emulators:start

# Accede a:
# - Frontend: http://localhost:5000
# - Functions: http://localhost:5001
# - Firestore: http://localhost:8080
```

## Troubleshooting

**Error: "Insufficient permissions"**
- Verifica las reglas en `firestore.rules`
- Asegúrate de estar autenticado: `firebase login`

**Error: "No storage bucket"**
- Crea un bucket en Storage en la consola Firebase
- Vuelve a intentar

**Funciones no responden**
- Verifica: `firebase functions:log`
- Revisa variables de entorno: `firebase functions:config:get`

## Monitoreo en producción

```bash
# Ver logs en tiempo real
firebase functions:log --follow

# Ver estadísticas
firebase console
```
