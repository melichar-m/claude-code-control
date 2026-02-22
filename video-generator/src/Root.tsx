import React from "react";
import { Composition, registerRoot } from "remotion";
import { TerminalDemo, type TerminalDemoProps } from "./TerminalDemo";

// ─── Preset Dimensions ────────────────────────────────────────────────────────

const PRESETS = {
  "x-landscape": { width: 1920, height: 1080 },
  "x-portrait": { width: 1080, height: 1350 },
  phone: { width: 1080, height: 1920 },
} as const;

// ─── Dynamic metadata ─────────────────────────────────────────────────────────

const calculateMetadata = async ({
  props,
}: {
  props: TerminalDemoProps;
}) => {
  const preset = props.preset ?? "x-landscape";
  const { width, height } = PRESETS[preset] ?? PRESETS["x-landscape"];

  const frameCount = props.frames?.length ?? 0;
  const endCardDuration = props.productName ? 90 : 0;
  // 20 frames per screenshot (0.67s), plus end card
  const rawDuration = Math.max(30, frameCount) * 20 + endCardDuration;
  const minDuration = 450; // 15s @ 30fps
  const maxDuration = 900; // 30s @ 30fps
  const durationInFrames = Math.max(
    minDuration,
    Math.min(maxDuration, rawDuration)
  );

  return { width, height, durationInFrames };
};

// ─── Default preview props ────────────────────────────────────────────────────

const defaultProps: TerminalDemoProps = {
  frames: [],
  captions: [
    {
      text: "Zero config required",
      startFrame: 30,
      durationFrames: 90,
      layout: "default",
    },
    {
      text: "Works everywhere",
      startFrame: 150,
      durationFrames: 90,
      layout: "slide-in",
    },
    {
      text: "Ship faster  •  Deploy instantly  •  Scale freely",
      startFrame: 270,
      durationFrames: 120,
      layout: "circle",
    },
  ],
  productName: "my-product",
  installCommand: "$ npm install my-product",
  preset: "x-landscape",
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TerminalDemo"
        component={TerminalDemo}
        fps={30}
        durationInFrames={450}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};

registerRoot(RemotionRoot);
