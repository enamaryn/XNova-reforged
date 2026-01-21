# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY RULES

### Language Requirement
**MANDATORY: All communication with the user MUST be in French (Français).**
- All explanations, comments, and messages must be written in French
- Code comments should be in French when adding new comments
- Technical terms and code identifiers remain in their original form (English)
- Error messages and user-facing text should be in French

### Documentation Updates
**MANDATORY: Always update project tracking files after completing tasks.**

At the end of each work session or after completing a significant task, you MUST update:

1. **CLAUDE_SESSION.md** - Session history and progress
   - Add a new session entry with date and objective
   - List all completed tasks with checkboxes
   - Document created files and their purposes
   - Update current project status
   - Define next steps

2. **ROADMAP_MVP.md** or **ROADMAP_COMPLET.md** - Project roadmap
   - Check off completed tasks in the relevant sprint
   - Update sprint status (not started / in progress / completed)
   - Add notes about any deviations from the plan

3. **TodoWrite** - During active work
   - Use the TodoWrite tool to track current tasks
   - Mark tasks as completed as you finish them
   - Keep exactly ONE task in_progress at a time

These updates are NOT optional - they are critical for maintaining context across sessions and preventing work duplication.

## Project Overview

XNova Reforged is a complete modern rewrite of the XNova space strategy MMORPG (originally from 2008), built with cutting-edge web technologies as of 2026. This is a TypeScript monorepo managed with Turborepo, consisting of a NestJS backend API and a Next.js frontend web application, with shared packages for database schema, game configuration, and game logic.

## Common Development Commands

### Initial Setup
```bash
# Install all dependencies (monorepo-wide)
npm install

# Start Docker services (PostgreSQL + Redis)
npm run docker:up

# Initialize database schema
npm run db:push

# Open Prisma Studio to inspect database
npm run db:studio
```

### Development
```bash
# Start all apps in dev mode (API + Web in parallel)
npm run dev

# Build all apps for production
npm run build

# Lint all code
npm run lint

# Format code with Prettier
npm run format
```

### Database Operations
```bash
# Push Prisma schema to database
npm run db:push

# Open Prisma Studio (http://localhost:5555)
npm run db:studio

# Create a new migration (from packages/database directory)
cd packages/database && npx prisma migrate dev

# Generate Prisma client
cd packages/database && npx prisma generate
```

### Docker
```bash
# Start services
npm run docker:up

# Stop services
npm run docker:down

# View logs
docker-compose logs
```

### Running Individual Apps
```bash
# Backend API only (from apps/api/)
cd apps/api && npm run dev

# Frontend Web only (from apps/web/)
cd apps/web && npm run dev
```

## Architecture Overview

### Monorepo Structure

The project follows a monorepo pattern with workspaces:

- **apps/api/** - NestJS backend (port 3001)
  - Modular structure planned with auth, game logic, alliances, messaging modules
  - Uses Prisma for database access
  - Implements JWT authentication with Argon2 password hashing
  - Will use Socket.io for real-time updates

- **apps/web/** - Next.js 15 frontend (port 3000)
  - Uses App Router architecture
  - Planned routes: (auth) group for login/register, (game) group for gameplay pages
  - State management with Zustand
  - Data fetching with React Query
  - UI components from shadcn/ui with TailwindCSS

- **packages/database/** - Prisma schema and client
  - Single source of truth for database structure
  - Schema defines all game entities: Users, Planets, Technologies, Fleets, Alliances, etc.
  - Shared across all apps that need database access

- **packages/game-config/** - Static game configuration
  - Buildings, ships, technologies definitions with costs and requirements
  - Game constants (universe size, resource limits, combat rules)
  - Mission types, fleet status enums
  - Based on formulas from legacy XNova 0.8

- **packages/game-engine/** - Pure game logic (planned)
  - Business logic independent of frameworks
  - Resource calculations, combat engine, fleet movements

- **packages/ui/** - Shared React components (planned)

### Database Schema Architecture

The Prisma schema is organized into logical sections:

1. **User & Authentication** - User accounts with stats and rankings
2. **Planets & Resources** - Planet data with building levels stored as columns (denormalized for performance)
3. **Construction Queue** - Time-based building construction
4. **Technologies** - User research levels with separate research queue
5. **Ships & Defenses** - Military units per planet
6. **Fleets** - In-transit fleets with mission types and cargo (uses JSON for flexibility)
7. **Combat Reports** - Battle results with full data
8. **Alliances** - Player organizations with membership ranks
9. **Messages** - Player-to-player communication
10. **Game Config** - Dynamic configuration key-value store

Key design decisions:
- Building/defense levels stored as columns on Planet model (not normalized) for query performance
- Fleet ships and cargo stored as JSON for flexibility with varying ship types
- Separate queue tables (BuildQueue, ResearchQueue) for time-based actions
- Comprehensive indexing on foreign keys and query fields

### Game Formulas & Legacy Reference

The [GAME_FORMULAS.md](GAME_FORMULAS.md) file contains extracted formulas from the original XNova 0.8 (2008) codebase. These are the reference implementations for:

- **Resource Production**: Time-based calculation with energy requirements and officer bonuses
- **Storage Capacity**: Exponential growth formula (base × 1.5^level)
- **Building Costs**: Exponential cost scaling (baseCost × factor^level)
- **Energy Balance**: Production/consumption affecting resource output
- **Combat Mechanics**: Rapid-fire bonuses, shield/armor calculations
- **Fleet Movement**: Distance and speed calculations

When implementing game logic, always refer to these formulas to maintain compatibility with the original game mechanics.

### Key Technical Patterns

1. **Monorepo with Turborepo**
   - Shared dependencies across workspaces
   - Parallel build and dev execution
   - Package dependencies managed via workspace protocol

2. **Type-Safe Data Flow**
   - Prisma generates TypeScript types from schema
   - game-config exports typed constants and enums
   - Full type safety from database to frontend

3. **Real-Time Updates** (planned)
   - Socket.io for live resource updates
   - Event-driven architecture for fleet arrivals, combat results

4. **Authentication Flow**
   - JWT tokens with refresh token rotation
   - Argon2 password hashing (security best practice)
   - Session storage in Redis

## Important Development Notes

### Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection (default: localhost:5432)
- `REDIS_URL` - Redis connection (default: localhost:6379)
- `JWT_SECRET` - Must be changed in production
- `GAME_SPEED` / `FLEET_SPEED` - Game speed multipliers (default: 2500)

### Database Workflow

1. Schema changes go in `packages/database/prisma/schema.prisma`
2. After changes, run `npm run db:push` for dev or create migration for production
3. Always regenerate client: `cd packages/database && npx prisma generate`
4. The generated client is used by importing from `@xnova/database`

### Game Configuration

Building, ship, and technology definitions live in `packages/game-config/src/`:
- These are TypeScript constants exported from the package
- IDs in these files must match IDs used in database records
- Cost and requirement formulas are defined here
- Import via `@xnova/game-config`

### Deployment Targets

- Frontend: Vercel (Next.js native support)
- Backend: Railway or similar Node.js hosting
- Database: Managed PostgreSQL (Railway, Supabase, etc.)
- Redis: Managed Redis (Upstash, Redis Cloud)

## Project Status

This is an early-stage project following the [ROADMAP_MVP.md](ROADMAP_MVP.md) with a planned 3-4 month development timeline. The infrastructure and database schema are in place, but most game features are still to be implemented.

Current focus areas:
- Authentication module implementation
- Resource production system
- Building construction queue
- Basic UI components

Refer to [ROADMAP_MVP.md](ROADMAP_MVP.md) for detailed sprint planning and [ROADMAP_COMPLET.md](ROADMAP_COMPLET.md) for post-MVP features.
