# Claude Code Control Skill

**Execute Claude Code commands autonomously without interactive prompts or manual intervention.**

Agents can now control Claude Code instances, send commands, chain operations, and parse output — all programmatically.

## What It Does

- ✅ Launch Claude Code in background with auto-approval
- ✅ Send commands (exec, file reads/writes, shell)
- ✅ Skip /login and security prompts automatically
- ✅ Capture clean output (strip ANSI, format JSON)
- ✅ Chain multiple commands sequentially
- ✅ Handle long-running tasks (code generation, testing, debugging)

## Use Cases

1. **Agent-to-Agent Automation** — Agent A spawns Claude Code to solve a problem autonomously
2. **Complex Code Tasks** — Debugging, refactoring, architecture decisions
3. **Testing & Validation** — Run test suites, get structured results
4. **Build Pipelines** — Compile, package, deploy code changes
5. **Interactive Problem-Solving** — Back-and-forth iterations without human input

## Quick Example

```javascript
const cc = require('./claude-code-control');

// Start Claude Code
const session = await cc.launch('/path/to/project');

// Send a command
const result = await cc.send(session, 'run pytest tests/ -v');

// Get structured output
console.log(result.status);        // 'success' or 'error'
console.log(result.output);        // Clean command output
console.log(result.testsPassed);   // Parsed from output
```

## Commands Supported

- `run <command>` — Execute shell commands
- `edit <file>` — Edit file (with context)
- `create <file>` — Create new file with content
- `read <file>` — Read file contents
- `find <pattern>` — Search files
- `test` — Run test suites
- `build` — Compile/package code
- `debug <file>` — Interactive debugging

## Installation

```bash
npm install claude-code-control
# or
clawhub install claude-code-control
```

## Configuration

Set in `~/.openclaw/config.yaml`:

```yaml
skills:
  claude-code-control:
    auto_approve: true
    timeout_seconds: 300
    max_retries: 3
    cleanup_on_exit: true
```

## Output Format

All responses are JSON:

```json
{
  "status": "success",
  "command": "pytest tests/ -v",
  "output": "...",
  "duration_ms": 1245,
  "parsed": {
    "tests_passed": 33,
    "tests_failed": 0,
    "warnings": 16
  },
  "errors": []
}
```

## Token Efficiency

- **~200-500 tokens** per command (vs 5-10k for manual agent interaction)
- Useful for agents that need to iterate rapidly
- Ideal for code generation, testing, deployment automation

## Limitations

- Requires Claude Code to be installed + authenticated
- No support for interactive shell sessions (one-shot commands only)
- ANSI codes stripped from output (clean text only)
- File size limit: 10MB per file

## Examples

### Example 1: Run Tests Autonomously

```javascript
const cc = require('./claude-code-control');

async function validateCode(projectPath) {
  const session = await cc.launch(projectPath);
  
  const result = await cc.send(session, 'run pytest tests/ -v');
  
  if (result.parsed.tests_failed > 0) {
    console.error(`${result.parsed.tests_failed} tests failed`);
    return false;
  }
  
  return true;
}
```

### Example 2: Code Generation & Testing Loop

```javascript
async function generateAndTest(spec) {
  const session = await cc.launch('/project');
  
  // Generate code
  await cc.send(session, `create src/feature.py
${spec}`);
  
  // Run tests
  const result = await cc.send(session, 'run pytest tests/test_feature.py -v');
  
  // If tests fail, ask Claude Code to fix
  if (result.parsed.tests_failed > 0) {
    await cc.send(session, 'debug src/feature.py');
  }
  
  return result;
}
```

### Example 3: Deployment Pipeline

```javascript
async function deployPipeline() {
  const session = await cc.launch('/app');
  
  // Build
  await cc.send(session, 'run npm run build');
  
  // Test
  const tests = await cc.send(session, 'run npm test');
  if (tests.status !== 'success') throw new Error('Tests failed');
  
  // Package
  await cc.send(session, 'build');
  
  // Deploy
  await cc.send(session, 'run npm run deploy');
  
  console.log('✅ Deployed successfully');
}
```

## Troubleshooting

**"Claude Code not found in PATH"**
```bash
which claude
# If empty, install: brew install anthropic-cli
```

**"Connection timeout"**
- Increase `timeout_seconds` in config
- Check Claude Code is running: `pgrep -f "claude code"`

**"Command failed with no output"**
- Check file permissions
- Verify project path exists
- Review logs: `tail -f ~/.openclaw/logs/claude-code-control.log`

## API Reference

### `launch(projectPath, options)`
Start a Claude Code instance.
- `projectPath` (string) — Working directory
- `options` (object) — Optional config overrides
- Returns: Session handle

### `send(session, command, timeout)`
Send command to running Claude Code.
- `session` (handle) — From `launch()`
- `command` (string) — Command to run
- `timeout` (number, optional) — Override timeout
- Returns: Promise<Result>

### `close(session)`
Gracefully shut down Claude Code.
- `session` (handle)

### `getStatus(session)`
Check if Claude Code is still running.
- Returns: `{ running: bool, uptime_seconds: number }`

---

**Built for autonomous agents. Sold for $1. Used by everyone.**

Join the OpenClaw ecosystem. [Learn more →](https://clawhub.com)
