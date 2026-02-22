#!/usr/bin/env node
/**
 * Test v2.0 — Record Claude Code building the Remotion social media video skill.
 * The tool building the tool that makes the videos.
 */

const cc = require('./index.js');

const TASK = `Build a Remotion video component that turns terminal session recordings into 15-30 second social media product demos.

Create a new directory called 'video-generator' with these files:

1. video-generator/package.json — Remotion project with dependencies (@remotion/cli, @remotion/player, remotion, react, react-dom)

2. video-generator/src/Root.tsx — Remotion root component

3. video-generator/src/TerminalDemo.tsx — Main composition:
   - Takes props: { frames: string[], captions: { text: string, startFrame: number, durationFrames: number, layout?: 'default'|'circle'|'slide-in' }[] }
   - 30fps, 15-30 seconds (450-900 frames)
   - Dark background (#0a0a0a)
   - Terminal window with slight 3D perspective transform (CSS rotateY 2-5deg)
   - Frames cycle through showing the terminal screenshots
   - Each caption shows for ~3 seconds (90 frames) with smooth fade in/out
   - Text styling: bold, clean sans-serif, slightly oversized for mobile
   - Circle layout: text flows in a circle path using SVG textPath (for circular processes)
   - Slide-in layout: text slides from right with spring animation
   - End card: product name + install command with glowing border animation

4. video-generator/src/styles.ts — Shared styles object (colors, fonts, spacing)

5. video-generator/render.ts — CLI script that:
   - Takes --frames-dir (path to extracted frames)
   - Takes --captions (JSON string or file path)
   - Takes --output (output mp4 path)
   - Takes --preset (x-landscape|x-portrait|phone) to set composition dimensions
   - Renders the video using Remotion's renderMedia API
   - Outputs to mp4

6. video-generator/README.md — Usage docs

Make it look GOOD. This needs to be watchable even if you dont care about the product. Think smooth animations, clean typography, slight glow effects on the terminal window.

When completely finished, run: openclaw system event --text "Done: Remotion video-generator built inside claude-code-control" --mode now`;

async function main() {
  console.log('🚀 Launching Claude Code...');
  const sessionId = await cc.launch('/Users/michaelmelichar/.openclaw/workspace/skills/claude-code-control');
  
  // Wait for Claude Code to fully load
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('👁 Starting prompt watcher (auto-approve)...');
  cc.watchForPrompts(sessionId, {
    intervalMs: 2000,
    onPrompt: (label, response) => {
      console.log(`  ↳ Auto-approved: ${label}`);
    }
  });
  
  console.log('🎥 Starting recording (x-landscape 1280x720)...');
  const rec = await cc.startRecording(sessionId, {
    preset: 'x-landscape',
    fps: 30,
    outputPath: '/tmp/cc-building-video-generator.mp4'
  });
  console.log(`  ↳ Recording to: ${rec.videoPath}`);
  
  // Wait a moment for recording to stabilize
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('📤 Sending task to Claude Code...');
  await cc.send(sessionId, TASK, 1);
  
  console.log('✅ Task sent. Claude Code is now building the video generator.');
  console.log('   Recording is active. Run this to stop when done:');
  console.log('   node -e "require(\'./index.js\').stopRecording(1).then(r => console.log(r))"');
  console.log(`   Session ID: ${sessionId}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
