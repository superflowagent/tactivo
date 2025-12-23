# Reglas de API de PocketBase - Tactivo

## Explicación General

**El filtrado por company SÍ se hace en el backend**, pero es un **filtrado en la consulta**, no en las reglas de acceso de PocketBase. 

Esto significa que:
- ✅ La aplicación envía filtros explícitos en las queries: `filter: "company = 'xyz'"`
- ✅ Esto es eficiente y funciona bien para la lógica de negocio
- ⚠️ **PERO** un usuario técnico podría saltarse estos filtros desde la consola del navegador o usando la API directamente
- 🔒 **SOLUCIÓN**: Necesitamos añadir reglas de API en PocketBase para asegurar que solo se acceda a datos de la misma company

---

## 📋 Collection: `users`

### Campos importantes:
- `role`: "client" | "professional"
- `company`: ID de la compañía (relación)

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Los profesionales solo pueden ver usuarios de su misma company
@request.auth.id != "" && @request.auth.company = company
```

**View Rule:**
```javascript
// Solo puede ver usuarios de su misma company
@request.auth.id != "" && @request.auth.company = company
```

**Create Rule:**
```javascript
// Los profesionales pueden crear clientes y otros profesionales
// pero deben asignarles su misma company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
// Puede actualizar usuarios de su company
// Profesionales pueden editar su propio perfil completamente
// Pueden editar clientes de su company
(@request.auth.id = id) || 
(@request.auth.company = company && @request.auth.role = "professional" && role = "client")
```

**Delete Rule:**
```javascript
// Solo puede eliminar clientes de su company
// Los profesionales están protegidos automáticamente por role = "client"
@request.auth.id != "" && 
@request.auth.company = company && 
@request.auth.role = "professional" && 
role = "client"
```

---

## 📅 Collection: `events`

### Campos importantes:
- `type`: "appointment" | "class" | "vacation"
- `company`: ID de la compañía (relación)
- `client`: Array de IDs de clientes
- `professional`: Array de IDs de profesionales

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Solo puede ver eventos de su company
@request.auth.id != "" && @request.auth.company = company
```

**View Rule:**
```javascript
// Solo puede ver eventos de su company
@request.auth.id != "" && @request.auth.company = company
```

**Create Rule:**
```javascript
// Los profesionales pueden crear eventos
// pero deben asignarles su misma company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
// Solo profesionales de la misma company pueden editar eventos
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
// Solo profesionales de la misma company pueden eliminar eventos
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

## �️ Collection: `classes_template`

### Descripción:
Template de clases semanales que se propagan al calendario mensualmente. Cada registro representa un slot de clase en un día específico de la semana con su configuración (profesional, clientes, duración, etc.).

### Campos importantes:
- `type`: Siempre "class"
- `datetime`: Fecha/hora que determina el día de la semana y hora
- `duration`: Duración en minutos
- `client`: Array de IDs de clientes (relación)
- `professional`: Array de IDs de profesionales (relación)
- `company`: ID de la compañía (relación)
- `notes`: Notas opcionales

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Solo puede ver slots de template de su company
@request.auth.id != "" && @request.auth.company = company
```

**View Rule:**
```javascript
// Solo puede ver slots de template de su company
@request.auth.id != "" && @request.auth.company = company
```

**Create Rule:**
```javascript
// Los profesionales pueden crear slots en el template
// pero deben asignarles su misma company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
// Solo profesionales de la misma company pueden editar slots del template
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
// Solo profesionales de la misma company pueden eliminar slots del template
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

## �🏢 Collection: `companies`

### Campos importantes:
- `name`: Nombre del centro
- `max_class_assistants`: Número máximo de asistentes
- `class_block_mins`: Minutos antes de bloquear reserva
- `class_unenroll_mins`: Minutos antes de cancelar
- `logo`: Logo del centro
- `open_time`: Hora de apertura
- `close_time`: Hora de cierre
- `default_appointment_duration`: Duración citas
- `default_class_duration`: Duración clases

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Los profesionales solo pueden ver su propia company
@request.auth.id != "" && @request.auth.company = id
```

**View Rule:**
```javascript
// Solo puede ver su propia company
@request.auth.id != "" && @request.auth.company = id
```

**Create Rule:**
```javascript
// NO permitir crear companies desde la app
// Solo desde el panel de admin
""
```

**Update Rule:**
```javascript
// Cualquier profesional de la company puede editar la configuración
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = id
```

**Delete Rule:**
```javascript
// NO permitir eliminar companies desde la app
// Solo desde el panel de admin
""
```

---

## 🔐 Resumen de Seguridad

### ✅ Lo que está protegido:

1. **Aislamiento por Company**: Las reglas aseguran que cada company solo vea sus propios datos
2. **Control de Roles**: Solo profesionales pueden crear/editar/eliminar
3. **Auto-asignación forzada**: Al crear usuarios/eventos, se valida que la company coincida
4. **Protección de cuenta**: Los profesionales no pueden eliminarse a sí mismos

### ⚠️ Consideraciones adicionales:

1. **Autenticación obligatoria**: Todas las reglas requieren `@request.auth.id != ""`
2. **Validación de company**: Las reglas verifican que `@request.auth.company = company`
3. **Expand seguro**: Cuando uses `expand`, PocketBase aplicará las reglas también a las relaciones expandidas

### 🚀 Implementación:

1. Ve al panel de admin de PocketBase: `https://pocketbase.superflow.es/_/`
2. Para cada collection, ve a la pestaña "API Rules"
3. Copia y pega las reglas correspondientes en cada campo
4. Prueba las reglas con diferentes usuarios para asegurarte de que funcionan correctamente

### 🧪 Testing recomendado:

1. Crear dos companies diferentes con profesionales diferentes
2. Intentar acceder a datos de otra company (debe fallar)
3. Intentar crear un cliente asignándole una company diferente (debe fallar)
4. Intentar que un profesional se elimine a sí mismo (debe fallar)
5. Intentar que un profesional elimine a otro profesional (debe fallar)

---

## 🏋️ Collection: `exercises`

**CollectionId:** `pbc_1804250889`

### Descripción:
Biblioteca de ejercicios disponibles para cada company. Los profesionales pueden crear, editar y eliminar ejercicios de su company. Cada ejercicio puede requerir múltiples anatomías y equipos.

### Campos:
- `name` (text, required) - "Flexiones", "Press de banca", etc.
- `description` (text, optional) - Instrucciones y forma correcta
- `file` (file, optional) - Imagen/foto del ejercicio
- `anatomy` (relation to anatomy, array, required) - Articulaciones trabajadas (múltiples)
- `equipment` (relation to equipment, array, required) - Equipamiento necesario (múltiple)
- `company` (relation to companies, required) - Multi-tenancy
- `created/updated` (auto)

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Solo profesionales pueden ver ejercicios de su company
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**View Rule:**
```javascript
// Solo profesionales pueden ver ejercicios de su company
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**Create Rule:**
```javascript
// Profesionales crean ejercicios para su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
// Profesionales pueden editar ejercicios de su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
// Profesionales pueden eliminar ejercicios de su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

## 🔬 Collection: `anatomy`

**CollectionId:** `pbc_3910054070`

### Descripción:
Articulaciones/grupos musculares que trabaja cada ejercicio. Cada company define sus propias anatomías. Los profesionales pueden crear y administrar anatomías de su company.

### Campos:
- `name` (text, required, unique per company) - "Pecho", "Hombros", "Espalda", "Rodilla", etc.
- `description` (text, optional) - Descripción detallada
- `company` (relation to companies, required) - Multi-tenancy
- `created/updated` (auto)

### Reglas de API recomendadas:

**List/Search Rule:**
```javascript
// Solo profesionales pueden ver anatomías de su company
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**View Rule:**
```javascript
// Solo profesionales pueden ver anatomías de su company
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**Create Rule:**
```javascript
// Profesionales crean anatomías para su company (inline durante creación de ejercicio)
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
// Profesionales pueden editar anatomías de su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
// Profesionales pueden eliminar anatomías de su company
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

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
