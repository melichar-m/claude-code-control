# Claude Code Control — Skill for OpenClaw

**Let autonomous agents control Claude Code without manual intervention.**

This skill provides a clean Node.js API for agents to:
- Launch Claude Code instances
- Execute commands (tests, builds, code generation)
- Parse structured output
- Chain operations autonomously
- Handle long-running tasks

---

## Why This Exists

Claude Code is powerful, but interactive. Agents get stuck at prompts:
- "Is this a project you trust?" ❌
- "Not logged in · Run /login" ❌
- Waiting for command output ❌

This skill **abstracts all that away**. Agents send clean commands, get clean JSON back.

---

## Quick Start

### Install

```bash
npm install
```

### Usage

```javascript
const cc = require('./index');

// Launch Claude Code
const session = await cc.launch('/path/to/project');

// Send a command
const result = await cc.send(session, 'run pytest tests/ -v');

// Get results
console.log(result.parsed.tests_passed); // 33
console.log(result.parsed.tests_failed);  // 0

// Close gracefully
await cc.close(session);
```

### Run Example

```bash
# Test with Atlas Dashboard
ATLAS_PATH=/path/to/atlas-dashboard-mvp node examples/run-atlas-tests.js
```

Expected output:
```
🚀 Running Atlas Dashboard tests via Claude Code
📂 Starting Claude Code at /path/to/atlas-dashboard-mvp
🧪 Running pytest...

📊 Test Results:
{
  "tests_passed": 33,
  "tests_failed": 0,
  "tests_skipped": 0,
  "warnings": 16,
  "duration_seconds": 1.54
}

✅ All 33 tests passed!
```

---

## API

### `launch(projectPath, options)`

Start a Claude Code instance.

**Args:**
- `projectPath` (string) — Working directory
- `options` (object, optional) — Config overrides

**Returns:** Promise<sessionId>

**Example:**
```javascript
const sessionId = await cc.launch('/home/user/my-project');
```

---

### `send(sessionId, command, timeoutSeconds)`

Send a command to Claude Code.

**Args:**
- `sessionId` (string) — From `launch()`
- `command` (string) — Shell command to run
- `timeoutSeconds` (number, optional) — Timeout (default: 300)

**Returns:** Promise<Result>

**Result object:**
```json
{
  "sessionId": "1",
  "command": "pytest tests/ -v",
  "status": "success",
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

**Example:**
```javascript
const result = await cc.send(sessionId, 'run npm test');
if (result.parsed.tests_failed === 0) {
  console.log('✅ All tests passed');
}
```

---

### `getStatus(sessionId)`

Check if Claude Code is still running.

**Returns:** Object or null

```javascript
const status = cc.getStatus(sessionId);
console.log(status.uptime_ms);     // How long it's been running
console.log(status.commands_sent); // How many commands sent
console.log(status.running);       // true/false
```

---

### `close(sessionId)`

Gracefully shut down Claude Code.

**Example:**
```javascript
await cc.close(sessionId);
```

---

### `closeAll()`

Close all active sessions.

```javascript
await cc.closeAll();
```

---

## Supported Commands

**Testing:**
```javascript
await cc.send(sessionId, 'run pytest tests/ -v');
await cc.send(sessionId, 'run npm test');
await cc.send(sessionId, 'run cargo test');
```

**Building:**
```javascript
await cc.send(sessionId, 'run npm run build');
await cc.send(sessionId, 'run go build ./...');
await cc.send(sessionId, 'run python setup.py build');
```

**Code Generation:**
```javascript
await cc.send(sessionId, 'create src/feature.js\n... code here ...');
await cc.send(sessionId, 'edit src/feature.js\n... changes ...');
```

**Debugging:**
```javascript
await cc.send(sessionId, 'debug src/main.py');
```

---

## Real-World Example: CI/CD Pipeline

```javascript
const cc = require('./index');

async function ciPipeline(projectPath) {
  const session = await cc.launch(projectPath);

  try {
    // 1. Run tests
    console.log('Testing...');
    const tests = await cc.send(session, 'run pytest tests/ -v');
    if (tests.parsed.tests_failed > 0) {
      throw new Error('Tests failed');
    }

    // 2. Build
    console.log('Building...');
    const build = await cc.send(session, 'run npm run build');
    if (build.status !== 'success') {
      throw new Error('Build failed');
    }

    // 3. Lint
    console.log('Linting...');
    const lint = await cc.send(session, 'run npm run lint');

    // 4. Deploy
    console.log('Deploying...');
    await cc.send(session, 'run npm run deploy');

    console.log('✅ Pipeline succeeded');
    return true;
  } catch (err) {
    console.error('❌ Pipeline failed:', err.message);
    return false;
  } finally {
    await cc.close(session);
  }
}
```

---

## Performance

- **Startup:** ~500ms (Claude Code init)
- **Per-command:** ~200-500ms (vs 5-10k tokens for manual agent interaction)
- **Memory:** ~50MB per session
- **Token cost:** Minimal (mostly stdout parsing)

---

## Limitations

1. **Not interactive** — One-shot commands only (no REPL)
2. **File size limit** — 10MB per file read/write
3. **Requires Claude Code** — Must be installed (`which claude`)
4. **ANSI stripping** — Color codes removed from output
5. **Process-level** — No fine-grained permission model

---

## Troubleshooting

### "Claude Code not found"
```bash
which claude
# If empty:
brew install anthropic-cli
```

### "Connection timeout"
Increase timeout:
```javascript
await cc.send(sessionId, 'run long-running-command', 600);
```

### "Session killed unexpectedly"
Check system resources (memory, disk space). Sessions auto-cleanup on exit.

---

## Security

⚠️ This skill should only be used with **trusted projects**. Claude Code will execute arbitrary commands.

- Never run on untrusted code
- Validate project paths before `launch()`
- Use in isolated environments (containers, VMs)
- Audit command history: `cc.getStatus(sessionId)`

---

## Contributing

Found a bug? Have a feature request?

Open an issue: [GitHub Issues](https://github.com/efficacy-labs/claude-code-control/issues)

---

## License

MIT

---

## Author

Built by **Efficacy Labs** for the OpenClaw ecosystem.

[Learn more →](https://efficacy.ai)
