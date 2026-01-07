# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a LiveKit Agents voice AI project built with Node.js/TypeScript. It creates voice assistants using LiveKit's real-time infrastructure with STT (AssemblyAI), LLM (OpenAI), and TTS (Cartesia) models.

See `AGENTS.md` for LiveKit-specific guidance including MCP server installation, handoffs/workflows, and feature parity notes.

## Commands

```bash
# Install dependencies
pnpm install

# Download required ML models (Silero VAD, LiveKit turn detector) - run before first start
pnpm run download-files

# Development (uses tsx for hot reload)
pnpm run dev

# Production
pnpm run build && pnpm run start

# Testing
pnpm run test              # Run all tests
pnpm run test:watch        # Watch mode

# Code quality
pnpm run typecheck         # TypeScript type checking
pnpm run lint              # ESLint
pnpm run lint:fix          # ESLint with auto-fix
pnpm run format            # Prettier format
pnpm run format:check      # Check formatting
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:
- `LIVEKIT_URL` - LiveKit Cloud or self-hosted server URL
- `LIVEKIT_API_KEY` - API key from LiveKit Cloud
- `LIVEKIT_API_SECRET` - API secret from LiveKit Cloud

Use LiveKit CLI to auto-populate: `lk cloud auth && lk app env -w -d .env.local`

## Architecture

The agent is defined in `src/agent.ts` with this structure:

1. **Assistant class** extends `voice.Agent` - contains the agent's personality via `instructions` and optional `tools`
2. **Prewarm hook** - Preloads Silero VAD model into `proc.userData` for faster startup
3. **Entry function** - Creates `voice.AgentSession` with the voice pipeline:
   - STT: Speech recognition (AssemblyAI)
   - LLM: Language model (OpenAI GPT-4.1-mini)
   - TTS: Voice synthesis (Cartesia Sonic-3)
   - Turn detection: LiveKit multilingual model
   - Noise cancellation: LiveKit Cloud BVC
4. **CLI runner** - `cli.runApp()` handles `dev`, `start`, and `download-files` commands

The session connects to a LiveKit room and handles real-time audio streaming, turn-taking, and metrics collection.

## Adding Tools

Tools let the agent perform actions. Add to the `Assistant` constructor:

```typescript
import { llm } from '@livekit/agents';
import { z } from 'zod';

// In Assistant constructor:
tools: {
  myTool: llm.tool({
    description: 'Tool description for the LLM',
    parameters: z.object({
      param: z.string().describe('Parameter description'),
    }),
    execute: async ({ param }) => {
      return 'result string';
    },
  }),
}
```

## Realtime Models

To use OpenAI Realtime API instead of the pipeline:
1. Install `@livekit/agents-plugin-openai`
2. Set `OPENAI_API_KEY` in `.env.local`
3. Replace AgentSession setup with `llm: new openai.realtime.RealtimeModel({ voice: 'marin' })`
