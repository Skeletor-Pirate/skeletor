# SKELETOR

> **The Apex Autonomous CLI Coding Engine**  
> Combining Claude Code modes, Aider 4-tier fuzzy patching, Hermes 2.0 self-evolution, AST code graphs, uncapped continuous autonomous coding, and zero-token local gateway integration into one unified terminal experience.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.18.0-cyan.svg)](https://nodejs.org/)
[![Benchmarks](https://img.shields.io/badge/Global_Benchmarks-100%25_Apex_Class-green.svg)](#global-benchmark-results)
[![MCP Compatible](https://img.shields.io/badge/MCP-JSON--RPC_2.0-blue.svg)](https://modelcontextprotocol.io/)

---

## Overview

Skeletor is an open-source, local-first autonomous CLI coding agent engineered from the ground up to synthesize the strongest capabilities of modern agent architectures:

- **Claude Code Modal Personas**: Shift+Tab instant cycling between `code`, `plan` (architect read-only), `debug`, `review`, and `test` modes.
- **Aider-Grade 4-Tier Fuzzy Patching**: Unbreakable string and diff editing tolerant to line endings (`\r\n` vs `\n`), sliding-window indentation drift, and `<<<<<<< SEARCH ... >>>>>>> REPLACE` hunks.
- **Uncapped Continuous Autonomous Coding**: Run complex development loops without turn caps (`Number.MAX_SAFE_INTEGER`), uninterrupted terminal processes (up to 30 min timeouts), and automated self-correction on build or test failures.
- **Hermes 2.0 Self-Evolution**: Autonomous skill discovery and continuous permanent learning (`/evolve`, `/learn`) from sibling agent environments and web resources.
- **AST Code Graph Intelligence (Context7x)**: High-speed symbol mapping, dependency tracing, and blast radius analysis with `/graphify`.
- **Zero-Token FreeLLMAPI Gateway**: Native integration with local/private gateways exposing 177+ models with automatic failover, retries, and intelligent routing.

---

## Installation & Setup

### Prerequisites
- Node.js >= 20.18.0
- PowerShell (Windows) or Bash (macOS/Linux)
- A running FreeLLMAPI gateway (`http://localhost:3001`) or any OpenAI-compatible endpoint.

### Install Globally
```bash
git clone https://github.com/Skeletor-Pirate/skeletor.git
cd skeletor
npm install
npm run build
npm link
```

### Environment Configuration
Skeletor automatically detects active FreeLLMAPI credentials. You can also specify custom endpoints:
```bash
export FREELLMAPI_URL="http://localhost:3001"
export FREELLMAPI_API_KEY="your-api-key"
```

---

## Usage

### 1. Interactive Minimalist TUI
Start the interactive terminal interface:
```bash
skeletor
```
*Tip: Press **Shift + Tab** to cycle agent personas on the fly.*

### 2. One-Shot Execution
Execute a targeted instruction and return immediately:
```bash
skeletor "Create a TypeScript matrix math module with comprehensive vitest coverage"
```

### 3. Continuous Autonomous Mode (Uncapped)
Launch Skeletor in continuous autonomous mode where turn limits are removed, shell timeouts are extended to 30 minutes, confirmations are bypassed, and terminal failures are automatically repaired:
```bash
skeletor --continuous "Scaffold a full REST API, configure SQLite, implement auth routes, and iterate until all tests pass cleanly"
```
Or use the short flag:
```bash
skeletor -c "Fix all TypeScript lint errors across the workspace"
```

### 4. Architectural Planning Mode
Plan an architectural refactor in read-only mode without modifying workspace files:
```bash
skeletor --plan "Design a scalable event-driven notification queue"
```

---

## Core Capabilities

### 1. 4-Tier Smart Edit & Fuzzy Patching
Standard LLM file edits fail when whitespace, indentation, or Windows line endings (`\r\n`) differ slightly from prompt context. Skeletor resolves this with a 4-tier fallback algorithm:
1. **Tier 1 (Exact Match)**: Direct character-for-character replacement.
2. **Tier 2 (CRLF / LF Normalization)**: Strips carriage return discrepancies.
3. **Tier 3 (Sliding Window Indentation Tolerance)**: Trims leading/trailing line whitespace and matches identical content regardless of tab/space differences.
4. **Tier 4 (Aider Search/Replace Hunks)**: Parses Git/Aider format:
   ```text
   <<<<<<< SEARCH
   original_code()
   =======
   updated_code()
   >>>>>>> REPLACE
   ```

### 2. Hermes 2.0 Self-Evolution
Skeletor continuously improves its capabilities by discovering skills from sibling agents and external online sources:
```bash
skeletor --evolve
```
Grant internet permission to fetch bleeding-edge external skills:
```bash
skeletor --evolve --internet
```
Or synthesize a permanent skill from your current session:
```text
/learn my-new-skill
```

### 3. Context7x Code Graph (`/graphify`)
Deep AST indexing extracts symbols, function definitions, imported dependencies, and cross-file relationships:
```text
/graphify src/
```

### 4. System Diagnostics (`/doctor`)
Audit local gateway health, latency, brother CLI agent presence, and sandbox permissions:
```bash
skeletor --doctor
```

---

## Slash Commands Reference

Inside the interactive REPL, the following slash commands are available:

| Command | Description |
| :--- | :--- |
| `/continuous`, `/c` | Toggle uncapped continuous autonomous coding mode |
| `/mode <name>` | Switch persona (`code`, `plan`, `debug`, `review`, `test`) |
| `/plan` | Enter read-only architectural planning mode |
| `/code` | Enter code implementation mode |
| `/debug` | Enter systematic hypothesis-driven debug mode |
| `/review` | Enter security and code quality review mode |
| `/test` | Enter test automation and coverage mode |
| `/evolve` | Trigger Hermes 2.0 self-evolution across agent directories |
| `/learn [name]` | Synthesize and persist a reusable skill from the conversation |
| `/benchmark` | Execute the global coding agent evaluation suite |
| `/doctor` | Run comprehensive system health diagnostics |
| `/graphify [path]`| Run AST dependency & code graph analysis |
| `/models` | Query live models available on FreeLLMAPI |
| `/model <id>` | Pin active model for the session |
| `/skills` | List all discovered skills |
| `/skill <name>` | Inspect and inject a skill into conversation context |
| `/diff` | Inspect uncommitted Git changes in the workspace |
| `/commit [msg]` | Stage and commit changes |
| `/undo` | Discard uncommitted working tree changes |
| `/steps <n>` | Dynamically adjust maximum turn step count |
| `/session <id>` | Load a saved conversation session |
| `/clear` | Clear conversation history |
| `/exit`, `/quit` | Terminate session |

---

## Native Toolset

Skeletor equips LLMs with high-performance native tools:
- `Read`: Sliced or full file viewing with 1-indexed line ranges.
- `Write`: Atomic file writing with automatic directory generation.
- `Edit`: 4-tier fuzzy patch replacement with uniqueness validation.
- `Bash` / `Exec`: Cross-platform command runner with 20MB buffer and sandboxing.
- `Git`: Workspace Git status, diffing, staging, committing, and branching.
- `Glob`: Fast workspace path globbing with automated ignore patterns.
- `Grep`: Regex and substring multi-file search with line numbering.
- `LS`: Detailed directory listings.
- `Fetch`: Web page and REST API text extraction.
- `RepoMap`: Visual hierarchy mapping.
- `Graphify`: Abstract syntax tree symbol and dependency extraction.
- `LearnSkill`: Permanent skill serialization.

---

## Development & Testing

Run all 18 test suites covering 61 unit tests:
```bash
npm test
```

Compile TypeScript to production ES modules:
```bash
npm run build
```

---

## License

MIT © 2026 Skeletor Contributors. See [LICENSE](LICENSE) for details.
