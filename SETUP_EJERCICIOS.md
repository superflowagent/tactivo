# 📋 Checklist de Configuración de PocketBase para Sistema de Ejercicios

## Paso 1: Crear las Colecciones

Estas colecciones ya existen en tu PocketBase:
- ✅ `exercises` (collectionId: `pbc_1804250889`)
- ✅ `anatomy` (collectionId: `pbc_3910054070`)
- ✅ `equipment` (collectionId: `pbc_3071488795`)

## Paso 2: Aplicar Reglas de API en PocketBase Admin

Ve a `https://pocketbase.superflow.es/_/` y aplica estas reglas en cada colección.

### Para Colección: `exercises`

Ve a: **Colecciones > exercises > API Rules**

**List Rule:**
```javascript
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**View Rule:**
```javascript
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**Create Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

### Para Colección: `anatomy`

Ve a: **Colecciones > anatomy > API Rules**

**List Rule:**
```javascript
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**View Rule:**
```javascript
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**Create Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

### Para Colección: `equipment`

Ve a: **Colecciones > equipment > API Rules**

**List Rule:**
```javascript
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**View Rule:**
```javascript
@request.auth.id != "" && @request.auth.role = "professional" && @request.auth.company = company
```

**Create Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.body.company = @request.auth.company
```

**Update Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

**Delete Rule:**
```javascript
@request.auth.id != "" && 
@request.auth.role = "professional" && 
@request.auth.company = company
```

---

## Paso 3: Verificar en la App

1. ✅ La vista "Ejercicios" está integrada en el menú lateral
2. ✅ El componente `EjerciciosView` carga correctamente
3. ✅ El diálogo `ExerciseDialog` permite crear/editar/eliminar ejercicios
4. ✅ Inline creation de anatomy/equipment funciona (opción "Crear [término]")
5. ✅ Los filtros por anatomía y equipamiento usan lógica OR
6. ✅ Búsqueda por nombre y descripción

## Testing Manual

Después de aplicar las reglas en PocketBase:

1. **Crear una anatomía:**
   - Ve a Ejercicios > Crear Ejercicio
   - En campo "Anatomía", escribe "Pecho"
   - Click en "✨ Crear 'Pecho'"
   - Debe crear y asignar instantáneamente

2. **Crear un ejercicio:**
   - Nombre: "Flexiones"
   - Descripción: "Ejercicio de peso corporal"
   - Anatomía: Selecciona "Pecho"
   - Equipamiento: Crea "Cuerpo libre"
   - Sube una imagen
   - Click en "Crear"

3. **Filtrar ejercicios:**
   - En filtros, selecciona "Pecho" (anatomía)
   - Debe mostrar solo ejercicios que trabajen pecho

4. **Búsqueda:**
   - Escribe "flexiones" en búsqueda
   - Debe encontrar el ejercicio

5. **Editar:**
   - Click en botón "Editar" de un ejercicio
   - Modifica datos
   - Click en "Actualizar"

6. **Eliminar:**
   - Click en botón "Eliminar"
   - Confirma en diálogo
   - Debe desaparecer de la lista

---

## Notas Importantes

- **Multi-tenancy:** Todos los queries filtran automáticamente por `company = authUser.company`
- **Inline Creation:** Cuando un profesional busca una anatomía/equipamiento que no existe, puede crearla sin salir del diálogo
- **Filtros OR:** Si selecciona múltiples anatomías, se muestran ejercicios que tengan CUALQUIERA de ellas
- **Permisos:** Solo profesionales pueden ver/crear/editar/eliminar ejercicios de su company
- **Clients:** No tienen acceso a la sección de ejercicios (protegido en AuthContext)

---

## Archivos Creados/Modificados

### ✅ Nuevos Componentes:
- `src/components/views/EjerciciosView.tsx` - Galería de tarjetas con filtros
- `src/components/ejercicios/ExerciseDialog.tsx` - CRUD de ejercicios con inline creation
- `src/components/ui/badge.tsx` - Componente Badge para anatomías/equipamiento

### ✅ Actualizados:
- `POCKETBASE_RULES.md` - Agregadas reglas y schemas para exercises/anatomy/equipment
- `Panel.tsx` - Ya incluye navegación a EjerciciosView
- `app-sidebar.tsx` - Ya incluye "Ejercicios" en el menú

### ✅ Sin Cambios Necesarios:
- `App.tsx` - ViewType ya incluye "ejercicios"
- `AuthContext.tsx` - Ya filtra por role="professional"
