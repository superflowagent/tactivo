# PocketBase API Rules — Tactivo

**Resumen**: reglas y snippets para configurar las **API Rules** en PocketBase. Enfoca en **aislamiento por company**, control por **roles** y evitar operaciones administrativas desde clientes.

---


## Convenciones
- `@request.auth.id != ""` → usuario autenticado
- `@request.auth.company` → company del usuario autenticado
- `@request.auth.role` → rol del usuario autenticado
- `company` → campo en los registros que indica la company propietaria

---

## Collection: users

Campos relevantes
- `role`: "client" | "professional"
- `company`: ID de la compañía (relación)

Reglas recomendadas
- List / Search: `@request.auth.id != "" && @request.auth.company = company`
- View:           `@request.auth.id != "" && @request.auth.company = company`
- Create:         `@request.auth.id != "" && @request.auth.role = "professional" && @request.body.company = @request.auth.company`
- Update:         `(@request.auth.id = id) || (@request.auth.company = company && @request.auth.role = "professional" && role = "client")`
- Delete:         `@request.auth.id != "" && @request.auth.company = company && @request.auth.role = "professional" && role = "client"`

Notas: los profesionales pueden crear clientes y otros profesionales pero siempre forzando su `company`.

---

## Collection: events

Campos relevantes
- `type`: "appointment" | "class" | "vacation"
- `company`, `client[]`, `professional[]`

Reglas recomendadas
- List / Search / View: `@request.auth.id != "" && @request.auth.company = company`
- Create: `@request.auth.id != "" && @request.auth.role = "professional" && @request.body.company = @request.auth.company`
- Update / Delete: `@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company`

---

## Collection: classes_template

Descripción breve
Template de clases semanales (slots) que se propagan al calendario. Campos esenciales: `datetime`, `duration`, `client[]`, `professional[]`, `company`, `notes`.

Reglas recomendadas (List/View/Create/Update/Delete):
`@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company`

---

## Collection: companies

Notas rápidas
- NO permitir crear/eliminar companies desde la app (solo panel admin)
- List/View: `@request.auth.id != "" && @request.auth.company = id`
- Update: `@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = id`

---

## Collection: exercises

Propósito
Biblioteca de ejercicios por company. Campos: `name`, `description`, `file`, `anatomy[]`, `equipment[]`, `company`.

Reglas recomendadas
- List/View: `@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company`
- Create/Update/Delete: `@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company`

Validaciones recomendadas en frontend
- `name` no vacío
- `anatomy.length > 0` y `equipment.length > 0`
- Todas las relaciones pertenecen a la misma company

---

## Collection: anatomy

Propósito
Articulaciones/grupos musculares (únicos por company). Reglas: `@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company` para List/View/Create/Update/Delete

---

## Collection: equipment

Propósito
Equipamiento por company. Reglas: `@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company` para List/View/Create/Update/Delete

---

## Implementación y pruebas
1. Accede a `https://pocketbase.superflow.es/_/` → pestaña "API Rules" por collection
2. Copia/pega las reglas recomendadas
3. Test: crea dos companies y prueba accesos cruzados, creación con company distinta, eliminar profesionales, etc.

---

## Resumen de seguridad
- Aislamiento por company y control de roles son el eje principal
- Validar `@request.auth.company` en todas las operaciones críticas
- Evitar operaciones admin desde la app

---

(Archivo limpiado y resumido — si quieres puedo generar una versión `compact` en `docs/` o agregar ejemplos concretos de reglas por collection)

---

## ✉️ Plantilla de email: restablecer contraseña

Las plantillas de correo se gestionan directamente desde la interfaz de administración de PocketBase (Settings → Mail → Templates → Request password reset).

> Nota: anteriormente incluyeron un script (`scripts/set-pocketbase-email-reset.mjs`) para actualizar la plantilla automáticamente y enviar un email de prueba; se ha eliminado del repositorio para evitar duplicidad con la gestión manual en PocketBase.

### Recomendación
PocketBase expone las variables `{APP_URL}` y `{TOKEN}` en la plantilla de restablecimiento. Para garantizar que el enlace llegue al frontend de Tactivo con el token, construye la URL explícitamente con esas variables.

### Ejemplo (HTML)
```html
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111;">
    <h2>Hola {RECORD:name},</h2>
    <p>Pulsa el botón de abajo para establecer una nueva contraseña:</p>
    <p>
      <a href="{APP_URL}/auth/password-reset/{TOKEN}" style="background-color:#3c83f6;display:inline-block;padding:10px 18px;border-radius:8px;color:#fff;text-decoration:none;font-weight:600;">Restablecer contraseña</a>
    </p>
    <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
    <small>{APP_URL}/auth/password-reset/{TOKEN}</small>
  </body>
</html>
```

### Ejemplo (Texto plano)
```
Hola {RECORD:name},

Recibimos una solicitud para restablecer tu contraseña. Usa este enlace:

{APP_URL}/auth/password-reset/{TOKEN}

Si no solicitaste este cambio, puedes ignorar este email.

Saludos,
El equipo de Tactivo
```

### Notas
- Asegúrate de que `{APP_URL}` apunte a la URL pública de tu frontend (ej. `https://app.tactivo.es`). Si PocketBase no la tiene configurada, el enlace quedará vacío.
- En la app el route para reset es `/auth/password-reset/:token` y la vista ya acepta ese `:token` y llama a `pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)`.
- Prueba enviando un reset real o usa la opción de envío de prueba en PocketBase para verificar que el enlace funciona.

---

## ⚙️ Collection: `equipment`

**CollectionId:** `pbc_3071488795`

### Descripción:
Equipamiento necesario para realizar ejercicios. Cada company define su propio equipamiento (mancuernas, barra, máquinas, etc.). Los profesionales pueden crear y administrar equipamiento de su company.

### Campos:
- `name` (text, required, unique per company) - "Mancuernas", "Barra", "Máquina", "Cuerpo libre", etc.
- `description` (text, optional) - Descripción del equipo
- `company` (relation to companies, required) - Multi-tenancy
- `created/updated` (auto)

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Solo profesionales pueden ver equipamiento de su company
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**View Rule:**
```javascript
// Solo profesionales pueden ver equipamiento de su company
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**Create Rule:**
```javascript
// Profesionales crean equipamiento para su company (inline durante creación de ejercicio)
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
// Profesionales pueden editar equipamiento de su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
// Profesionales pueden eliminar equipamiento de su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

## 📝 Notas Importantes

- **El filtrado en el frontend es para UX**, las reglas de backend son para seguridad
- **Siempre usa `@request.auth.company`** en las reglas para asegurar el aislamiento
- **No permitas operaciones de admin** (crear/eliminar companies) desde la app
- **Valida siempre** que `@request.data.company = @request.auth.company` al crear registros

---

## 🎯 Implementación del Sistema de Ejercicios

### Flujo de Creación Inline (Anatomy/Equipment)

Cuando un profesional crea un ejercicio y busca una anatomía/equipo que no existe:

1. **Usuario escribe**: "rodilla" en el campo de anatomy
2. **Sistema busca**: En la lista filtrada de anatomy de su company
3. **Si no existe**: Muestra opción "✨ Crear 'rodilla'"
4. **Al click**: 
   - Crea `anatomy { name: "rodilla", company: authUser.company }`
   - **Inmediatamente asigna** a la lista del ejercicio
   - Sin necesidad de modal ni confirmación
5. **Usuario continúa**: Puede seguir añadiendo más anatomías/equipos

### Validación en Frontend

Al crear/editar ejercicios:
- ✅ Validar que `anatomy.length > 0` (al menos una)
- ✅ Validar que `equipment.length > 0` (al menos una)
- ✅ Validar que `name` no esté vacío
- ✅ Validar que todas las anatomías/equipos pertenecen a la company del usuario

### Permisos Resumidos

| Operación | Profesional | Cliente | Admin |
|-----------|-----------|---------|-------|
| Ver exercises | Sí (su company) | No | Sí (todas) |
| Crear exercise | Sí | No | Sí |
| Editar exercise | Sí (su company) | No | Sí |
| Eliminar exercise | Sí (su company) | No | Sí |
| Ver anatomy | Sí (su company) | No | Sí |
| Crear anatomy | Sí (inline) | No | Sí |
| Ver equipment | Sí (su company) | No | Sí |
| Crear equipment | Sí (inline) | No | Sí |
