# Actualizar la landing estática (Landy)

Si necesitas actualizar la landing desde la plantilla `landy-react-template`, sigue estos pasos:

1. Clona el repo de la plantilla en un directorio temporal:

   ```bash
   git clone https://github.com/Adrinlol/landy-react-template.git landing-temp
   ```

2. Instala dependencias y genera el build:

   ```bash
   cd landing-temp
   npm install
   npm run build
   ```

3. Copia el contenido del `build/` al directorio `public/landing/dist/` en este repositorio (sobrescribiendo si es necesario).

4. Opcional: Actualiza metadatos en `public/landing/dist/index.html` (title, meta description, OG tags).

5. Commit y push a la rama correspondiente.

6. Borra el directorio temporal `landing-temp`.

> Nota: También puedes automatizar este flujo con un script Node si lo prefieres.