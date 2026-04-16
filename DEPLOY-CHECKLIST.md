# ✅ Migración a Firebase - Checklist Completo

## Estado: ✅ ESTRUCTURA LISTA PARA DEPLOY

Tu proyecto ya está completamente reconfigurado para Firebase. Aquí está el paso a paso exacto para publicarlo.

---

## 📌 PASO 1: Crear Proyecto Firebase (2 minutos)

1. Ve a https://console.firebase.google.com
2. Click en "Crear proyecto"
3. Nombre: **glamour-perfumes**
4. Acepta todas las opciones y espera ~3 minutos
5. Copia esta información:
   - **Project ID**: `glamour-perfumes`
   - **StorageBucket**: `glamour-perfumes.appspot.com`

---

## 📌 PASO 2: Autenticarse en Firebase (2 minutos)

```powershell
firebase login
```

Click en el link que aparezca, autoriza tu Google account y vuelve a la terminal.

Verifica que funcione:
```powershell
firebase projects:list
```

---

## 📌 PASO 3: Conectar tu proyecto local (2 minutos)

```powershell
cd f:\perfume
firebase init
```

Selecciona **solo**:
- [x] Firestore
- [x] Functions  
- [x] Hosting
- [x] Storage
- [ ] Emulators (por ahora no)

Responde así:
- "Usa la configuración existente": **Y**
- "Directorio": **.**
- "Overwrite?": **N** (no sobrescribir)

---

## 📌 PASO 4: Configurar Variables de Entorno (5 minutos)

### En tu proyecto local:

Crea archivo `functions/.env.local` con:

```env
STRIPE_SECRET_KEY=sk_test_TU_CLAVE_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_CLAVE_AQUI
ADMIN_USER=admin
ADMIN_PASSWORD=tu-password-super-segura
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password-generada
EMAIL_FROM=noreply@perfume-glamour.com
EMAIL_NOTIFICATION_TO=admin@email.com
TWILIO_ACCOUNT_SID=opcional
TWILIO_AUTH_TOKEN=opcional
TWILIO_PHONE_NUMBER=opcional
```

### En Firebase Console:

Ve a: **Project Settings > Service Accounts > Environment**

Para variables secretas, ejecuta:

```powershell
firebase functions:config:set stripe.secret_key="sk_test_YOUR_KEY"
firebase functions:config:set admin.user="admin"
firebase functions:config:set admin.password="your-password"
firebase functions:config:set email.host="smtp.gmail.com"
firebase functions:config:set email.user="your-email@gmail.com"
```

---

## 📌 PASO 5: Crear Colecciones en Firestore (3 minutos)

Ve a: **Firestore Database** en Firebase Console

### Crea 2 colecciones vacías:

1. **Collection ID**: `products`
2. **Collection ID**: `orders`

(Las limpiaremos después en el paso 7)

---

## 📌 PASO 6: Generar Credenciales de Firebase (5 minutos)

Ve a: **Project Settings > Service Accounts**

Click en "Generate new private key" y guarda como:
```
f:\perfume\serviceAccountKey.json
```

⚠️ **IMPORTANTE**: Agrega a `.gitignore`:
```
serviceAccountKey.json
functions/.env.local
.env.local
```

---

## 📌 PASO 7: Migrar Datos a Firestore (3 minutos)

```powershell
cd f:\perfume

# Instalar dependencia (solo una vez)
npm install firebase-admin

# Ejecutar migración
node migrate-to-firestore.js
```

Verifica en Firebase Console > Firestore > Collections que aparezcan tus productos.

---

## 📌 PASO 8: Subir Imágenes a Cloud Storage (5 minutos)

### Opción A: Usar Google Cloud CLI

```powershell
# Instala Cloud SDK desde:
# https://cloud.google.com/sdk/docs/install

gsutil -m cp -r ./img/* gs://glamour-perfumes.appspot.com/img/
```

### Opción B: Manualmente en Console

1. Ve a **Storage** en Firebase
2. Click en **+ Subir carpeta**
3. Selecciona tu carpeta `img/`

---

## 📌 PASO 9: Deploy a Firebase (5 minutos)

```powershell
cd f:\perfume

# Desplegar todo (Functions + Hosting + Firestore)
firebase deploy
```

Espera ~5 minutos. Verás:

```
✔ Deployed to https://glamour-perfumes.web.app
✔ Functions deployed
✔ Firestore rules deployed
✔ Storage rules deployed
```

---

## 📌 PASO 10: Verificar que funciona (2 minutos)

1. Abre: https://glamour-perfumes.web.app
2. Verifica:
   - ✅ Se cargan los productos
   - ✅ El carrito funciona
   - ✅ Login admin funciona (user: admin, password: lo-que-configuraste)
   - ✅ Puedes crear un pedido

---

## 🚨 Si algo falla:

### "Error: Firestore rules not deployed"
```powershell
firebase deploy --only firestore:rules
```

### "Imágenes no cargan"
```powershell
firebase deploy --only storage:rules
gsutil -m cp -r ./img/* gs://glamour-perfumes.appspot.com/img/
```

### "Funciones retornan 404"
```powershell
firebase functions:log
# Busca errores y ajusta variables de entorno
```

### "Permiso denegado al escribir datos"
```powershell
firebase deploy --only firestore:rules
# Verifica firestore.rules tiene los permisos correctos
```

---

## 📊 Después del Deploy

### Ver logs en tiempo real:
```powershell
firebase functions:log --follow
```

### Ver uso de Firestore:
Firebase Console > Firestore > Uso

### Dominio personalizado:
Firebase Console > Hosting > Conectar dominios

---

## 🎯 URLs Finales

| Componente | URL |
|-----------|-----|
| Sitio Web | https://glamour-perfumes.web.app |
| API REST | https://us-central1-glamour-perfumes.cloudfunctions.net/api |
| Firestore | https://console.firebase.google.com/project/glamour-perfumes/firestore |
| Storage | https://console.firebase.google.com/project/glamour-perfumes/storage |

---

## 📚 Archivos Creados

```
✅ functions/index.js           - Toda la API (15 endpoints)
✅ functions/package.json       - Dependencias Functions
✅ firebase.json                - Configuración Firebase
✅ firestore.rules              - Reglas de seguridad Firestore
✅ storage.rules                - Reglas de seguridad Storage
✅ migrate-to-firestore.js      - Script migración datos
✅ FIREBASE-DEPLOY.md           - Documentación completa
✅ README-FIREBASE.md           - Resumen arquitectura
✅ .env.example                 - Plantilla variables
```

---

## ⏱️ Tiempo Total: ~30 minutos

✔️ Estructura completa  
✔️ Código migrado  
✔️ Reglas de seguridad  
✔️ Scripts de migración  

**¡Listo para publicar a la nube!** 🚀

---

**Próximo paso**: Sigue el PASO 1 para crear tu proyecto Firebase.

¿Dudas? Revisa: https://firebase.google.com/docs
