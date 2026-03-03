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

## 🧠 Merge Algorithm & Conflict Detection Logic

### Conflict Detection

**Algorithm: Interval Overlap Detection**

Two events overlap if:
```
event_a.startTime < event_b.endTime AND event_b.startTime < event_a.endTime
```

**Time Complexity**: O(n²) where n = number of events for a user  

### Merge Strategy

**Step 1: Cluster Overlapping Events**
- Sort events by `startTime`
- Group consecutive overlapping events into "clusters"
- Each cluster contains 2+ overlapping events (non-overlapping events stay separate)

**Step 2: Combine Event Metadata**

For each cluster:

| Field | Merge Strategy |
|-------|--------|
| `startTime` | Earliest start of all events |
| `endTime` | Latest end of all events |
| `title` | Concatenate with " + " separator (e.g., "Meeting 1 + Meeting 2") |
| `description` | Combine with " \| " separator, filter out empty ones |
| `status` | Highest priority: COMPLETED > IN_PROGRESS > TODO > CANCELED |
| `invitees` | Union of all invitees across events |
| `mergedFrom` | Array of original event IDs |

**Step 3: Transactional Merge**
- All merge operations happen within a **database transaction**
- Create merged event → Save to DB → Log audit trail → Delete old events
- If any step fails, entire transaction rolls back
- No orphaned events or partial states

**Step 4: AI Summarization (Post-Transaction)**
- After merge commits, call AI service to summarize
- Runs in parallel for all merged events using `Promise.all()`
- Results cached in Redis with 1-hour TTL

---

## 🤖 AI Tools Used

- **GitHub Copilot**: For code assitance and boilerplate generation
- **Claude**: For entity relationship design and API structuring

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
