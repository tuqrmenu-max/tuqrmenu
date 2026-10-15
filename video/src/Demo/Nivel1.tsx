import type React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

/**
 * NIVEL 1 — Transiciones estándar.
 *
 * No genera píxeles nuevos: solo interpola opacidad, posición, escala o
 * recorte. Es lo que hace cualquier editor de video tradicional.
 *
 * Cada bloque vive dentro de un <Sequence>, por lo que useCurrentFrame()
 * devuelve el frame local de ese segmento (0, 1, 2...) y no el global.
 */

const A = staticFile("morph/frame-a.png");
const B = staticFile("morph/frame-b.png");

const SEGMENT = 60; // frames per transition

const titleStyle: React.CSSProperties = {
  position: "absolute",
  top: 70,
  left: 0,
  width: "100%",
  textAlign: "center",
  zIndex: 20,
  fontFamily: "Helvetica, Arial, sans-serif",
};

const Layer: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <Img
    src={src}
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      ...style,
    }}
  />
);

const Slide = (frame: number) => interpolate(frame, [0, SEGMENT], [100, 0], clamp);
const Zoom = (frame: number) => interpolate(frame, [0, SEGMENT], [1.6, 1], clamp);
const Fade = (frame: number) => interpolate(frame, [0, SEGMENT], [0, 1], clamp);
const Wipe = (frame: number) => interpolate(frame, [0, SEGMENT], [0, 100], clamp);

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

type Demo = { name: string; color: string; note: string; render: (frame: number) => React.ReactNode };

const demos: Demo[] = [
  {
    name: "Fade",
    color: "#60a5fa",
    note: "solo opacidad",
    render: (f) => (
      <>
        <Layer src={A} />
        <Layer src={B} style={{ opacity: Fade(f) }} />
      </>
    ),
  },
  {
    name: "Slide",
    color: "#34d399",
    note: "solo posición",
    render: (f) => (
      <>
        <Layer src={A} />
        <Layer src={B} style={{ transform: `translateX(${Slide(f)}%)` }} />
      </>
    ),
  },
  {
    name: "Zoom",
    color: "#fbbf24",
    note: "escala + opacidad",
    render: (f) => (
      <>
        <Layer src={A} />
        <Layer src={B} style={{ opacity: Fade(f), transform: `scale(${Zoom(f)})` }} />
      </>
    ),
  },
  {
    name: "Wipe",
    color: "#c084fc",
    note: "recorte",
    render: (f) => (
      <>
        <Layer src={A} />
        <Layer src={B} style={{ clipPath: `inset(0 ${100 - Wipe(f)}% 0 0)` }} />
      </>
    ),
  },
];

const DemoStage: React.FC<{ demo: Demo }> = ({ demo }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {demo.render(frame)}
      <div style={{ ...titleStyle, fontSize: 54, fontWeight: 700, color: demo.color }}>
        {demo.name}
      </div>
      <div style={{ ...titleStyle, top: 140, fontSize: 34, color: "#e5e7eb" }}>
        {demo.note}
      </div>
    </AbsoluteFill>
  );
};

export const Nivel1: React.FC = () => {
  const total = SEGMENT * demos.length;

  return (
    <AbsoluteFill style={{ background: "#111827" }}>
      {demos.map((demo, i) => (
        <Sequence key={demo.name} from={i * SEGMENT} durationInFrames={SEGMENT}>
          <DemoStage demo={demo} />
        </Sequence>
      ))}

      <div
        style={{
          position: "absolute",
          bottom: 70,
          width: "100%",
          textAlign: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 34,
          color: "#9ca3af",
        }}
      >
        Nivel 1 · No inventa píxeles nuevos, solo transforma los que ya existen
      </div>

      <Sequence from={0} durationInFrames={total}>
        <ProgressBar />
      </Sequence>
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const width = (frame / (SEGMENT * demos.length - 1)) * 100;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: `${width}%`,
        height: 14,
        background: "linear-gradient(90deg,#3b82f6,#a855f7)",
      }}
    />
  );
};
