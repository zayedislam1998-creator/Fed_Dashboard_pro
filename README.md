# Workspace Pro Dashboard

Enterprise workspace dashboard application featuring Executive Suite, Communication Channels, Tasks & Projects Engine, Member Portal, and Real-Time Collaboration.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Express, Prisma ORM, PostgreSQL.

---

## 1. Quick Start

### 1.1 Prerequisites
- Node.js (v20+ recommended)
- PostgreSQL (v15+)

### 1.2 Installation
```bash
# Clone the repository and install dependencies
npm install
```

### 1.3 Environment Setup
Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/workspace_pro?schema=public

# Administrator Identity & Security
ADMIN_USERNAME=admin@company.com
ADMIN_PASSWORD=your_secure_password
WORKSPACE_MASTER_KEY=your_secure_master_key

# Persistent Binary Storage (Optional, defaults to ./storage)
EXTERNAL_STORAGE_DIR=./storage
```

### 1.4 Database Initialization
```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Push schema to PostgreSQL
npm run prisma:push

# 3. Verify database health and connection
npm run db:status
```

### 1.5 Run Application
```bash
# Development mode (full-stack server + Vite HMR)
npm run dev

# Production build and run
npm run build
npm start
```

---

## 2. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts development server with full-stack reload and Vite HMR. |
| `npm run build` | Builds optimized production client bundle in `dist/`. |
| `npm run lint` | Runs TypeScript static type checking (`tsc --noEmit`). |
| `npm start` | Starts Express server in production mode. |
| `npm run db:push` | Pushes Prisma schema changes directly to PostgreSQL. |
| `npm run db:status` | Runs diagnostic check on PostgreSQL connection, tables, and pool. |
| `npm run prisma:studio` | Opens Prisma Studio to browse database records in browser. |

---

## 3. Project Structure

```text
Pro-dashboard/
├── server.ts                   # Express server entry point & middleware mounting
├── server/
│   ├── auth/                   # Session auth, role policies & capabilities
│   ├── db/                     # Prisma client, migrations & bootstrap sync
│   ├── engine/                 # Core engine services (communication, etc.)
│   ├── mail/                   # Mail engine, SMTP/IMAP & automation workers
│   ├── routes/                 # Modular API route controllers
│   ├── services/               # Concurrency locks, storage & db helpers
│   └── realtime.ts             # Server-Sent Events (SSE) broadcast broker
│
├── src/
│   ├── App.tsx                 # Application root & dynamic module router
│   ├── components/             # Views, dialogs, widgets & dashboard panes
│   │   ├── engines/            # Specialized canvas & studio engines
│   │   ├── member/             # Member self-service portal views
│   │   ├── settings/           # System & mailbox settings modules
│   │   └── mail/               # Mail composer & client components
│   └── services/               # Client-side API clients & realtime buses
│
├── prisma/
│   └── schema.prisma           # Prisma relational schema definitions
└── public/                     # Static assets & public icons
```

---

## 4. Key Architectural Highlights

* **Dynamic Code Splitting:** Heavy view components are split via `React.lazy()` for rapid initial page load.
* **Pure PostgreSQL Engine:** Relational records (users, tasks, projects, mail metadata, settings) are managed via Prisma ORM over a pooled connection.
* **Decoupled Binary Storage:** Uploaded files and attachments remain outside database tables on disk/cloud storage.
* **Realtime Server-Sent Events (SSE):** Targeted client mapping ensures efficient notification and messaging delivery.
