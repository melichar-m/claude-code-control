# video-generator

Turn terminal session recordings into polished 15–30 second social media product demos using [Remotion](https://remotion.dev).

## Features

- **Dark, cinematic aesthetic** — radial gradient background, subtle grid, deep vignette
- **3D terminal window** — macOS-style with traffic lights, perspective tilt, breathing animation
- **Glow effects** — pulsing green border/shadow on the terminal, scan-line overlay
- **Three caption layouts** — default (fade/slide pill), slide-in (spring from right), circle (text orbiting terminal)
- **Cross-fade frame transitions** — smooth dissolve between screenshots
- **End card** — product name + install command with animated glowing border

## Setup

```bash
cd video-generator
npm install
```

## Usage

### Remotion Studio (preview/scrub)

```bash
npm run studio
```

Opens the Remotion Studio at `http://localhost:3000` — you can scrub through the timeline and preview the composition with the default props.

### Render to MP4

```bash
npx ts-node render.ts \
  --frames-dir ./path/to/screenshots \
  --captions '[{"text":"Zero config","startFrame":30,"durationFrames":90}]' \
  --output demo.mp4 \
  --preset x-landscape \
  --product-name "my-cli" \
  --install-command "$ npm install -g my-cli"
```

### All flags

| Flag | Required | Description |
|------|----------|-------------|
| `--frames-dir` | ✅ | Directory of PNG/JPG terminal screenshots, sorted alphabetically |
| `--captions` | — | JSON array of captions, or path to a `.json` file |
| `--output` | — | Output path (default: `output.mp4`) |
| `--preset` | — | `x-landscape` \| `x-portrait` \| `phone` (default: `x-landscape`) |
| `--product-name` | — | Product name shown on the end card |
| `--install-command` | — | Install command on end card (defaults to `$ npm install <product-name>`) |

### Presets

| Preset | Resolution | Platform |
|--------|-----------|----------|
| `x-landscape` | 1920 × 1080 | Twitter/X, YouTube |
| `x-portrait` | 1080 × 1350 | Twitter/X portrait |
| `phone` | 1080 × 1920 | TikTok, Instagram Reels, YouTube Shorts |

## Captions format

```json
[
  {
    "text": "Install in seconds",
    "startFrame": 30,
    "durationFrames": 90,
    "layout": "default"
  },
  {
    "text": "Zero config required",
    "startFrame": 150,
    "durationFrames": 90,
    "layout": "slide-in"
  },
  {
    "text": "Deploy anywhere  ·  Scale instantly",
    "startFrame": 270,
    "durationFrames": 120,
    "layout": "circle"
  }
]
```

### Caption layouts

- **`default`** — Centered pill at the bottom, fades and slides up
- **`slide-in`** — Springs in from the right with a green accent bar
- **`circle`** — Text orbits the terminal on a circular SVG path

`startFrame` and `durationFrames` are at 30fps. One second = 30 frames.

## Preparing frames

The frames should be screenshots of your terminal, sorted so alphabetical order = temporal order. Use a tool like `asciinema` + a screenshot script, or any screen capture that saves numbered PNGs:

```bash
# Example: extract frames from a screen recording with ffmpeg
ffmpeg -i recording.mp4 -vf fps=4 frames/frame-%05d.png
```

The render script copies frames into `public/frames/` before bundling, so you don't need to place them there manually.

## Timing guide

At 30fps:

| Seconds | Frames |
|---------|--------|
| 0.5s | 15 |
| 1s | 30 |
| 2s | 60 |
| 3s | 90 |
| 5s | 150 |

The total duration is calculated automatically from the number of frames (capped at 15–30s). Each frame screenshot is shown for ~0.67s by default.

## Project structure

```
video-generator/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── render.ts           # CLI render script
├── public/             # Static assets (frames copied here at render time)
└── src/
    ├── index.ts        # Remotion entry point
    ├── Root.tsx        # Composition registration + calculateMetadata
    ├── TerminalDemo.tsx # Main composition component
    └── styles.ts       # Design tokens (colors, fonts, spacing)
```
