const fs = require('fs');
const path = require('path');

// Archivo de productos
const PRODUCTS_FILE = 'products-manager.json';

// Cargar productos
function loadProducts() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error al cargar productos:', error.message);
  }
  return [];
}

// Guardar productos
function saveProducts(products) {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log('✅ Productos guardados correctamente');
  } catch (error) {
    console.error('❌ Error al guardar productos:', error.message);
  }
}

// Generar ID único
function generateId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Agregar producto
function addProduct(name, category, description, price, images) {
  const products = loadProducts();

  const newProduct = {
    id: generateId(name),
    nome: name,
    categoria: category,
    descricao: description,
    preco: parseFloat(price),
    imagens: Array.isArray(images) ? images : images.split(',').map(img => img.trim())
  };

  // Verificar si ya existe
  const existingIndex = products.findIndex(p => p.id === newProduct.id);
  if (existingIndex >= 0) {
    console.log('⚠️  Producto ya existe, actualizando...');
    products[existingIndex] = newProduct;
  } else {
    products.push(newProduct);
  }

  saveProducts(products);
  console.log(`✅ Producto "${name}" agregado/actualizado`);
}

// Eliminar producto
function deleteProduct(id) {
  const products = loadProducts();
  const filtered = products.filter(p => p.id !== id);

  if (filtered.length === products.length) {
    console.log('❌ Producto no encontrado');
    return;
  }

  saveProducts(filtered);
  console.log(`✅ Producto "${id}" eliminado`);
}

// Listar productos
function listProducts() {
  const products = loadProducts();
  console.log('\n📦 PRODUCTOS ACTUALES:\n');

  products.forEach((product, index) => {
    console.log(`${index + 1}. ${product.nome}`);
    console.log(`   ID: ${product.id}`);
    console.log(`   Categoría: ${product.categoria}`);
    console.log(`   Precio: R$ ${product.preco}`);
    console.log(`   Imágenes: ${product.imagens.length}`);
    console.log(`   Descripción: ${product.descricao.substring(0, 50)}...`);
    console.log('');
  });
}

// Mostrar ayuda
function showHelp() {
  console.log(`
🛍️  GESTOR DE PRODUCTOS - PERFUME GLAMOUR

COMANDOS DISPONIBLES:

📋 LISTAR PRODUCTOS:
  node manage-products.js list

➕ AGREGAR PRODUCTO:
  node manage-products.js add "Nombre" "Categoría" "Descripción" precio "imagen1.jpg,imagen2.jpg"

🗑️  ELIMINAR PRODUCTO:
  node manage-products.js delete id-del-producto

📖 AYUDA:
  node manage-products.js help

EJEMPLOS:

node manage-products.js add "Luna Mystique" "Feminino" "Notas florais suaves" 189.90 "luna1.jpg,luna2.jpg"

node manage-products.js delete luna-mystique

node manage-products.js list
`);
}

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'add':
    if (args.length < 6) {
      console.log('❌ Uso: node manage-products.js add "Nombre" "Categoría" "Descripción" precio "imágenes"');
      process.exit(1);
    }
    addProduct(args[1], args[2], args[3], args[4], args[5]);
    break;

  case 'delete':
    if (!args[1]) {
      console.log('❌ Uso: node manage-products.js delete id-del-producto');
      process.exit(1);
    }
    deleteProduct(args[1]);
    break;

  case 'list':
    listProducts();
    break;

  case 'help':
  default:
    showHelp();
    break;
}