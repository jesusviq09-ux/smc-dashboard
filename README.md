# SMC Greenpower F24 — Team Dashboard

PWA de gestión integral para el equipo SMC Greenpower F24/F24+.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Estado | Zustand + TanStack Query v5 |
| Offline | Dexie.js (IndexedDB) + Workbox (Service Workers) |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL 16 (Docker) |
| Tiempo real | Socket.io (chat) + SSE (telemetría) |
| Gráficos | Recharts |
| Exportación | jsPDF + jspdf-autotable + xlsx |

---

## Requisitos previos

- Node.js ≥ 20 (instalar con [nvm](https://github.com/nvm-sh/nvm): `nvm install 20`)
- Docker Desktop en ejecución

---

## Inicio rápido

### 1. Instalar dependencias

```bash
cd "SMC DASHBOARD"
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configurar entorno

```bash
# En la raíz del proyecto
cp .env.example .env
# En backend/
cp .env.example .env   # o editar backend/.env directamente
```

### 3. Arrancar PostgreSQL + Redis (requiere Docker Desktop abierto)

```bash
docker compose up -d
```

Verifica que estén arriba:

```bash
docker compose ps
```

### 4. Iniciar el backend

```bash
cd backend
npm run dev
# Servidor en http://localhost:3001
# La primera vez ejecuta migraciones y seeds automáticamente
```

### 5. Iniciar el frontend

```bash
cd frontend
npm run dev
# App en http://localhost:5173
```

---

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard principal |
| `/pilots` | Gestión de pilotos + puntuación ponderada |
| `/training` | Sesiones de entrenamiento + vueltas + telemetría |
| `/races` | Carreras + estrategia con IA + carrera en vivo |
| `/maintenance` | Mantenimiento + repuestos + checklists |
| `/telemetry` | Stream en vivo Echook + importar/exportar CSV |
| `/circuits` | Base de datos de circuitos + records |
| `/communication` | Chat en tiempo real + briefings |
| `/stats` | Estadísticas y gráficos del equipo |
| `/goals` | Objetivos de pilotos y equipo |
| `/exports` | PDF, Excel y backup JSON |

---

## Fórmula de puntuación de pilotos

```
rawScore = (Exp×0.30) + (Conducción×0.25) + (Energía×0.20) + (Equipo×0.10) + (Consistencia×0.10) + (Adaptación×0.05)
penalización = floor(max(0, peso-50) / 10) × 0.2
puntuaciónFinal = rawScore - penalización
```

---

## Vehículos y restricciones

| Vehículo | Material | Peso | Restricciones |
|----------|----------|------|---------------|
| SMC 01 | Acero | 80 kg | Sin restricciones |
| SMC 02 EVO | Aluminio | 40 kg | No puede entrenar en Karting de Rivas |

---

## Formato de carrera

| Formato | Duración | Cambios | Edad mínima |
|---------|----------|---------|-------------|
| F24 | 90 min | Mínimo 2 | Sin restricción |
| F24+ | 60 min | 0 (piloto único) | ≥ 16 años |

---

## Comandos útiles

```bash
# Build de producción (frontend)
cd frontend && npm run build

# Verificar TypeScript
cd frontend && npx tsc --noEmit

# Ver logs del backend
cd backend && npm run dev

# Parar Docker
docker compose down

# Reset base de datos
docker compose down -v && docker compose up -d
```

---

## Estructura del proyecto

```
SMC DASHBOARD/
├── frontend/          # React PWA
│   ├── src/
│   │   ├── pages/     # 20+ páginas lazy-loaded
│   │   ├── components/# UI + layout components
│   │   ├── services/  # API client + IndexedDB + sync
│   │   ├── store/     # Zustand stores
│   │   ├── utils/     # Algoritmos (scoring, estrategia, etc.)
│   │   ├── hooks/     # Custom hooks
│   │   └── types/     # TypeScript types
│   └── public/icons/  # PWA icons 192x192, 512x512
├── backend/           # Express API
│   └── src/
│       ├── models/    # Sequelize models (15+)
│       ├── routes/    # REST endpoints
│       ├── config/    # DB connection
│       └── seeds/     # Datos iniciales
├── docker-compose.yml # PostgreSQL + Redis
└── .env.example       # Variables de entorno
```
