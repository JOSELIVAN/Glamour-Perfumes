# 🛍️ Sistema de Gestión de Productos - Perfume Glamour

## 📋 Descripción
Sistema simplificado para gestionar productos de la tienda de perfumes. Ahora puedes administrar productos fácilmente desde la línea de comandos o editando directamente el archivo JSON.

## 🚀 Cómo Usar

### Opción 1: Gestión desde Línea de Comandos (Recomendado)

#### Listar productos actuales:
```bash
node manage-products.js list
```

#### Agregar un nuevo producto:
```bash
node manage-products.js add "Nombre del Producto" "Categoría" "Descripción" precio "imagen1.jpg,imagen2.jpg"
```

**Ejemplo:**
```bash
node manage-products.js add "Luna Mystique" "Feminino" "Notas florais suaves e envolventes" 189.90 "luna1.jpg,luna2.jpg"
```

#### Eliminar un producto:
```bash
node manage-products.js delete id-del-producto
```

**Ejemplo:**
```bash
node manage-products.js delete luna-mystique
```

#### Ver ayuda:
```bash
node manage-products.js help
```

### Opción 2: Edición Directa del Archivo JSON

1. Abre el archivo `products-manager.json`
2. Edita los productos directamente en formato JSON
3. Guarda el archivo
4. Reinicia el servidor

**Formato del producto:**
```json
{
  "id": "id-unico",
  "nome": "Nombre del Producto",
  "categoria": "Feminino/Masculino/Unissex",
  "descricao": "Descripción detallada",
  "preco": 199.90,
  "imagens": ["imagen1.jpg", "imagen2.jpg"]
}
```

## 📁 Estructura de Archivos

- `products-manager.json` - Archivo principal de productos
- `manage-products.js` - Script de gestión desde línea de comandos
- `server.js` - Servidor (modificado para usar products-manager.json)
- `app.js` - Interfaz web (modificado para cargar desde products-manager.json)

## 🔧 Funcionalidades

✅ **Agregar productos** desde línea de comandos
✅ **Editar productos** editando directamente el JSON
✅ **Eliminar productos** desde línea de comandos
✅ **Listar productos** con detalles completos
✅ **Sincronización automática** con la interfaz web
✅ **IDs automáticos** generados desde el nombre

## 🎨 Cambios en la Interfaz

- **Botones más elegantes**: Nuevo diseño con gradientes suaves y efectos hover mejorados
- **Grid de 4 productos**: Distribución óptima en el espacio disponible
- **Sistema de gestión simplificado**: Menos clics, más eficiencia

## 🚀 Inicio Rápido

1. **Agregar productos de ejemplo:**
```bash
node manage-products.js add "Rose Garden" "Feminino" "Notas florais de rosa e jasmim" 159.90 "rose1.jpg,rose2.jpg"
node manage-products.js add "Ocean Breeze" "Masculino" "Fragrância fresca e cítrica" 179.90 "ocean1.jpg,ocean2.jpg"
```

2. **Iniciar el servidor:**
```bash
npm start
# o
node server.js
```

3. **Acceder a la tienda:**
Abre http://localhost:5500 en tu navegador

## 📝 Notas Importantes

- Los IDs se generan automáticamente desde el nombre del producto
- Las imágenes pueden ser URLs externas o archivos locales en la carpeta `img/`
- Los cambios se sincronizan automáticamente entre el archivo JSON y la interfaz web
- El sistema mantiene compatibilidad con el panel de administración web existente