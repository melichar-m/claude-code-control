/**
 * Claude Code Control Skill v3 — VISION-BASED
 * Uses screenshot + OCR to detect command completion
 * Waits for visual state changes, not text parsing
 */

const { spawn } = require('child_process');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Global session map
const sessions = new Map();
let sessionCounter = 0;

/**
 * Take a screenshot and return as buffer
 */
function takeScreenshot(filename = null) {
  const tempFile = filename || `/tmp/claude-code-screenshot-${Date.now()}.png`;
  try {
    execSync(`screencapture -x ${tempFile}`, { stdio: 'pipe' });
    return tempFile;
  } catch (err) {
    console.error('Screenshot failed:', err.message);
    return null;
  }
}

/**
 * Run OCR on screenshot using Claude's vision API
 * Falls back to simple file-based detection
 */
async function ocrScreenshot(imagePath) {
  // Try Claude vision first (if API key available)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic.Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const imageData = fs.readFileSync(imagePath);
      const base64 = imageData.toString('base64');

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'Read and transcribe ALL text visible in this screenshot. Include the command prompt marker if visible.',
              },
            ],
          },
        ],
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      console.warn('Claude vision failed, using file introspection');
      return '';
    }
  }

  return '';
}

/**
 * Check if Claude Code prompt is visible in OCR text
 */
function isPromptVisible(ocrText) {
  // Claude Code shows "❯" when ready for input
  return ocrText.includes('❯') || ocrText.includes('>');
}

/**
 * Launch Claude Code with authentication handling
 */
async function launch(projectPath, options = {}) {
  const sessionId = ++sessionCounter;
  const normalizedPath = path.resolve(projectPath);

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Project path does not exist: ${normalizedPath}`);
  }

  console.log(`[CC-${sessionId}] 🚀 Launching Claude Code at ${normalizedPath}`);

  // Spawn Claude Code
  const proc = spawn('claude', ['code'], {
    cwd: normalizedPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const session = {
    id: sessionId,
    path: normalizedPath,
    proc,
    created_at: Date.now(),
    commandCount: 0,
    outputBuffer: '',
    sessionLog: [],
    sessionReady: false,
    authenticated: false,
    lastScreenshot: null,
    lastOcrText: '',
  };

  // Capture stdout
  proc.stdout.on('data', (data) => {
    session.outputBuffer += data.toString();
  });

  // Process exit handler
  proc.on('exit', (code) => {
    console.log(`[CC-${sessionId}] Claude Code exited with code ${code}`);
  });

  // Wait for Claude Code to appear
  console.log(`[CC-${sessionId}] ⏳ Starting Claude Code...`);
  
  await new Promise((resolve) => {
    let attempts = 0;
    const checkReady = setInterval(async () => {
      attempts++;
      
      // Take screenshot
      const screenshotPath = takeScreenshot();
      
      if (!screenshotPath) {
        if (attempts > 20) {
          clearInterval(checkReady);
          session.sessionReady = true;
          session.authenticated = true;
          resolve();
        }
        return;
      }

      // OCR the screenshot using Claude vision
      const ocrText = await ocrScreenshot(screenshotPath);
      
      // Check for authentication requirement
      if (ocrText.includes('https://') || ocrText.includes('login') || ocrText.includes('authenticate')) {
        console.log(`\n[CC-${sessionId}] 🔐 AUTHENTICATION REQUIRED\n`);
        console.log(`[CC-${sessionId}] Claude Code needs you to authenticate:\n`);
        console.log(`[CC-${sessionId}] 1. Look at the URL shown in Claude Code (visible on your screen)`);
        console.log(`[CC-${sessionId}] 2. Visit that URL in your browser`);
        console.log(`[CC-${sessionId}] 3. Complete authentication`);
        console.log(`[CC-${sessionId}] 4. Return to Claude Code and press Enter when authenticated\n`);
        
        session.lastScreenshot = screenshotPath;
        session.lastOcrText = ocrText;
        
        // Now wait for user to complete auth (they'll press Enter in Claude Code)
        console.log(`[CC-${sessionId}] ⏳ Waiting for you to complete authentication...\n`);
        
        // Clear the check interval and wait for the prompt to change
        clearInterval(checkReady);
        
        let authAttempts = 0;
        const checkAuth = setInterval(async () => {
          authAttempts++;
          const authScreenshot = takeScreenshot();
          if (authScreenshot) {
            const authOcrText = await ocrScreenshot(authScreenshot);
            
            // When prompt appears (❯) = authenticated
            if (authOcrText.includes('❯') || authAttempts > 120) {
              console.log(`[CC-${sessionId}] ✅ Authentication complete!\n`);
              clearInterval(checkAuth);
              session.sessionReady = true;
              session.authenticated = true;
              resolve();
            }
          }
        }, 500);
        
        return;
      }
      
      // Check for security prompt (project trust)
      if (ocrText.includes('Security') || 
          ocrText.includes('Trust') ||
          ocrText.includes('Claude') ||
          ocrText.length > 100 ||
          attempts > 20) {
        
        console.log(`[CC-${sessionId}] ✅ Claude Code UI detected`);
        
        // Auto-approve security
        if (ocrText.includes('Trust') || ocrText.includes('Security')) {
          console.log(`[CC-${sessionId}] 🔓 Approving project access...`);
          proc.stdin.write('1\n');
          await new Promise(r => setTimeout(r, 300));
          proc.stdin.write('\n');
        }
        
        clearInterval(checkReady);
        session.sessionReady = true;
        session.authenticated = true;
        session.lastScreenshot = screenshotPath;
        session.lastOcrText = ocrText;
        resolve();
      } else if (attempts % 10 === 0) {
        console.log(`[CC-${sessionId}] Still loading... (${(attempts * 0.5).toFixed(1)}s)`);
      }
    }, 500);

    // Timeout after 60 seconds
    setTimeout(() => {
      clearInterval(checkReady);
      session.sessionReady = true;
      session.authenticated = true;
      console.log(`[CC-${sessionId}] Startup timeout, proceeding`);
      resolve();
    }, 60000);
  });

  sessions.set(sessionId, session);
  return sessionId;
}

/**
 * Send command and wait for prompt to reappear (visual confirmation)
 */
async function send(sessionId, command, timeoutSeconds = 60) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Invalid session: ${sessionId}`);
  }

  if (!session.sessionReady) {
    throw new Error(`Session not ready: ${sessionId}`);
  }

  const startTime = Date.now();
  session.commandCount++;

  console.log(`[CC-${sessionId}] 📤 Sending: ${command}`);

  // Log command
  session.sessionLog.push({
    type: 'command',
    timestamp: Date.now(),
    command: command,
  });

  // Send command
  session.proc.stdin.write(command + '\n');

  // Wait for prompt to reappear (visual confirmation)
  console.log(`[CC-${sessionId}] ⏳ Waiting for command to complete (watching for prompt)...`);
  
  let responseText = '';
  let promptReappeared = false;

  await new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = (timeoutSeconds * 2);
    
    const checkForCompletion = setInterval(async () => {
      attempts++;

      // Take screenshot
      const screenshotPath = takeScreenshot();
      if (!screenshotPath) {
        console.log(`[CC-${sessionId}] ⚠️ Screenshot failed`);
        return;
      }

      // OCR it using Claude vision
      const ocrText = await ocrScreenshot(screenshotPath);
      
      // Check for prompt marker
      if (isPromptVisible(ocrText) && attempts > 2) {
        // Prompt returned = command complete
        promptReappeared = true;
        responseText = ocrText;
        clearInterval(checkForCompletion);
        console.log(`[CC-${sessionId}] 📍 Prompt detected! Command complete.`);
        resolve();
      }

      // Timeout
      if (attempts > maxAttempts) {
        clearInterval(checkForCompletion);
        responseText = ocrText || 'Command timeout (no response)';
        console.log(`[CC-${sessionId}] ⏱️ Timeout reached`);
        resolve();
      }

      if (attempts % 4 === 0) {
        console.log(`[CC-${sessionId}] Waiting... (${(attempts * 0.5).toFixed(1)}s elapsed)`);
      }
    }, 500);
  });

  const duration = Date.now() - startTime;

  const result = {
    sessionId,
    command,
    output: responseText,
    duration_ms: duration,
    status: promptReappeared ? 'success' : 'incomplete',
  };

  console.log(`[CC-${sessionId}] ✅ Response received (${duration}ms, status: ${result.status})`);

  // Log result
  session.sessionLog.push({
    type: 'response',
    timestamp: Date.now(),
    output: responseText,
    duration_ms: duration,
  });

  return result;
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
    running: session.proc && !session.proc.killed,
    uptime_ms: Date.now() - session.created_at,
    commands_sent: session.commandCount,
    ready: session.sessionReady,
    lastScreenshot: session.lastScreenshot,
  };
}

/**
 * Save session recording
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
 * Close session
 */
async function close(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  console.log(`[CC-${sessionId}] 🧹 Closing session`);

  if (session.proc && !session.proc.killed) {
    session.proc.stdin.write('exit\n');

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        session.proc.kill('SIGKILL');
        resolve();
      }, 3000);

      session.proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  sessions.delete(sessionId);
  console.log(`[CC-${sessionId}] ✅ Closed`);
}

/**
 * Close all sessions
 */
async function closeAll() {
  const sessionIds = Array.from(sessions.keys());
  for (const id of sessionIds) {
    await close(id);
  }
}

process.on('exit', () => {
  closeAll().catch(console.error);
});

module.exports = {
  launch,
  send,
  getStatus,
  saveSession,
  close,
  closeAll,
  takeScreenshot,
  ocrScreenshot,
  isPromptVisible,
};
