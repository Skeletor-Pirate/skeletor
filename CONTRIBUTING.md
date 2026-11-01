# Contributing to Skeletor

Thank you for your interest in contributing to **Skeletor** — the autonomous CLI coding agent.

## Philosophy

Skeletor is designed to be:
1. **Uncompromisingly Fast**: Minimal startup latency, zero sluggishness, instantaneous file operations.
2. **Autonomous & Resilient**: Closed-loop self-healing, uncapped continuous execution, never crashing on recoverable errors.
3. **Model & Provider Agnostic**: Native compatibility with OpenAI-compatible gateways (FreeLLMAPI, vLLM, Ollama, OpenRouter, Anthropic, OpenAI).
4. **Clean & Minimalist**: Luxury typographic terminal design, zero emoji clutter, crisp visual hierarchy.

---

## Local Development Setup

### Prerequisites
- Node.js >= 20.18.0
- npm or pnpm
- Git

### Installation
```bash
git clone https://github.com/Skeletor-Pirate/skeletor.git
cd skeletor
npm install
```

### Running Tests
All unit tests are run via Vitest:
```bash
npm test
```

### Building the Project
Skeletor is written in TypeScript and compiles directly to modern ES modules:
```bash
npm run build
```

### Linking Globally
To run `skeletor` locally from any terminal directory:
```bash
npm link
```

Now you can invoke:
```bash
skeletor --help
```

---

## Architecture Guidelines

- **`src/loop.ts`**: The core execution loop. Handles context compaction, tool dispatching, anti-procrastination guards, turn limits, and continuous self-correction.
- **`src/diff.ts`**: The 4-tier fuzzy patch editing engine (Exact match, normalized line endings, sliding-window whitespace tolerance, and Aider search/replace hunks).
- **`src/tools.ts`**: Native tool implementations (`Read`, `Write`, `Edit`, `Bash`, `Git`, `Glob`, `Grep`, `LS`, `Fetch`, `RepoMap`, `Graphify`, `LearnSkill`).
- **`src/mcp.ts`**: High-performance JSON-RPC 2.0 Model Context Protocol registry (stdio, SSE, HTTP).
- **`src/evolution.ts`**: Hermes 2.0 self-evolution engine (introspects sibling agents and external online skill repositories).
- **`src/benchmark.ts`**: Standardized evaluation suite (HumanEval pass@1, SWE-bench repository patch localization, Aider fuzzy patch resilience, Hermes multi-step reasoning).
- **`src/tui.ts`**: Minimalist luxury terminal UI, truecolor ANSI palettes, border rendering, and readline completion.

---

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feature/my-enhancement`
2. Write unit tests in `tests/` covering your changes.
3. Verify all tests pass: `npm test`
4. Verify TypeScript builds without errors: `npm run build`
5. Submit a pull request with a clear description of the problem solved.

---

## Code of Conduct

Be respectful, constructive, and pragmatic. Focus on technical excellence and code quality.
