import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

/**
 * Two synthetic "key frames".
 * They are rendered as PNG stills into public/morph/ and then used as the
 * first and last frame of every transition demo.
 */

const dots = (positions: readonly (readonly [number, number])[], color: string) =>
  positions.map(([x, y], i) => (
    <div
      key={i}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: 46 - i * 6,
        height: 46 - i * 6,
        marginLeft: -(46 - i * 6) / 2,
        marginTop: -(46 - i * 6) / 2,
        borderRadius: "50%",
        background: color,
        opacity: 0.85,
      }}
    />
  ));

export const FrameA: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(155deg, #0b1224 0%, #1d4ed8 100%)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 22% 42%, rgba(125,211,252,.55), transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * 0.3,
          top: height * 0.5,
          width: 460,
          height: 460,
          marginLeft: -230,
          marginTop: -230,
          borderRadius: "50%",
          background: "radial-gradient(circle at 34% 28%, #ffffff, #7dd3fc 55%, #0ea5e9 100%)",
          boxShadow: "0 40px 110px rgba(0,0,0,.55)",
        }}
      />
      {dots(
        [
          [68, 24],
          [78, 68],
          [56, 82],
        ],
        "#bae6fd",
      )}
    </AbsoluteFill>
  );
};

export const FrameB: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(155deg, #431407 0%, #f97316 100%)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 78% 58%, rgba(253,224,71,.5), transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * 0.7,
          top: height * 0.5,
          width: 440,
          height: 440,
          marginLeft: -220,
          marginTop: -220,
          borderRadius: 72,
          background: "linear-gradient(140deg, #fef3c7 0%, #fbbf24 45%, #ea580c 100%)",
          boxShadow: "0 40px 110px rgba(0,0,0,.55)",
        }}
      />
      {dots(
        [
          [24, 30],
          [16, 72],
          [40, 84],
        ],
        "#fed7aa",
      )}
    </AbsoluteFill>
  );
};
