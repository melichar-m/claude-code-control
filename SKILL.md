# Claude Code Control

Control Claude Code programmatically through visible Terminal.app windows on macOS.

## How It Works

Uses AppleScript to:
1. Open Terminal.app and launch `claude code` in a project directory
2. Type commands via System Events keystrokes
3. Capture screenshots of just the Terminal window (not full screen)
4. Record video with FFmpeg (avfoundation)
5. Auto-respond to permission prompts
6. Record full sessions with timestamped logs

## Requirements

- macOS
- Node.js 18+
- Claude Code installed and authenticated
- FFmpeg installed (`brew install ffmpeg`) — required for video recording
- Accessibility permissions for Terminal.app + Script Editor (System Settings → Privacy & Security → Accessibility)

## ⚠️ Mandatory Rules

**These rules apply to ALL agents using this skill. Do not skip them.**

### 1. Always run the watcher when Claude Code is building
When you launch Claude Code for a background task, start `watcher.js` immediately:
```bash
node watcher.js --auto-approve &
```
The watcher monitors Terminal.app locally (zero API cost) and sends `openclaw system event` when it detects prompts, errors, or completion.

### 2. Report back IMMEDIATELY when a watcher event wakes you
When you receive a system event from the watcher (completion, error, or prompt that needs manual input), **respond to the user immediately**. Do not wait for them to ask. Do not sit on it. The entire point of the watcher is that you act when pinged.

- Build completes → tell the user what was built
- Error detected → tell the user what broke
- Prompt needs input → handle it or ask the user

**If you fail to respond promptly, the user has no idea what's happening.** That's a broken experience.

### 3. Auto-approve with Shift+Tab when possible
Claude Code's "Do you want to..." prompts support Shift+Tab for "Yes, allow all edits this session." Use this instead of approving one at a time. The watcher does this automatically with `--auto-approve`.

### 4. Don't watch manually
Do NOT poll Terminal content yourself with repeated API calls. That burns tokens watching a screen that says "still building" 99% of the time. Use `watcher.js` — it runs locally for free and only wakes you when something changes.

## Usage

### Basic: Launch + Send Commands

```javascript
const cc = require('./index');

// Launch Claude Code visibly
const session = await cc.launch('/path/to/project');

// Send a command (types it + presses Enter)
const result = await cc.send(session, 'write tests for app.py', 30);
// result.screenshot → path to Terminal window screenshot

// Save session recording
await cc.saveSession(session, './recording.json');

// Close
await cc.close(session);
```

### Video Recording

```javascript
// Start recording at social media dimensions
await cc.startRecording(session, {
  preset: 'x-landscape',  // 1280x720 — also: x-portrait, phone (1080x1920), monitor (native)
  fps: 30,
  outputPath: '/tmp/my-recording.mp4'
});

// ... Claude Code does its thing ...

// Stop recording
const { videoPath, duration } = await cc.stopRecording(session);

// Extract frames for Remotion video generation
const frames = await cc.getFrames(session, {
  extractFps: 2,  // 2 frames per second
  outputDir: '/tmp/my-frames'
});
```

### Prompt Watcher (programmatic)

```javascript
// Auto-respond to permission prompts
cc.watchForPrompts(session, {
  intervalMs: 2000,
  onPrompt: (label, response) => console.log(`Auto-approved: ${label}`)
});

// Stop when done
cc.stopWatching(session);
```

### Standalone Watcher (recommended for background builds)

```bash
# Run alongside any Claude Code session
node watcher.js --auto-approve

# Custom poll interval
node watcher.js --auto-approve --interval 2000
```

The watcher sends `openclaw system event` on:
- **Prompts** — auto-approves with Shift+Tab (if --auto-approve)
- **Errors** — wakes the agent with error details
- **Completion** — wakes the agent when build finishes

### Video Generator (Remotion)

Turn recordings into 15-30 second social media product demos:

```bash
cd video-generator && npm install

# Render a demo video
npx ts-node render.ts \
  --frames-dir /tmp/my-frames \
  --captions '[{"text":"building something cool","startFrame":0,"durationFrames":90,"layout":"slide-in"}]' \
  --preset x-landscape \
  --output /tmp/demo.mp4
```

## API Reference

| Function | Description |
|---|---|
| `launch(path, opts?)` | Open Terminal + start Claude Code. Returns session ID |
| `send(id, command, waitSec?)` | Type command, wait, screenshot |
| `verifyScreen(id, desc)` | Take a verification screenshot |
| `approveSecurity(id)` | Handle "trust this folder" prompt |
| `handleLogin(id)` | Send `/login` command |
| `saveSession(id, path)` | Save session log to JSON |
| `close(id)` / `closeAll()` | Exit Claude Code gracefully |
| `takeScreenshot(path?)` | Capture Terminal window |
| `focusTerminal()` | Bring Terminal to front |
| `resizeTerminal(w, h)` | Resize Terminal window |
| `startRecording(id, opts)` | Start FFmpeg video recording |
| `stopRecording(id)` | Stop recording, returns video path |
| `getFrames(id, opts)` | Extract frames from recording |
| `readTerminalContent(id)` | Read Terminal text content |
| `watchForPrompts(id, opts)` | Auto-respond to permission prompts |
| `stopWatching(id)` | Stop prompt watcher |

## Window Presets

| Preset | Dimensions | Use Case |
|---|---|---|
| `x-landscape` | 1280×720 | X/Twitter landscape video |
| `x-portrait` | 1080×1920 | X/Twitter vertical video |
| `phone` | 1080×1920 | Instagram/TikTok |
| `monitor` | native | Full screen capture |

## Pro Features ($9.99/mo)

- 🎬 Video recording with social media presets
- 🎥 Remotion video generator (auto product demos)
- 👁 Standalone watcher with auto-approve
- 🤖 Multi-agent / multi-terminal orchestration (coming)
- 📊 Session analytics (coming)
- 🔄 Session replay (coming)
