import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { drawMorph, loadImages } from "./morph";

/**
 * NIVEL 2 — Morphing real (deformación de malla).
 *
 * La imagen A y la imagen B se deforman a través de una grilla de triángulos
 * que se "abulta" en el punto medio y luego se funden. Esto sí cambia la
 * geometría de los píxeles: los contornos de A fluyen hacia los de B.
 *
 * Es el equivalente al efecto "morph" de un videoclip, y corre entero en
 * canvas dentro de Remotion — sin modelos externos.
 */

const A_SRC = staticFile("morph/frame-a.png");
const B_SRC = staticFile("morph/frame-b.png");

const SEGMENT = 90; // frames for the whole morph

/** Load both source frames once, blocking Remotion until they are ready. */
const useImages = (): { a: HTMLImageElement | null; b: HTMLImageElement | null } => {
  const [state, setState] = React.useState<{ a: HTMLImageElement | null; b: HTMLImageElement | null }>({
    a: null,
    b: null,
  });
  const [handle] = React.useState(() => delayRender("Cargando frames fuente"));

  React.useEffect(() => {
    let alive = true;
    loadImages([A_SRC, B_SRC])
      .then(([a, b]) => {
        if (!alive) return;
        setState({ a, b });
        continueRender(handle);
      })
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  return state;
};

export const Nivel2: React.FC = () => {
  const frame = useCurrentFrame();
  const { a, b } = useImages();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const t = interpolate(frame, [0, SEGMENT], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !a || !b) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawMorph(ctx, a, b, canvas.width, canvas.height, t, 7, 7, 0.075);
  }, [a, b, t]);

  const percent = Math.round(t * 100);

  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1000}
        style={{ position: "absolute", top: 60, left: 0, width: "100%", height: 1000 }}
      />

      <div
        style={{
          position: "absolute",
          top: 1080,
          left: 0,
          width: "100%",
          padding: "44px 60px 0",
          boxSizing: "border-box",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 54, fontWeight: 700, color: "#34d399" }}>
            Nivel 2 · Morphing de malla
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, color: "#fbbf24" }}>{percent}%</div>
        </div>

        <div style={{ fontSize: 32, color: "#94a3b8", marginTop: 14 }}>
          Deforma los contornos de A hacia B con una grilla de triángulos + fundido.
          Genera los frames que faltan, sin modelos externos.
        </div>

        <div
          style={{
            marginTop: 26,
            height: 16,
            width: "100%",
            background: "#1e293b",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: "linear-gradient(90deg,#22c55e,#fbbf24)",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <span style={{ fontSize: 30, color: "#60a5fa" }}>Frame inicial (A)</span>
          <span style={{ fontSize: 30, color: "#f87171" }}>Frame final (B)</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const NILEVEL2_FRAMES = SEGMENT;
