# EPAS - Tablero de Cobranza (prueba inicial)

Esta versión está adaptada al archivo `Para Tablero EPAS.xlsx` sin exigir cambios de estructura.

## Publicar en GitHub Pages
1. Crear un repositorio, por ejemplo `epas-tablero`.
2. Subir `index.html`, `styles.css`, `app.js` y la carpeta `data` a la raíz.
3. En GitHub: **Settings > Pages > Deploy from a branch > main > /(root)**.

## Actualizar datos
Hay dos opciones:
- Desde el tablero, pulsar **Cargar Excel** y elegir un archivo local con la misma estructura.
- Para cambiar el archivo que abre por defecto, reemplazar `data/Para_Tablero_EPAS.xlsx` en GitHub conservando ese nombre.

## Estructura que detecta
- La primera fila debe contener `Agente de cobro`.
- Las columnas ubicadas después de `Agente de cobro` y antes de `Total General` se interpretan como localidades.
- La celda A1 se usa como período visible (por ejemplo, `AGOSTO 2026`).
- Las filas sin agente de cobro se ignoran, por lo que el total general del pie no se duplica.
