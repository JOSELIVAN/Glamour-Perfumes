#!/usr/bin/env node
/**
 * Script para migrar datos locales a Firestore
 * Uso: node migrate-to-firestore.js
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Archivo de credenciales no encontrado:', serviceAccountPath);
  console.log('Descárgalo de: https://console.firebase.google.com/project/glamour-perfumes/settings/serviceaccounts/adminsdk');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'glamour-perfumes.appspot.com'
});

const db = admin.firestore();

// Funciones de migración
async function migrateProducts() {
  console.log('📦 Migrando productos...');
  
  const productsFile = './products-manager.json';
  if (!fs.existsSync(productsFile)) {
    console.warn('⚠️ products-manager.json no encontrado');
    return;
  }

  const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
  const batch = db.batch();

  products.forEach((product, index) => {
    const docRef = db.collection('products').doc(product.id || `product-${index}`);
    batch.set(docRef, product);
  });

  await batch.commit();
  console.log(`✅ ${products.length} productos migrados`);
}

async function migrateOrders() {
  console.log('📋 Migrando órdenes...');
  
  const ordersFile = './orders.json';
  if (!fs.existsSync(ordersFile)) {
    console.warn('⚠️ orders.json no encontrado');
    return;
  }

  const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  const batch = db.batch();

  Object.entries(ordersData).forEach(([orderId, order]) => {
    const docRef = db.collection('orders').doc(orderId);
    batch.set(docRef, {
      ...order,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  console.log(`✅ ${Object.keys(ordersData).length} órdenes migradas`);
}

async function uploadImages() {
  console.log('🖼️ Subiendo imágenes...');
  
  const imgDir = './img';
  if (!fs.existsSync(imgDir)) {
    console.warn('⚠️ Carpeta img/ no encontrada');
    return;
  }

  const bucket = admin.storage().bucket();
  const files = fs.readdirSync(imgDir);
  let uploadedCount = 0;

  for (const file of files) {
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) continue;
    
    const filePath = path.join(imgDir, file);
    try {
      await bucket.upload(filePath, {
        destination: `img/${file}`,
        metadata: { cacheControl: 'public, max-age=86400' }
      });
      uploadedCount++;
    } catch (err) {
      console.warn(`⚠️ Error subiendo ${file}:`, err.message);
    }
  }

  console.log(`✅ ${uploadedCount} imágenes subidas`);
}

// Ejecutar migración
(async () => {
  try {
    await migrateProducts();
    await migrateOrders();
    await uploadImages();
    
    console.log('\n✅ ¡Migración completada!');
    console.log('Ahora ejecuta: firebase deploy');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante migración:', error);
    process.exit(1);
  }
})();
