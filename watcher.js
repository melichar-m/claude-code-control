#!/usr/bin/env node
/**
 * Standalone Terminal Watcher
 * 
 * Monitors Terminal.app content and sends openclaw system events
 * when it detects prompts, errors, or completion signals.
 * 
 * Runs as a background process — no API calls, just local polling.
 * Wakes Atlas only when something needs attention.
 * 
 * Usage: node watcher.js [--interval 3000] [--auto-approve]
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ─── Config ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const INTERVAL = parseInt(args.find((_, i, a) => a[i - 1] === '--interval') || '3000');
const AUTO_APPROVE = args.includes('--auto-approve');
const LOG_FILE = '/tmp/cc-watcher.log';

// ─── Patterns ───────────────────────────────────────────────

const PROMPT_PATTERNS = [
  { pattern: /Do you want to/i, label: 'permission-prompt' },
  { pattern: /\? ❯ 1\. Yes/i, label: 'permission-prompt' },
  { pattern: /Allow .+\?/i, label: 'allow-prompt' },
  { pattern: /Trust this/i, label: 'trust-prompt' },
  { pattern: /\[Y\/n\]/i, label: 'yn-prompt' },
  { pattern: /\[y\/N\]/i, label: 'yn-prompt' },
];

const ERROR_PATTERNS = [
  { pattern: /Error:/i, label: 'error' },
  { pattern: /FATAL/i, label: 'fatal-error' },
  { pattern: /panic/i, label: 'panic' },
  { pattern: /Cannot find module/i, label: 'module-error' },
  { pattern: /command not found/i, label: 'command-not-found' },
];

const COMPLETION_PATTERNS = [
  { pattern: /openclaw system event/i, label: 'completion-signal' },
  { pattern: /Done:/i, label: 'done' },
  { pattern: /Task completed/i, label: 'task-completed' },
  { pattern: /❯ Try "write a test/i, label: 'claude-code-idle' },
];

// ─── Helpers ────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function readTerminal() {
  try {
    return execSync(
      'osascript -e \'tell application "Terminal" to get contents of front window\'',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
  } catch {
    return '';
  }
}

function sendEvent(text) {
  try {
    execSync(`openclaw system event --text "${text.replace(/"/g, '\\"')}" --mode now`, {
      timeout: 10000,
      stdio: 'pipe',
    });
    log(`📡 Event sent: ${text}`);
  } catch (err) {
    log(`⚠️  Event send failed: ${err.message}`);
  }
}

function approvePrompt() {
  try {
    // Shift+Tab = "Yes, allow all edits during this session"
    execSync(`osascript -e '
      tell application "Terminal" to activate
      delay 0.3
      tell application "System Events"
        key code 48 using shift down
      end tell'`, { timeout: 5000 });
    log('✅ Auto-approved with Shift+Tab');
  } catch (err) {
    log(`⚠️  Auto-approve failed: ${err.message}`);
  }
}

// ─── Main Loop ──────────────────────────────────────────────

let lastContent = '';
let lastEventTime = 0;
let lastPromptTime = 0;
const EVENT_COOLDOWN = 30000; // Don't spam events — 30s cooldown
const PROMPT_COOLDOWN = 5000; // 5s between auto-approvals

log(`🔍 Watcher started (interval: ${INTERVAL}ms, auto-approve: ${AUTO_APPROVE})`);
log(`   Logging to: ${LOG_FILE}`);

setInterval(() => {
  const content = readTerminal();
  if (!content || content === lastContent) return;

  // Only check the last ~15 lines for recent activity
  const lines = content.split('\n');
  const recent = lines.slice(-15).join('\n');
  const now = Date.now();

  // Check for prompts first
  for (const { pattern, label } of PROMPT_PATTERNS) {
    if (pattern.test(recent)) {
      if (AUTO_APPROVE && now - lastPromptTime > PROMPT_COOLDOWN) {
        log(`🔔 Detected ${label} — auto-approving`);
        approvePrompt();
        lastPromptTime = now;
      } else if (!AUTO_APPROVE && now - lastEventTime > EVENT_COOLDOWN) {
        sendEvent(`Watcher: Claude Code needs input — ${label} detected. Check Terminal.`);
        lastEventTime = now;
      }
      lastContent = content;
      return;
    }
  }

  // Check for errors
  for (const { pattern, label } of ERROR_PATTERNS) {
    if (pattern.test(recent) && now - lastEventTime > EVENT_COOLDOWN) {
      log(`❌ Detected ${label}`);
      const errorLine = lines.filter(l => pattern.test(l)).pop() || '';
      sendEvent(`Watcher: ${label} in Claude Code — ${errorLine.trim().slice(0, 100)}`);
      lastEventTime = now;
      lastContent = content;
      return;
    }
  }

  // Check for completion
  for (const { pattern, label } of COMPLETION_PATTERNS) {
    if (pattern.test(recent) && now - lastEventTime > EVENT_COOLDOWN) {
      log(`🏁 Detected ${label}`);
      sendEvent(`Watcher: Claude Code appears done — ${label} detected. Check Terminal.`);
      lastEventTime = now;
      lastContent = content;
      return;
    }
  }

  lastContent = content;
}, INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  log('👋 Watcher stopped');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('👋 Watcher stopped');
  process.exit(0);
});

log('👁  Watching Terminal.app...');
