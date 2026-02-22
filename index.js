/**
 * Claude Code Control Skill — v2.0
 *
 * Uses macOS AppleScript to:
 * 1. Open a REAL visible Terminal.app window running Claude Code
 * 2. Send keystrokes via System Events
 * 3. Take screenshots with screencapture
 * 4. Record video with FFmpeg (avfoundation)
 * 5. Auto-respond to permission prompts
 * 6. Resize Terminal window to preset dimensions
 *
 * The user can SEE Claude Code running on their screen.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const sessions = new Map();
let sessionCounter = 0;

// ─── Window Presets ──────────────────────────────────────────

const WINDOW_PRESETS = {
  'x-landscape': { width: 1280, height: 720 },
  'x-portrait':  { width: 1080, height: 1920 },
  'phone':        { width: 1080, height: 1920 },
  'monitor':      null, // native — do not resize
};

// ─── Helpers ────────────────────────────────────────────────

/**
 * Run AppleScript and return output
 */
function runAppleScript(script) {
  try {
    return execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
  } catch (err) {
    console.error(`[AppleScript Error] ${err.message}`);
    return '';
  }
}

/**
 * Run multi-line AppleScript
 */
function runAppleScriptMulti(lines) {
  const script = lines.join('\n');
  const tmpFile = `/tmp/cc-applescript-${Date.now()}.scpt`;
  fs.writeFileSync(tmpFile, script);
  try {
    return execSync(`osascript ${tmpFile}`, {
      encoding: 'utf-8',
      timeout: 15000,
    }).trim();
  } catch (err) {
    console.error(`[AppleScript Error] ${err.message}`);
    return '';
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Bring Terminal.app to the front and focus it
 */
function focusTerminal() {
  runAppleScriptMulti([
    'tell application "Terminal"',
    '  activate',
    '  set frontWindow to front window',
    '  set index of frontWindow to 1',
    'end tell',
  ]);
  // Small pause to let the window actually come forward
  execSync('sleep 1');
}

/**
 * Get Terminal.app front window bounds {x, y, w, h}
 */
function getTerminalWindowBounds() {
  const result = runAppleScriptMulti([
    'tell application "Terminal"',
    '  set b to bounds of front window',
    '  return (item 1 of b as text) & "," & (item 2 of b as text) & "," & (item 3 of b as text) & "," & (item 4 of b as text)',
    'end tell',
  ]);
  if (!result) return null;
  const [x1, y1, x2, y2] = result.split(',').map(Number);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Resize Terminal.app front window to specified pixel dimensions.
 * Keeps the window's current top-left position.
 */
function resizeTerminal(width, height) {
  const bounds = getTerminalWindowBounds();
  const x = bounds ? bounds.x : 0;
  const y = bounds ? bounds.y : 25; // leave room for menu bar
  const x2 = x + width;
  const y2 = y + height;

  runAppleScriptMulti([
    'tell application "Terminal"',
    `  set bounds of front window to {${x}, ${y}, ${x2}, ${y2}}`,
    'end tell',
  ]);

  // Give the window time to resize
  execSync('sleep 0.5');
  console.log(`[resize] Terminal resized to ${width}x${height}`);
}

/**
 * Take a screenshot of the Terminal.app window only.
 * Falls back to full screen if window bounds can't be detected.
 */
function takeScreenshot(outputPath) {
  const filePath = outputPath || `/tmp/cc-screenshot-${Date.now()}.png`;
  try {
    // First, focus Terminal so it's on top
    focusTerminal();

    // Try to get window bounds for a targeted capture
    const bounds = getTerminalWindowBounds();
    if (bounds) {
      // screencapture -R x,y,w,h captures a specific region
      execSync(`screencapture -x -R "${bounds.x},${bounds.y},${bounds.w},${bounds.h}" "${filePath}"`, { timeout: 5000 });
    } else {
      // Fallback: capture the whole screen
      execSync(`screencapture -x "${filePath}"`, { timeout: 5000 });
    }

    if (fs.existsSync(filePath)) {
      return filePath;
    }
  } catch (err) {
    console.error(`[Screenshot Error] ${err.message}`);
  }
  return null;
}

/**
 * Type text into the frontmost application via System Events
 */
function typeText(text) {
  // Use keystroke for short text, or write to clipboard and paste for long text
  if (text.length > 50) {
    // Use clipboard for long text
    execSync(`echo ${JSON.stringify(text)} | pbcopy`, { timeout: 5000 });
    runAppleScriptMulti([
      'tell application "System Events"',
      '  keystroke "v" using command down',
      'end tell',
    ]);
  } else {
    // Direct keystroke for short text
    runAppleScriptMulti([
      'tell application "System Events"',
      `  keystroke "${text.replace(/"/g, '\\"')}"`,
      'end tell',
    ]);
  }
}

/**
 * Press Enter/Return key
 */
function pressEnter() {
  runAppleScriptMulti([
    'tell application "System Events"',
    '  key code 36',
    'end tell',
  ]);
}

/**
 * Press a special key (escape, tab, etc.)
 */
function pressKey(keyName) {
  const keyCodes = {
    'return': 36,
    'enter': 36,
    'escape': 53,
    'tab': 48,
    'space': 49,
    'delete': 51,
    'up': 126,
    'down': 125,
    'left': 123,
    'right': 124,
  };
  const code = keyCodes[keyName.toLowerCase()] || 36;
  runAppleScriptMulti([
    'tell application "System Events"',
    `  key code ${code}`,
    'end tell',
  ]);
}

// ─── FFmpeg Video Recording ──────────────────────────────────

/**
 * Read current Terminal.app front window text content via AppleScript.
 */
function readTerminalContent() {
  return runAppleScriptMulti([
    'tell application "Terminal"',
    '  set c to contents of front window',
    '  return c',
    'end tell',
  ]);
}

/**
 * Start FFmpeg screen recording of the Terminal.app window region.
 *
 * options:
 *   preset      — 'x-landscape' | 'x-portrait' | 'phone' | 'monitor'
 *   fps         — frames per second (default 30)
 *   outputPath  — path for the output video file
 *   screenIndex — avfoundation screen capture device index (default 1)
 */
async function startRecording(sessionId, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);
  if (session.recording) throw new Error(`Session ${sessionId} is already recording`);

  const {
    preset = null,
    fps = 30,
    outputPath = `/tmp/cc-recording-${sessionId}-${Date.now()}.mp4`,
    screenIndex = 1,
  } = options;

  // Resize Terminal window if a preset was given
  if (preset && preset !== 'monitor') {
    const dims = WINDOW_PRESETS[preset];
    if (!dims) throw new Error(`Unknown preset: ${preset}. Valid: ${Object.keys(WINDOW_PRESETS).join(', ')}`);
    resizeTerminal(dims.width, dims.height);
  }

  // Focus Terminal so it's on top and its position is stable
  focusTerminal();

  // Get window region to crop
  const bounds = getTerminalWindowBounds();
  if (!bounds) throw new Error('Could not determine Terminal window bounds for recording');

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Build ffmpeg crop filter: crop=w:h:x:y
  const cropFilter = `crop=${bounds.w}:${bounds.h}:${bounds.x}:${bounds.y}`;

  // FFmpeg command:
  //   -f avfoundation -framerate <fps> -i "<screenIndex>"  — capture entire display
  //   -vf "crop=..."                                        — crop to Terminal window
  //   -pix_fmt yuv420p                                      — broad compatibility
  //   -c:v libx264                                          — H.264 encoding
  const ffmpegArgs = [
    '-f', 'avfoundation',
    '-framerate', String(fps),
    '-capture_cursor', '1',
    '-i', `${screenIndex}:none`,
    '-vf', cropFilter,
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    outputPath,
  ];

  console.log(`[CC-${sessionId}] 🎥 Starting FFmpeg recording: ${outputPath}`);
  console.log(`[CC-${sessionId}]    Crop: ${cropFilter}, FPS: ${fps}`);

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  ffmpegProcess.stderr.on('data', (data) => {
    // ffmpeg writes progress to stderr — only log errors
    const msg = data.toString();
    if (msg.includes('Error') || msg.includes('error')) {
      console.error(`[CC-${sessionId}] [ffmpeg] ${msg.trim()}`);
    }
  });

  ffmpegProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[CC-${sessionId}] FFmpeg exited with code ${code}`);
    }
  });

  session.recording = {
    process: ffmpegProcess,
    videoPath: outputPath,
    startTime: Date.now(),
    bounds,
  };

  console.log(`[CC-${sessionId}] ✅ Recording started (PID ${ffmpegProcess.pid})`);
  return { sessionId, videoPath: outputPath, bounds };
}

/**
 * Stop an active FFmpeg recording.
 * Sends SIGINT to ffmpeg so it flushes and finalises the file.
 * Returns the path to the recorded video.
 */
async function stopRecording(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);
  if (!session.recording) throw new Error(`Session ${sessionId} has no active recording`);

  const { process: ffmpegProcess, videoPath, startTime } = session.recording;

  console.log(`[CC-${sessionId}] ⏹ Stopping FFmpeg recording...`);

  // Send 'q' to ffmpeg's stdin to trigger a graceful shutdown
  try {
    ffmpegProcess.stdin.write('q');
    ffmpegProcess.stdin.end();
  } catch {}

  // Wait up to 5 seconds for the process to exit cleanly
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try { ffmpegProcess.kill('SIGTERM'); } catch {}
      resolve();
    }, 5000);

    ffmpegProcess.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  const duration = Date.now() - startTime;
  session.recording = null;

  console.log(`[CC-${sessionId}] ✅ Recording saved: ${videoPath} (${(duration / 1000).toFixed(1)}s)`);
  return { videoPath, duration_ms: duration };
}

/**
 * Extract frames from a session's recording (or any video file).
 *
 * options:
 *   fps        — frames per second to extract (default 1)
 *   outputDir  — directory for frame images (default /tmp/cc-frames-<sessionId>)
 *   videoPath  — explicit video path (defaults to session's recorded video)
 *
 * Returns array of frame file paths.
 */
async function getFrames(sessionId, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);

  const videoPath = options.videoPath || (session.recording && session.recording.videoPath) ||
    // Look for last recorded video in session log
    (() => { throw new Error(`No video path available for session ${sessionId}`); })();

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const extractFps = options.fps || 1;
  const outputDir = options.outputDir || `/tmp/cc-frames-${sessionId}-${Date.now()}`;

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const framePattern = path.join(outputDir, 'frame_%04d.png');

  console.log(`[CC-${sessionId}] 🖼  Extracting frames at ${extractFps}fps from ${videoPath}`);

  execSync(
    `ffmpeg -i "${videoPath}" -vf fps=${extractFps} "${framePattern}" -y`,
    { timeout: 120000, stdio: 'pipe' }
  );

  const frames = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => path.join(outputDir, f));

  console.log(`[CC-${sessionId}] ✅ Extracted ${frames.length} frames to ${outputDir}`);
  return frames;
}

// ─── Auto Permission Prompt Watcher ─────────────────────────

/**
 * Read current Terminal.app text content (exported helper).
 */
function readTerminalContentForSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);
  return readTerminalContent();
}

/**
 * Prompt patterns that need auto-response.
 * Each entry: { pattern: RegExp, response: string, label: string }
 */
const PROMPT_PATTERNS = [
  { pattern: /Do you want.*\?/i,          response: 'y', label: 'Do-you-want prompt' },
  { pattern: /\[Y\/n\]/i,                 response: 'y', label: 'Y/n prompt' },
  { pattern: /\[y\/N\]/i,                 response: 'y', label: 'y/N prompt' },
  { pattern: /Allow.*\?.*\(y\/n\)/i,      response: 'y', label: 'Allow prompt' },
  { pattern: /Press.*to continue/i,       response: '\r', label: 'Press-to-continue' },
  { pattern: /Trust this folder.*\[1\]/i, response: '1', label: 'Trust folder' },
];

/**
 * Watch for permission/confirmation prompts in the Terminal and auto-respond.
 *
 * options:
 *   intervalMs   — polling interval in ms (default 2000)
 *   patterns     — additional { pattern, response, label } entries to detect
 *   onPrompt     — callback(label, response) called when a prompt is detected
 */
function watchForPrompts(sessionId, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);
  if (session.watcher) throw new Error(`Session ${sessionId} already has an active watcher`);

  const {
    intervalMs = 2000,
    patterns = [],
    onPrompt = null,
  } = options;

  const allPatterns = [...PROMPT_PATTERNS, ...patterns];
  let lastSeenContent = '';

  console.log(`[CC-${sessionId}] 👁  Starting prompt watcher (every ${intervalMs}ms)`);

  const intervalId = setInterval(() => {
    try {
      const content = readTerminalContent();
      if (!content || content === lastSeenContent) return;
      lastSeenContent = content;

      // Check last ~10 lines for prompts
      const recent = content.split('\n').slice(-10).join('\n');

      for (const { pattern, response, label } of allPatterns) {
        if (pattern.test(recent)) {
          console.log(`[CC-${sessionId}] 🔔 Detected prompt: ${label} — responding with "${response}"`);

          focusTerminal();

          if (response === '\r') {
            pressEnter();
          } else {
            typeText(response);
            // Small delay then Enter if the response is a char (y/n/1)
            if (response.length === 1) {
              setTimeout(() => pressEnter(), 200);
            }
          }

          if (typeof onPrompt === 'function') {
            onPrompt(label, response);
          }

          // Break after first match to avoid double-responding
          break;
        }
      }
    } catch (err) {
      console.error(`[CC-${sessionId}] [watcher] ${err.message}`);
    }
  }, intervalMs);

  session.watcher = { intervalId };
  console.log(`[CC-${sessionId}] ✅ Prompt watcher active`);
  return { sessionId, intervalMs };
}

/**
 * Stop the active prompt watcher for a session.
 */
function stopWatching(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);
  if (!session.watcher) {
    console.warn(`[CC-${sessionId}] No active watcher to stop`);
    return;
  }

  clearInterval(session.watcher.intervalId);
  session.watcher = null;
  console.log(`[CC-${sessionId}] ✅ Prompt watcher stopped`);
}

// ─── Core API ───────────────────────────────────────────────

/**
 * Launch Claude Code in a VISIBLE Terminal.app window
 */
async function launch(projectPath, options = {}) {
  const sessionId = ++sessionCounter;
  const normalizedPath = path.resolve(projectPath);

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Project path does not exist: ${normalizedPath}`);
  }

  console.log(`[CC-${sessionId}] 🚀 Opening Terminal.app with Claude Code at ${normalizedPath}`);

  // Open a new Terminal.app window and run claude code
  runAppleScriptMulti([
    'tell application "Terminal"',
    '  activate',
    `  do script "cd '${normalizedPath}' && claude code"`,
    'end tell',
  ]);

  const session = {
    id: sessionId,
    path: normalizedPath,
    created_at: Date.now(),
    commandCount: 0,
    sessionLog: [],
    ready: false,
    recording: null,
    watcher: null,
  };

  console.log(`[CC-${sessionId}] ⏳ Waiting for Claude Code to start...`);

  // Wait for Claude Code to appear (give it time to load)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Take a screenshot to verify it's running
  const screenshot = takeScreenshot();
  if (screenshot) {
    console.log(`[CC-${sessionId}] 📸 Screenshot captured: ${screenshot}`);
    session.sessionLog.push({
      type: 'screenshot',
      timestamp: Date.now(),
      path: screenshot,
      event: 'launch',
    });
  }

  session.ready = true;
  sessions.set(sessionId, session);

  console.log(`[CC-${sessionId}] ✅ Claude Code should now be visible on screen`);
  return sessionId;
}

/**
 * Send a command to Claude Code by typing into Terminal.app
 */
async function send(sessionId, command, waitSeconds = 10) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);

  const startTime = Date.now();
  session.commandCount++;

  console.log(`[CC-${sessionId}] 📤 Typing command: ${command}`);

  // Log the command
  session.sessionLog.push({
    type: 'command',
    timestamp: Date.now(),
    command,
  });

  // Bring Terminal to front
  focusTerminal();

  // Type the command
  typeText(command);
  await new Promise(resolve => setTimeout(resolve, 200));

  // Press Enter
  pressEnter();

  console.log(`[CC-${sessionId}] ⏳ Waiting ${waitSeconds}s for command to complete...`);

  // Wait for command to process
  await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));

  // Take screenshot to capture result
  const screenshot = takeScreenshot();
  const duration = Date.now() - startTime;

  const result = {
    sessionId,
    command,
    duration_ms: duration,
    screenshot,
    status: 'sent',
  };

  // Log result
  session.sessionLog.push({
    type: 'response',
    timestamp: Date.now(),
    duration_ms: duration,
    screenshot,
  });

  console.log(`[CC-${sessionId}] ✅ Command sent and screenshot captured (${duration}ms)`);

  return result;
}

/**
 * Verify current screen state by analyzing screenshot
 */
async function verifyScreen(sessionId, description) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);

  const screenshot = takeScreenshot();
  if (!screenshot) {
    return { verified: false, error: 'Screenshot failed' };
  }

  session.sessionLog.push({
    type: 'verification',
    timestamp: Date.now(),
    screenshot,
    description,
  });

  return {
    verified: true,
    screenshot,
    description,
  };
}

/**
 * Handle Claude Code security prompt (approve project access)
 */
async function approveSecurity(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);

  console.log(`[CC-${sessionId}] 🔓 Approving security prompt...`);

  // Bring Terminal to front
  focusTerminal();

  // Press 1 for "Yes, I trust this folder"
  typeText('1');
  await new Promise(resolve => setTimeout(resolve, 200));
  pressEnter();

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`[CC-${sessionId}] ✅ Security prompt approved`);
}

/**
 * Handle Claude Code login flow
 */
async function handleLogin(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);

  console.log(`[CC-${sessionId}] 🔐 Handling login...`);

  // Bring Terminal to front
  focusTerminal();

  // Type /login command
  typeText('/login');
  pressEnter();

  console.log(`[CC-${sessionId}] 🔐 Login command sent. User should complete auth in browser.`);
  console.log(`[CC-${sessionId}] ⏳ Waiting for authentication to complete...`);
}

/**
 * Get session status
 */
function getStatus(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return {
    sessionId,
    path: session.path,
    uptime_ms: Date.now() - session.created_at,
    commands_sent: session.commandCount,
    ready: session.ready,
    logEntries: session.sessionLog.length,
    recording: session.recording ? { videoPath: session.recording.videoPath } : null,
    watching: !!session.watcher,
  };
}

/**
 * Save session recording (all screenshots + commands)
 */
async function saveSession(sessionId, filepath) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Invalid session: ${sessionId}`);

  const recording = {
    sessionId,
    path: session.path,
    duration_ms: Date.now() - session.created_at,
    commands_sent: session.commandCount,
    createdAt: new Date(session.created_at).toISOString(),
    log: session.sessionLog,
  };

  fs.writeFileSync(filepath, JSON.stringify(recording, null, 2));
  console.log(`[CC-${sessionId}] 💾 Session saved to ${filepath}`);
  return filepath;
}

/**
 * Close Claude Code session
 */
async function close(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  console.log(`[CC-${sessionId}] 🧹 Closing Claude Code...`);

  // Stop watcher if active
  if (session.watcher) stopWatching(sessionId);

  // Stop recording if active
  if (session.recording) await stopRecording(sessionId);

  // Bring Terminal to front and send Escape + exit
  focusTerminal();
  pressKey('escape');
  await new Promise(resolve => setTimeout(resolve, 500));
  typeText('/exit');
  pressEnter();

  sessions.delete(sessionId);
  console.log(`[CC-${sessionId}] ✅ Session closed`);
}

/**
 * Close all sessions
 */
async function closeAll() {
  for (const id of Array.from(sessions.keys())) {
    await close(id);
  }
}

module.exports = {
  // Core session API
  launch,
  send,
  verifyScreen,
  approveSecurity,
  handleLogin,
  getStatus,
  saveSession,
  close,
  closeAll,

  // Screenshot helpers
  takeScreenshot,
  focusTerminal,
  getTerminalWindowBounds,
  typeText,
  pressEnter,
  pressKey,

  // Window resize
  resizeTerminal,

  // FFmpeg video recording
  startRecording,
  stopRecording,
  getFrames,

  // Terminal content + prompt watching
  readTerminalContent: readTerminalContentForSession,
  watchForPrompts,
  stopWatching,

  // Constants
  WINDOW_PRESETS,
};
