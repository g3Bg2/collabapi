# Event Collaboration API

This is a NestJS-based API for managing users, events, and their collaborations. It uses MySQL for data storage, Redis for caching AI-generated summaries, and Ollama for local LLM-based summarization.

### Prerequisites

- **Node.js** 18+ and **pnpm** (or npm)
- **Docker** and **Docker Compose** (for full stack)
- **Ollama** running locally (optional; API falls back to mocked response)

### Option 1: Local Development (with Docker Database)

```bash
# 1. Install dependencies
pnpm install

# 2. Start MySQL and Redis containers
docker-compose up mysql redis -d

# 3. Run migrations to create schema
pnpm migration:run

# 4. Start the API in watch mode
pnpm start:dev
```

The API will be available at `http://localhost:3000`.

### Option 2: Full Stack with Docker Compose

```bash
# Start all services (MySQL, Redis, Migrations, API)
docker-compose up

# API runs on http://localhost:3000
```

**Note**: The `docker-compose.yml` includes environment variables for:
- MySQL credentials and database name
- Redis host and port
- Ollama URL and model (`qwen3:4b`)

### Option 3: Production Build

```bash
# Build the project
pnpm build

# Run the production build
pnpm start:prod

# Or with Docker
docker build -t collabapi .
docker run -p 3000:3000 collabapi
```

---

### Environment Variables
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=example
DB_NAME=collabdb
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📦 Docker Compose Setup

The `docker-compose.yml` includes:

| Service | Image | Purpose |
|---------|-------|---------|
| `mysql` | `mysql:8.0` | Database for entities |
| `redis` | `redis:7-alpine` | Cache for AI summaries |
| `migration` | Custom build | Runs TypeORM migrations |
| `api` | Custom build | NestJS application |

**Environment Flow**:
```
mysql → migration (creates schema) → api (connects to both MySQL and Redis)
redis → api (stores cached summaries)
```

**Health Checks**: MySQL and Redis have built-in health checks to ensure readiness before dependent services start.

## 🛠️ Common Commands

```bash
# Development
pnpm start:dev          # Start with hot reload
pnpm build              # Compile TypeScript
pnpm format             # Auto-format code

# Testing
pnpm test               # Run unit tests
pnpm test:watch         # Watch mode

# Database
pnpm migration:generate # Generate new migration
pnpm migration:run      # Execute migrations
pnpm migration:revert   # Revert last migration

# Docker
docker-compose up       # Start full stack
docker-compose down     # Stop containers
```

## 📚 Technologies Used

- **Framework**: NestJS 11 (TypeScript)
- **Database**: MySQL 8.0 with TypeORM
- **Cache**: Redis 7 (in-memory)
- **AI**: Ollama (local LLM) with qwen3:4b model
- **Testing**: Jest with @nestjs/testing
- **Docker**: Docker & Docker Compose for containerization
- **Package Manager**: pnpm
