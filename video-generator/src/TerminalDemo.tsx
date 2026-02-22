import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts, radius, spacing } from "./styles";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Caption {
  text: string;
  startFrame: number;
  durationFrames: number;
  layout?: "default" | "circle" | "slide-in";
}

export interface TerminalDemoProps {
  frames: string[];
  captions: Caption[];
  productName?: string;
  installCommand?: string;
  preset?: "x-landscape" | "x-portrait" | "phone";
}

// ─── Background ──────────────────────────────────────────────────────────────

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const subtleShift = interpolate(frame, [0, durationInFrames], [0, 1]);

  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `radial-gradient(
            ellipse 100% 80% at ${50 + subtleShift * 4}% ${48 + subtleShift * 3}%,
            #131313 0%,
            #080808 55%,
            #040404 100%
          )`,
        }}
      />
      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Terminal Window ──────────────────────────────────────────────────────────

const TerminalWindow: React.FC<{ frames: string[] }> = ({ frames }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  // Responsive sizing
  const maxW = width * 0.82;
  const maxH = height * 0.66;
  const termWidth = Math.min(maxW, maxH * 1.6);
  const termHeight = termWidth / 1.6;
  const headerHeight = Math.round(termWidth * 0.028);

  // Intro animation
  const introProgress = spring({
    fps,
    frame,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
    durationInFrames: 40,
  });
  const introScale = interpolate(introProgress, [0, 1], [0.88, 1]);
  const introOpacity = interpolate(introProgress, [0, 1], [0, 1]);

  // Breathing float
  const breatheY = Math.sin((frame / fps) * 1.1 * Math.PI) * 3;
  const breatheRotate = Math.sin((frame / fps) * 0.7 * Math.PI) * 0.25;

  // Glow pulse
  const glowCycle = (Math.sin((frame / fps) * 1.4 * Math.PI) + 1) / 2;
  const glowA = 0.22 + glowCycle * 0.18;
  const glowSpread = 32 + glowCycle * 22;

  // Frame cycling with cross-fade
  const endCardDuration = 90;
  const contentDuration = durationInFrames - endCardDuration;
  const showingFrames = frames.length > 0 ? frames : null;
  let currentSrc: string | null = null;
  let nextSrc: string | null = null;
  let crossFadeOpacity = 0;

  if (showingFrames && frame < contentDuration) {
    const perFrame = Math.max(12, Math.floor(contentDuration / showingFrames.length));
    const idx = Math.min(Math.floor(frame / perFrame), showingFrames.length - 1);
    const nextIdx = Math.min(idx + 1, showingFrames.length - 1);
    const posInSlot = frame % perFrame;
    const fadeStart = perFrame * 0.7;

    currentSrc = staticFile(showingFrames[idx]);
    if (nextIdx !== idx) {
      nextSrc = staticFile(showingFrames[nextIdx]);
      crossFadeOpacity =
        posInSlot > fadeStart
          ? interpolate(posInSlot, [fadeStart, perFrame], [0, 1], {
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.quad),
            })
          : 0;
    }
  }

  const trafficLights = [
    colors.trafficRed,
    colors.trafficYellow,
    colors.trafficGreen,
  ];
  const dotSize = Math.max(10, headerHeight * 0.36);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: termWidth,
        height: termHeight,
        transform: `
          translate(-50%, calc(-50% + ${breatheY}px))
          perspective(1400px)
          rotateY(${3 + breatheRotate}deg)
          rotateX(-0.8deg)
          scale(${introScale})
        `,
        opacity: introOpacity,
        borderRadius: radius.lg,
        overflow: "hidden",
        boxShadow: `
          0 0 ${glowSpread}px rgba(0,255,136,${glowA}),
          0 0 ${glowSpread * 2}px rgba(0,255,136,${glowA * 0.4}),
          0 0 ${glowSpread * 4}px rgba(0,255,136,${glowA * 0.12}),
          0 24px 80px rgba(0,0,0,0.8),
          inset 0 1px 0 rgba(255,255,255,0.06)
        `,
        border: `1px solid rgba(0,255,136,${glowA * 0.9})`,
      }}
    >
      {/* Ambient glow behind (on the background) */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          background: `radial-gradient(ellipse at 50% 50%, rgba(0,255,136,${glowA * 0.15}), transparent 70%)`,
          filter: "blur(30px)",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      {/* Header bar */}
      <div
        style={{
          height: headerHeight,
          minHeight: 32,
          background: `linear-gradient(180deg, #2e2e2e 0%, ${colors.terminalHeader} 100%)`,
          display: "flex",
          alignItems: "center",
          padding: `0 ${spacing.md}px`,
          gap: spacing.sm,
          borderBottom: "1px solid rgba(0,0,0,0.4)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {trafficLights.map((color, i) => (
          <div
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 5px ${color}88`,
              flexShrink: 0,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: Math.max(11, headerHeight * 0.34),
            color: colors.textMuted,
            fontFamily: fonts.mono,
            letterSpacing: 0.3,
            userSelect: "none",
          }}
        >
          bash — 120×40
        </div>
        {/* Subtle header gloss */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Content area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: termHeight - Math.max(32, headerHeight),
          background: colors.terminalBg,
          overflow: "hidden",
        }}
      >
        {/* Placeholder when no frames */}
        {!currentSrc && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              padding: "20px 24px",
              boxSizing: "border-box",
            }}
          >
            <PlaceholderContent frame={frame} fps={fps} />
          </div>
        )}

        {/* Current frame */}
        {currentSrc && (
          <Img
            src={currentSrc}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top left",
            }}
          />
        )}

        {/* Next frame (cross-fade) */}
        {nextSrc && crossFadeOpacity > 0 && (
          <Img
            src={nextSrc}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top left",
              opacity: crossFadeOpacity,
            }}
          />
        )}

        {/* Scan lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 3px,
              rgba(0,0,0,0.035) 3px,
              rgba(0,0,0,0.035) 4px
            )`,
            pointerEvents: "none",
          }}
        />

        {/* Corner highlight — glass reflection */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "40%",
            height: "30%",
            background:
              "radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.04), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Inner shadow top/bottom */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 30,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 30,
            background: "linear-gradient(to top, rgba(0,0,0,0.25), transparent)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

// ─── Placeholder Terminal Content ─────────────────────────────────────────────

const PlaceholderContent: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const lines = [
    { text: "$ npm run dev", color: colors.glow },
    { text: "", color: colors.text },
    { text: "> server started on http://localhost:3000", color: "#aaaaaa" },
    { text: "> watching for changes...", color: "#888888" },
    { text: "", color: colors.text },
    { text: "  ✓  built in 142ms", color: "#00ff88" },
    { text: "  ✓  3 routes compiled", color: "#00ff88" },
    { text: "", color: colors.text },
    { text: "$ █", color: colors.glow },
  ];

  // Typing effect
  const charsPerFrame = 2;
  const totalChars = lines.reduce((acc, l) => acc + l.text.length + 1, 0);
  const revealedChars = Math.min(frame * charsPerFrame, totalChars);
  const cursorBlink = Math.sin((frame / fps) * 3 * Math.PI) > 0;

  let charsUsed = 0;
  return (
    <div style={{ fontFamily: fonts.mono, fontSize: 14, lineHeight: "1.7" }}>
      {lines.map((line, i) => {
        const lineStart = charsUsed;
        charsUsed += line.text.length + 1;
        const visible = Math.max(
          0,
          Math.min(line.text.length, revealedChars - lineStart)
        );
        const isLast = i === lines.length - 1;
        return (
          <div key={i} style={{ color: line.color }}>
            {line.text.slice(0, visible)}
            {isLast && cursorBlink && visible === line.text.length && (
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 15,
                  background: colors.glow,
                  verticalAlign: "middle",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Default Caption ──────────────────────────────────────────────────────────

const DefaultCaption: React.FC<{
  text: string;
  durationFrames: number;
}> = ({ text, durationFrames }) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fadeOut = interpolate(
    frame,
    [durationFrames - 10, durationFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.quad),
    }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const slideY = interpolate(frame, [0, 12], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.4)),
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: "7%",
        left: "50%",
        transform: `translateX(-50%) translateY(${slideY}px)`,
        opacity,
        padding: "14px 30px",
        background: colors.captionBg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: radius.pill,
        border: `1px solid ${colors.captionBorder}`,
        color: colors.text,
        fontSize: 30,
        fontWeight: 700,
        fontFamily: fonts.display,
        textAlign: "center",
        whiteSpace: "nowrap",
        letterSpacing: -0.3,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      {text}
    </div>
  );
};

// ─── Slide-In Caption ─────────────────────────────────────────────────────────

const SlideInCaption: React.FC<{
  text: string;
  durationFrames: number;
}> = ({ text, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideX = spring({
    fps,
    frame,
    config: { damping: 16, stiffness: 160, mass: 0.8 },
    from: 280,
    to: 0,
  });

  const fadeOut = interpolate(
    frame,
    [durationFrames - 10, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(
    interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
    fadeOut
  );

  return (
    <div
      style={{
        position: "absolute",
        right: "5%",
        top: "50%",
        transform: `translateY(-50%) translateX(${slideX}px)`,
        opacity,
        padding: "14px 24px",
        background: `linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,255,136,0.06))`,
        border: `1.5px solid rgba(0,255,136,0.5)`,
        borderRadius: radius.md,
        color: colors.text,
        fontSize: 26,
        fontWeight: 700,
        fontFamily: fonts.display,
        letterSpacing: -0.2,
        boxShadow: `0 0 24px rgba(0,255,136,0.2), 0 8px 24px rgba(0,0,0,0.5)`,
        maxWidth: 300,
        lineHeight: 1.3,
        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "50%",
          transform: "translateY(-50%)",
          width: 4,
          height: "60%",
          borderRadius: 2,
          background: colors.glow,
          boxShadow: `0 0 8px ${colors.glow}`,
        }}
      />
      {text}
    </div>
  );
};

// ─── Circle Caption ───────────────────────────────────────────────────────────

const CircleCaption: React.FC<{
  text: string;
  durationFrames: number;
}> = ({ text, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const fadeOut = interpolate(
    frame,
    [durationFrames - 15, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Slow rotation
  const rotation = interpolate(frame, [0, durationFrames], [0, 360]);
  const radius = Math.min(width, height) * 0.36;
  const cx = width / 2;
  const cy = height / 2;

  // SVG arc path for text
  const r = radius;
  const pathD = `
    M ${cx - r} ${cy}
    A ${r} ${r} 0 1 1 ${cx + r} ${cy}
    A ${r} ${r} 0 1 1 ${cx - r} ${cy}
  `;
  const pathId = "circle-caption-path";
  const fontSize = Math.max(20, Math.round(width / 55));
  // Repeat text to fill the circle
  const repeatedText = `${text}  ·  ${text}  ·  ${text}  ·  `;

  return (
    <svg
      style={{ position: "absolute", inset: 0, opacity }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <path id={pathId} d={pathD} />
        <filter id="circle-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Faint circle ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(0,255,136,0.12)"
        strokeWidth={1}
        strokeDasharray="4 8"
      />
      {/* Rotating text */}
      <g transform={`rotate(${rotation}, ${cx}, ${cy})`}>
        <text
          fill="rgba(255,255,255,0.9)"
          fontSize={fontSize}
          fontFamily={fonts.display}
          fontWeight="700"
          letterSpacing={Math.round(width / 120)}
          filter="url(#circle-glow)"
        >
          <textPath href={`#${pathId}`} startOffset="0%">
            {repeatedText}
          </textPath>
        </text>
      </g>
    </svg>
  );
};

// ─── End Card ─────────────────────────────────────────────────────────────────

const EndCard: React.FC<{
  productName: string;
  installCommand: string;
}> = ({ productName, installCommand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const titleY = spring({
    fps,
    frame: Math.max(0, frame - 5),
    config: { damping: 14, stiffness: 80, mass: 1 },
    from: 50,
    to: 0,
  });

  const commandY = spring({
    fps,
    frame: Math.max(0, frame - 18),
    config: { damping: 14, stiffness: 80, mass: 1 },
    from: 40,
    to: 0,
  });

  const commandOpacity = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing glow on command box
  const glowCycle = (Math.sin((frame / fps) * 2.2 * Math.PI) + 1) / 2;
  const glowSize = 18 + glowCycle * 20;
  const glowOpacity = 0.45 + glowCycle * 0.4;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: containerOpacity,
        background: `radial-gradient(
          ellipse 80% 60% at 50% 50%,
          #151515 0%,
          #060606 100%
        )`,
      }}
    >
      {/* Background grid subtle */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,136,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          zIndex: 1,
          padding: "0 48px",
        }}
      >
        {/* Product name */}
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            fontSize: 68,
            fontWeight: 900,
            fontFamily: fonts.display,
            color: colors.text,
            letterSpacing: -2,
            lineHeight: 1.1,
            marginBottom: 20,
            textShadow: `0 0 50px rgba(0,255,136,0.5), 0 0 100px rgba(0,255,136,0.2)`,
          }}
        >
          {productName}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 64,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)`,
            margin: "0 auto 36px",
            borderRadius: 2,
            transform: `translateY(${titleY}px)`,
            boxShadow: `0 0 10px ${colors.glow}`,
          }}
        />

        {/* Install command */}
        <div
          style={{
            transform: `translateY(${commandY}px)`,
            opacity: commandOpacity,
            display: "inline-block",
            padding: "18px 40px",
            background: "#0d0d0d",
            border: `1.5px solid ${colors.glow}`,
            borderRadius: radius.md,
            fontFamily: fonts.mono,
            fontSize: 30,
            color: colors.glow,
            letterSpacing: 0.5,
            boxShadow: `
              0 0 ${glowSize}px rgba(0,255,136,${glowOpacity}),
              0 0 ${glowSize * 2}px rgba(0,255,136,${glowOpacity * 0.35}),
              0 0 ${glowSize * 4}px rgba(0,255,136,${glowOpacity * 0.1}),
              inset 0 0 20px rgba(0,255,136,0.04)
            `,
          }}
        >
          {installCommand}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────

export const TerminalDemo: React.FC<TerminalDemoProps> = ({
  frames,
  captions,
  productName,
  installCommand = "$ npm install",
  preset: _preset = "x-landscape",
}) => {
  const { durationInFrames } = useVideoConfig();
  const hasEndCard = Boolean(productName);
  const endCardStart = durationInFrames - 90;

  return (
    <AbsoluteFill>
      <Background />

      {/* Terminal */}
      <AbsoluteFill style={{ zIndex: 10 }}>
        <TerminalWindow frames={frames} />
      </AbsoluteFill>

      {/* Captions */}
      <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
        {captions.map((caption, i) => (
          <Sequence
            key={i}
            from={caption.startFrame}
            durationInFrames={caption.durationFrames}
          >
            {caption.layout === "circle" ? (
              <CircleCaption
                text={caption.text}
                durationFrames={caption.durationFrames}
              />
            ) : caption.layout === "slide-in" ? (
              <SlideInCaption
                text={caption.text}
                durationFrames={caption.durationFrames}
              />
            ) : (
              <DefaultCaption
                text={caption.text}
                durationFrames={caption.durationFrames}
              />
            )}
          </Sequence>
        ))}
      </AbsoluteFill>

      {/* End card */}
      {hasEndCard && (
        <Sequence from={endCardStart} durationInFrames={90}>
          <AbsoluteFill style={{ zIndex: 30 }}>
            <EndCard
              productName={productName!}
              installCommand={installCommand}
            />
          </AbsoluteFill>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
