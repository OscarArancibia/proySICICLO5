# 🎓 EduGestión — Sistema de Información Educativa (SI1)

> Sistema de información integral para la gestión académica, financiera, control de inventarios y seguridad estudiantil de la **Unidad Educativa Fausto Medrano Sandoval "A"**.

Proyecto compuesto por un **Backend** (Node.js + Express + PostgreSQL) y un **Frontend** (Next.js 15 + shadcn/ui), desarrollado como proyecto final de la materia **Sistemas de Información I**.

---

## 📋 Tabla de Contenidos

- [Requisitos Previos](#-requisitos-previos)
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Variables de Entorno](#-variables-de-entorno-env)
- [Ejecución](#-ejecución)
- [Casos de Uso Implementados (Ciclo 1)](#-casos-de-uso-implementados-ciclo-1)
- [Endpoints de la API](#-endpoints-de-la-api-completos)
- [Conexión Frontend ↔ Backend](#-conexión-frontend--backend)
- [Pruebas desde PowerShell](#-pruebas-desde-powershell)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

---

## 📋 Requisitos Previos

Asegúrate de tener instalado lo siguiente en tu máquina antes de comenzar:

| Herramienta | Versión mínima | Uso |
|---|---|---|
| [Node.js](https://nodejs.org) | v16+ | Runtime del backend y frontend |
| [Docker Desktop](https://docker.com) | Última estable | Base de datos PostgreSQL |
| Git | Cualquiera | Control de versiones |
| Cliente SQL (opcional) | — | DBeaver, pgAdmin para inspección directa |

---

## 🏗️ Arquitectura del Proyecto

```
proySI_FMS/
├── backend/                     # API REST con Node.js + Express
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js            # Pool de conexión a PostgreSQL
│   │   ├── controllers/
│   │   │   ├── authController.js       # Login/Logout (CU01)
│   │   │   ├── userController.js       # CRUD usuarios (CU02)
│   │   │   ├── roleController.js       # CRUD roles (CU03)
│   │   │   ├── profesorController.js   # CRUD profesores + vincular cuenta (CU04)
│   │   │   ├── gestionController.js    # CRUD gestiones académicas (CU05)
│   │   │   ├── estructuraController.js # CRUD niveles, grados, aulas (CU06)
│   │   │   └── materiaController.js    # CRUD campos y materias (CU07)
│   │   ├── middlewares/
│   │   │   └── authMiddleware.js       # verificarToken, esAdmin, esAdminODirector
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── roleRoutes.js
│   │   │   ├── profesorRoutes.js
│   │   │   ├── gestionRoutes.js
│   │   │   ├── estructuraRoutes.js
│   │   │   └── materiaRoutes.js
│   │   └── server.js            # Punto de entrada Express
│   ├── docker-compose.yml       # PostgreSQL contenedorizado
│   ├── .env                     # Variables de entorno (NO subir a Git)
│   └── package.json
│
├── Frontend/                    # Interfaz con Next.js 15 + shadcn/ui
│   ├── app/
│   │   ├── login/page.tsx              # Pantalla de inicio de sesión
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Dashboard principal
│   │   │   ├── usuarios/
│   │   │   │   ├── page.tsx            # Gestión de usuarios (CU02)
│   │   │   │   ├── roles/page.tsx      # Gestión de roles (CU03)
│   │   │   │   └── docentes/page.tsx   # Personal docente (CU04)
│   │   │   ├── gestiones/page.tsx      # Gestiones académicas (CU05)
│   │   │   ├── aulas/page.tsx          # Niveles, grados y aulas (CU06)
│   │   │   └── materias/page.tsx       # Campos y materias (CU07)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx      # Sidebar con navegación basada en roles
│   │   │   └── header.tsx       # Header con toggle de tema dark/light
│   │   └── ui/                  # Componentes shadcn/ui
│   └── package.json
│
└── README.md                    # Este archivo
```

---

## 📥 Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd proySI_FMS
git checkout DevP
```

### 2. Instalar dependencias del Backend

```bash
cd backend
npm install
```

### 3. Instalar dependencias del Frontend

```bash
cd ../Frontend
npm install
```

### 4. Levantar la Base de Datos con Docker

Asegúrate de tener Docker Desktop abierto y ejecuta:

```bash
cd ../backend
docker-compose up -d
```

La base de datos PostgreSQL se creará como un contenedor. Conéctate con un cliente SQL (DBeaver o pgAdmin) usando las credenciales del `.env` y ejecuta el script SQL del proyecto para crear las tablas e insertar datos de prueba.

Para detener la base de datos:
```bash
docker-compose down
```

---

## 🌐 Variables de Entorno (`.env`)

Crea un archivo `.env` dentro de la carpeta `backend/` (al mismo nivel que `package.json`). **No subas este archivo a Git.**

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=proyecto_si1_db
DB_PASSWORD=admin123
DB_PORT=5432
JWT_SECRET=escribe_aqui_un_secreto_seguro_para_jwt
```

> **Nota:** El puerto por defecto del backend es `5000`. El frontend se conecta a `http://localhost:5000/api/...` para todas las peticiones.

---

## 🚀 Ejecución

Necesitas **dos terminales** abiertas simultáneamente:

### Terminal 1 — Backend (API)

```bash
cd backend
npm run dev
```
El servidor arrancará con **nodemon** en `http://localhost:5000`. Se reinicia automáticamente al detectar cambios en archivos `.js`.

### Terminal 2 — Frontend (UI)

```bash
cd Frontend
npm run dev
```
Next.js arrancará en `http://localhost:3000`. Abre esta URL en tu navegador.

### Flujo de uso

1. Abre `http://localhost:3000` → te redirige a `/login`
2. Inicia sesión con un usuario existente (ej. `admin` / contraseña configurada)
3. El sistema valida credenciales contra el backend vía `POST /api/auth/login`
4. Al autenticarse, se guarda el **token JWT** en `localStorage` y se redirige al `/dashboard`
5. Todas las peticiones del frontend adjuntan el header `Authorization: Bearer <token>`

---

## ✅ Casos de Uso Implementados (Ciclo 1)

### CU01 — Iniciar y Cerrar Sesión

| Campo | Detalle |
|---|---|
| **Frontend** | `app/login/page.tsx` |
| **Backend** | `POST /api/auth/login`, `POST /api/auth/logout` |
| **Autenticación** | JWT almacenado en `localStorage` |
| **Característica** | Login acepta **username o correo electrónico** indistintamente |

**Flujo:** El usuario ingresa su username (o email) y contraseña → el backend busca con `WHERE username = $1 OR email = $1` → si es válido, retorna token JWT + datos del rol → el frontend almacena `token`, `userRole`, `userName` en localStorage.

---

### CU02 — Gestionar Usuarios

| Campo | Detalle |
|---|---|
| **Frontend** | `app/dashboard/usuarios/page.tsx` |
| **Backend** | `GET /POST /PUT /DELETE` en `/api/users` |
| **Roles con acceso** | SuperUsuario (1) |

**Funcionalidades:**
- 📋 Tabla con todos los usuarios: username, correo, rol, fecha de creación, último acceso, estado
- ➕ Crear usuario nuevo con: `username`, `email` (obligatorio), `password`, `rol`, `estado`
- ✏️ Editar usuario: modificar username, email, rol, estado
- 🚫 Desactivar usuario (soft-delete, pone `estado = false`)
- 🔍 Validación de username y email únicos

---

### CU03 — Gestionar Roles

| Campo | Detalle |
|---|---|
| **Frontend** | `app/dashboard/usuarios/roles/page.tsx` |
| **Backend** | `GET /POST /PUT /DELETE` en `/api/roles` |
| **Roles con acceso** | SuperUsuario (1) |

**Funcionalidades:**
- 📋 Tabla con roles existentes y la cantidad de usuarios asignados a cada uno
- ➕ Crear nuevos roles
- ✏️ Editar nombre y descripción del rol

---

### CU04 — Registrar Profesor y Vincular Cuenta

| Campo | Detalle |
|---|---|
| **Frontend** | `app/dashboard/usuarios/docentes/page.tsx` |
| **Backend** | `GET /POST /PUT /PATCH` en `/api/profesores` |
| **Roles con acceso** | SuperUsuario (1), Director (2) |

**Funcionalidades:**
- 📋 Tabla de profesores con: nombre, CI, especialidad, cuenta vinculada (con estado)
- ➕ **Crear profesor** con datos personales (nombre, apellido, CI, género, profesión)
- ☑️ **Opción "Crear cuenta"**: al activar el checkbox, se despliega un formulario embebido para crear la cuenta de acceso (username, contraseña, email) con rol Docente automáticamente
- ✏️ **Editar datos personales** del profesor (nombre, apellido, CI, profesión, género)
- 🔗 **Asignar cuenta a posteriori**: para profesores que fueron registrados SIN cuenta, aparece la opción "Asignar Cuenta" en el menú de acciones. Esto abre un diálogo dedicado que crea una cuenta nueva y la vincula al profesor en una **transacción atómica**
- 🔒 Validaciones: CI duplicado, username/email en uso, profesor con cuenta ya vinculada

**Endpoint especial — Vincular cuenta:**
```
PATCH /api/profesores/:id/cuenta
Body: { username, password, email }
→ Crea usuario con id_rol=3 (Docente) y actualiza profesor.id_usuario
→ Transacción: si algo falla, se hace ROLLBACK completo
```

---

### CU05 — Gestionar Gestiones Académicas

| Campo | Detalle |
|---|---|
| **Frontend** | `app/dashboard/gestiones/page.tsx` |
| **Backend** | `GET /POST /PUT` en `/api/gestiones` |
| **Roles con acceso** | SuperUsuario (1), Director (2) |

**Funcionalidades:**
- 📋 Tabla con gestiones académicas (año, fechas, estado)
- ➕ Crear nueva gestión con año, fecha inicio, fecha fin y estado
- ✏️ Editar gestión existente
- 📊 Estados: `planificada`, `activa`, `finalizada`

---

### CU06 — Gestionar Niveles, Grados y Aulas

| Campo | Detalle |
|---|---|
| **Frontend** | `app/dashboard/aulas/page.tsx` (página con 3 tabs) |
| **Backend** | `GET /POST /PUT` en `/api/estructura/niveles`, `/grados`, `/aulas` |
| **Roles con acceso** | SuperUsuario (1), Director (2) |

La página se organiza en **3 pestañas (tabs)**:

#### Tab 1 — Niveles
- ➕ Crear nivel educativo: nombre + monto de mensualidad (Bs.)
- ✏️ Editar nombre y monto
- 🔍 Validación de nombre duplicado y monto no negativo
- Ejemplos: `Kínder (Bs. 250.00)`, `Primaria (Bs. 300.00)`

#### Tab 2 — Grados
- ➕ Crear grado vinculado a un nivel (Select dinámico con los niveles registrados)
- ✏️ Editar nombre y cambiar nivel
- Ejemplos: `1ro → Primaria`, `Kínder A → Kínder`

#### Tab 3 — Aulas
- ➕ Crear aula: número, descripción, capacidad, cantidad de mesas y sillas
- ✏️ Editar todos los datos del aula
- 🔍 Validación de número de aula duplicado

**Flujo recomendado:** Primero crear Niveles → luego Grados (necesitan un nivel) → luego Aulas.

---

### CU07 — Gestionar Campos y Materias

| Campo | Detalle |
|---|---|
| **Frontend** | `app/dashboard/materias/page.tsx` |
| **Backend** | `GET /POST /PUT` en `/api/materias` y `/api/materias/campos` |
| **Roles con acceso** | SuperUsuario (1), Director (2) |

**Funcionalidades:**
- 📋 Gestión de campos de conocimiento y materias asociadas
- ➕ Crear materias vinculadas a un campo
- ✏️ Editar materia existente

---

## 📡 Endpoints de la API (Completos)

Todos los endpoints (excepto login/logout) requieren el header:
```
Authorization: Bearer <token_jwt>
```

### 🔐 Autenticación — `/api/auth`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `POST` | `/api/auth/login` | Iniciar sesión | `{ username, password }` — username puede ser el correo electrónico |
| `POST` | `/api/auth/logout` | Cerrar sesión | — |

### 👤 Usuarios — `/api/users`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `GET` | `/api/users` | Listar todos los usuarios | — |
| `POST` | `/api/users` | Crear usuario | `{ username, password, email, id_rol, estado }` |
| `PUT` | `/api/users/:id` | Actualizar usuario | `{ username, email, id_rol, estado }` |
| `DELETE` | `/api/users/:id` | Desactivar usuario (soft-delete) | — |

### 🛡️ Roles — `/api/roles`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `GET` | `/api/roles` | Listar roles con conteo de usuarios | — |
| `POST` | `/api/roles` | Crear rol | `{ nombre_rol, descripcion }` |
| `PUT` | `/api/roles/:id` | Actualizar rol | `{ nombre_rol, descripcion }` |
| `DELETE` | `/api/roles/:id` | Eliminar rol | — |

### 🎓 Profesores — `/api/profesores`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `GET` | `/api/profesores` | Listar profesores con datos de cuenta vinculada | — |
| `POST` | `/api/profesores` | Crear profesor (opcionalmente con cuenta) | `{ nombre, apellido, ci, profesion, genero, crear_cuenta, username, password, email }` |
| `PUT` | `/api/profesores/:id` | Actualizar datos personales | `{ nombre, apellido, ci, profesion, genero }` |
| `PATCH` | `/api/profesores/:id/cuenta` | Crear y vincular cuenta a profesor sin cuenta | `{ username, password, email }` |

### 📅 Gestiones — `/api/gestiones`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `GET` | `/api/gestiones` | Listar gestiones académicas | — |
| `POST` | `/api/gestiones` | Crear gestión | `{ anio, fecha_inicio, fecha_fin, estado }` |
| `PUT` | `/api/gestiones/:id` | Actualizar gestión | `{ anio, fecha_inicio, fecha_fin, estado }` |

### 🏫 Estructura Académica — `/api/estructura`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `GET` | `/api/estructura/niveles` | Listar niveles | — |
| `POST` | `/api/estructura/niveles` | Crear nivel | `{ nombre_nivel, monto_mensualidad }` |
| `PUT` | `/api/estructura/niveles/:id` | Actualizar nivel | `{ nombre_nivel, monto_mensualidad }` |
| `GET` | `/api/estructura/grados` | Listar grados con su nivel | — |
| `POST` | `/api/estructura/grados` | Crear grado | `{ nombre_grado, id_nivel }` |
| `PUT` | `/api/estructura/grados/:id` | Actualizar grado | `{ nombre_grado, id_nivel }` |
| `GET` | `/api/estructura/aulas` | Listar aulas | — |
| `POST` | `/api/estructura/aulas` | Crear aula | `{ numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes }` |
| `PUT` | `/api/estructura/aulas/:id` | Actualizar aula | `{ numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes }` |

### 📚 Materias — `/api/materias`

| Método | Ruta | Descripción | Body |
|---|---|---|---|
| `GET` | `/api/materias` | Listar materias | — |
| `POST` | `/api/materias` | Crear materia | `{ nombre_materia, descripcion, id_campo, aplica_primaria, estado }` |
| `PUT` | `/api/materias/:id` | Actualizar materia | `{ nombre_materia, descripcion, id_campo, aplica_primaria, estado }` |
| `GET` | `/api/materias/campos` | Listar campos de conocimiento | — |

---

## 🔌 Conexión Frontend ↔ Backend

### Cómo se comunican

El frontend (Next.js en `localhost:3000`) se comunica con el backend (Express en `localhost:5000`) mediante peticiones **fetch** al API REST. El backend tiene **CORS habilitado** para aceptar las peticiones.

### Patrón de petición utilizado en el frontend

```typescript
// 1. Obtener el token almacenado tras el login
const token = localStorage.getItem("token")

// 2. GET — Obtener datos
const res = await fetch("http://localhost:5000/api/users", {
  headers: { Authorization: `Bearer ${token}` }
})
const datos = await res.json()

// 3. POST — Crear un registro
const res = await fetch("http://localhost:5000/api/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ username: "nuevo", password: "123", email: "nuevo@mail.com", id_rol: 3 })
})

// 4. PUT — Actualizar un registro
const res = await fetch("http://localhost:5000/api/users/5", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ username: "editado", email: "editado@mail.com", id_rol: 3, estado: true })
})
```

### Navegación basada en roles

El sidebar filtra los módulos visibles según el `id_rol` almacenado en localStorage:

| Rol | ID | Módulos visibles |
|---|---|---|
| SuperUsuario | 1 | Todos los módulos |
| Director | 2 | Docentes, Estructura Académica, Gestiones, Materias |
| Profesor | 3 | Dashboard (módulos académicos en ciclos futuros) |

### Tema claro/oscuro

El sistema soporta **modo oscuro y claro** mediante `next-themes`. El toggle está en el header. Se usa un estado `mounted` para evitar errores de hidratación (mismatch entre servidor y cliente).

---

## 🧪 Pruebas desde PowerShell

Antes de ejecutar estos comandos, asegúrate de que el backend esté corriendo (`npm run dev` en la carpeta `backend`).

> **Nota:** Los endpoints protegidos requieren un token JWT. Primero inicia sesión para obtenerlo.

### Obtener Token

```powershell
$loginBody = @{ username = "admin"; password = "tu_contraseña" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $response.token
$headers = @{ Authorization = "Bearer $token" }
```

### Usuarios

```powershell
# Crear usuario (ahora requiere email)
$body = @{
    username = "nuevo_profesor"
    password = "123456"
    email    = "profesor@fms.edu.bo"
    id_rol   = 3
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/users" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Listar usuarios
Invoke-RestMethod -Uri "http://localhost:5000/api/users" -Method Get -Headers $headers

# Actualizar usuario (ahora requiere email)
$body = @{
    username = "profesor_editado"
    email    = "editado@fms.edu.bo"
    id_rol   = 3
    estado   = $true
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/users/11" -Method Put -Body $body -ContentType "application/json" -Headers $headers

# Desactivar usuario
Invoke-RestMethod -Uri "http://localhost:5000/api/users/11" -Method Delete -Headers $headers
```

### Profesores

```powershell
# Crear profesor sin cuenta
$body = @{
    nombre    = "Juan Carlos"
    apellido  = "López"
    ci        = "9876543"
    profesion = "Lic. en Educación Física"
    genero    = "Masculino"
    crear_cuenta = $false
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/profesores" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Crear profesor CON cuenta
$body = @{
    nombre    = "María"
    apellido  = "García"
    ci        = "1234567"
    profesion = "Lic. en Matemáticas"
    genero    = "Femenino"
    crear_cuenta = $true
    username  = "mgarcia"
    password  = "123456"
    email     = "mgarcia@fms.edu.bo"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/profesores" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Vincular cuenta a profesor sin cuenta (reemplazar :id)
$body = @{
    username = "jclopez"
    password = "123456"
    email    = "jclopez@fms.edu.bo"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/profesores/15/cuenta" -Method Patch -Body $body -ContentType "application/json" -Headers $headers

# Editar datos del profesor
$body = @{
    nombre    = "Juan Carlos"
    apellido  = "López Mendoza"
    ci        = "9876543"
    profesion = "Lic. en Educación Física y Deportes"
    genero    = "Masculino"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/profesores/15" -Method Put -Body $body -ContentType "application/json" -Headers $headers
```

### Estructura Académica

```powershell
# Crear nivel
$body = @{ nombre_nivel = "Kínder"; monto_mensualidad = 250.00 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/niveles" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Editar nivel
$body = @{ nombre_nivel = "Kínder"; monto_mensualidad = 275.00 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/niveles/1" -Method Put -Body $body -ContentType "application/json" -Headers $headers

# Crear grado
$body = @{ nombre_grado = "1ro Primaria"; id_nivel = 2 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/grados" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Editar grado
$body = @{ nombre_grado = "1ro de Primaria"; id_nivel = 2 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/grados/1" -Method Put -Body $body -ContentType "application/json" -Headers $headers

# Crear aula
$body = @{
    numero_aula = "A-101"
    descripcion = "Aula del primer piso"
    cantidad_mesas = 15
    cantidad_sillas = 30
    capacidad_estudiantes = 30
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/aulas" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Editar aula
$body = @{
    numero_aula = "A-101"
    descripcion = "Aula del primer piso - renovada"
    cantidad_mesas = 20
    cantidad_sillas = 40
    capacidad_estudiantes = 40
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/aulas/1" -Method Put -Body $body -ContentType "application/json" -Headers $headers

# Listar todo
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/niveles" -Method Get -Headers $headers
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/grados" -Method Get -Headers $headers
Invoke-RestMethod -Uri "http://localhost:5000/api/estructura/aulas" -Method Get -Headers $headers
```

### Gestiones Académicas

```powershell
# Crear gestión
$body = @{
    anio = 2027
    fecha_inicio = "2027-02-01"
    fecha_fin = "2027-11-26"
    estado = "planificada"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/gestiones" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Listar gestiones
Invoke-RestMethod -Uri "http://localhost:5000/api/gestiones" -Method Get -Headers $headers
```

### Materias

```powershell
# Listar campos de conocimiento
Invoke-RestMethod -Uri "http://localhost:5000/api/materias/campos" -Method Get -Headers $headers

# Crear materia
$body = @{
    nombre_materia = "Computación Básica"
    descripcion = "Introducción a la informática para niños"
    id_campo = 2
    aplica_primaria = $true
    estado = $true
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/materias" -Method Post -Body $body -ContentType "application/json" -Headers $headers

# Listar materias
Invoke-RestMethod -Uri "http://localhost:5000/api/materias" -Method Get -Headers $headers
```

---

## 🐛 Bugs Resueltos en este Ciclo

| Bug | Causa raíz | Solución |
|---|---|---|
| `profesor_genero_check` al crear profesor | Frontend enviaba `"M"`/`"F"` pero PostgreSQL espera `"Masculino"`/`"Femenino"` | Cambiados los valores del Select en el frontend |
| Error de hidratación (ThemeProvider) | `next-themes` devuelve `undefined` en SSR → el ícono Sol/Luna difería entre servidor y cliente | Se usa estado `mounted` para no renderizar ícono hasta que el cliente esté listo |
| `res.status.json(...)` en userController | Faltaba el código de estado `(409)` → crash silencioso | Corregido a `res.status(409).json(...)` |
| Update de usuario siempre fallaba | Condición `estado \|\| email === undefined` era truthy cuando `estado=true` → bloqueaba todos los updates | Corregido a `estado === undefined \|\| !email` |
| Error SQL en UPDATE usuario | Faltaba coma: `email = $2 id_rol` → error de sintaxis PostgreSQL | Corregido a `email = $2, id_rol` |

---

## 🤝 Contribuir

1. Haz un fork del repositorio.
2. Crea una rama con tu feature: `git checkout -b feature/mi-feature`.
3. Realiza tus cambios y haz commit: `git commit -m "feat: descripción"`.
4. Sube la rama: `git push origin feature/mi-feature`.
5. Abre un Pull Request.

---

