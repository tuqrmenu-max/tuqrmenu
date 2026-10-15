import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * NIVEL 3 — Interpolación con IA (RIFE / FILM / DAIN).
 *
 * A diferencia de los niveles 1 y 2, acá la IA *inventa* píxeles que no
 * existían en ninguno de los dos frames: estima el flujo óptico (hacia dónde
 * se movió cada píxel) y dibuja los frames intermedios.
 *
 * Estos modelos NO corren dentro de Remotion. Corren primero, generan una
 * carpeta de PNGs (frame_0001.png ... frame_0060.png) y Remotion después
 * ensambla esos archivos en el video final. Esta demo ilustra ese flujo.
 */

const A = staticFile("morph/frame-a.png");
const B = staticFile("morph/frame-b.png");

const STEPS = 6;

export const Nivel3: React.FC = () => {
  const frame = useCurrentFrame();

  // How many of the invented frames have "been generated" so far.
  const generated = Math.min(
    STEPS,
    Math.floor(interpolate(frame, [0, 70], [0, STEPS + 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })),
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%)",
        fontFamily: "Helvetica, Arial, sans-serif",
        padding: "64px 80px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 800, color: "#a78bfa" }}>
        Nivel 3 · Interpolación con IA
      </div>
      <div style={{ fontSize: 32, color: "#cbd5e1", marginTop: 16, lineHeight: 1.45 }}>
        La IA estima el flujo óptico e <b style={{ color: "#fbbf24" }}>inventa píxeles nuevos</b>{" "}
        entre A y B. Es el nivel de calidad máxima — y el único que no puedes lograr solo con
        Remotion.
      </div>

      {/* Filmstrip: real frame, invented frames, real frame */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginTop: 54,
          justifyContent: "center",
        }}
      >
        <KeyFrame label="Frame A" sub="real" src={A} border="#3b82f6" />

        {Array.from({ length: STEPS }).map((_, i) => {
          const revealed = i < generated;
          const t = (i + 1) / (STEPS + 1);
          return (
            <React.Fragment key={i}>
              <Arrow visible={revealed} />
              <InventedFrame index={i} t={t} revealed={revealed} />
            </React.Fragment>
          );
        })}

        <Arrow visible={generated >= STEPS} />
        <KeyFrame label="Frame B" sub="real" src={B} border="#ef4444" />
      </div>

      <div style={{ marginTop: 56, fontSize: 30, color: "#94a3b8", lineHeight: 1.6 }}>
        <b style={{ color: "#e2e8f0" }}>Flujo real del trabajo:</b>
        <br />
        1 · Tenés el primer y el último frame.
        <br />
        2 · Los pasás por RIFE / FILM / DAIN → genera <code>N</code> PNG intermedios.
        <br />
        3 · Remotion importa esa secuencia y arma el video con transiciones, audio y texto.
      </div>

      <GenerationCounter generated={generated} total={STEPS} />
    </AbsoluteFill>
  );
};

const KeyFrame: React.FC<{ label: string; sub: string; src: string; border: string }> = ({
  label,
  sub,
  src,
  border,
}) => (
  <div style={{ textAlign: "center" }}>
    <Img
      src={src}
      style={{
        width: 240,
        height: 150,
        objectFit: "cover",
        borderRadius: 14,
        border: `5px solid ${border}`,
        display: "block",
      }}
    />
    <div style={{ fontSize: 28, fontWeight: 700, color: "#e2e8f0", marginTop: 12 }}>{label}</div>
    <div style={{ fontSize: 22, color: "#64748b" }}>{sub}</div>
  </div>
);

const InventedFrame: React.FC<{ index: number; t: number; revealed: boolean }> = ({
  index,
  t,
  revealed,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const pop = spring({
    frame: frame - index * 10,
    fps,
    config: { damping: 14, stiffness: 140 },
  });

  if (!revealed) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 160,
            height: 150,
            borderRadius: 14,
            border: "4px dashed #475569",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#475569",
            fontSize: 44,
          }}
        >
          ?
        </div>
        <div style={{ fontSize: 22, color: "#475569", marginTop: 12 }}>pendiente</div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", transform: `scale(${0.85 + pop * 0.15})` }}>
      <div style={{ position: "relative", width: 160, height: 150 }}>
        <Img
          src={A}
          style={{
            position: "absolute",
            inset: 0,
            width: 160,
            height: 150,
            objectFit: "cover",
            borderRadius: 14,
          }}
        />
        <Img
          src={B}
          style={{
            position: "absolute",
            inset: 0,
            width: 160,
            height: 150,
            objectFit: "cover",
            borderRadius: 14,
            opacity: t,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            border: "4px solid #a78bfa",
          }}
        />
      </div>
      <div style={{ fontSize: 22, color: "#a78bfa", marginTop: 12, fontWeight: 700 }}>
        IA #{index + 1}
      </div>
    </div>
  );
};

const Arrow: React.FC<{ visible: boolean }> = ({ visible }) => (
  <div style={{ fontSize: 40, color: visible ? "#475569" : "transparent" }}>→</div>
);

const GenerationCounter: React.FC<{ generated: number; total: number }> = ({
  generated,
  total,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 60,
      left: 80,
      right: 80,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <div style={{ fontSize: 32, color: "#e2e8f0" }}>
      Frames generados por la IA:{" "}
      <b style={{ color: "#a78bfa" }}>
        {generated} / {total}
      </b>
    </div>
    <div style={{ fontSize: 30, color: "#64748b" }}>
      {generated >= total ? "✓ listo para renderizar en Remotion" : "generando..."}
    </div>
  </div>
);
