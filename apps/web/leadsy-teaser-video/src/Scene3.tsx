import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

type Scene3Props = {
  scene: {
    headline: string;
    url: string;
  };
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const
};

export function Scene3({ scene }: Scene3Props) {
  const frame = useCurrentFrame();
  const logoOpacity = interpolate(frame, [0, 10], [0, 1], clamp);
  const detailOpacity = interpolate(frame, [8, 20], [0, 1], clamp);
  const scale = interpolate(frame, [0, 22], [0.975, 1], { ...clamp, easing: easeOut });

  return (
    <AbsoluteFill style={{ backgroundColor: "#010202", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "45%",
          width: 560,
          height: 560,
          transform: "translate(-50%, -50%)",
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(103,255,219,0.16), rgba(103,255,219,0.04) 36%, transparent 68%)",
          filter: "blur(4px)",
          opacity: logoOpacity
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          transform: `scale(${scale})`
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: logoOpacity
          }}
        >
          <div
            style={{
              width: 86,
              height: 86,
              borderRadius: 18,
              background: "#6cf6d7",
              color: "#06100d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Inter, SF Pro Display, ui-sans-serif, system-ui, sans-serif",
              fontSize: 48,
              fontWeight: 850,
              letterSpacing: 0,
              boxShadow: "0 0 58px rgba(103,255,219,0.28)"
            }}
          >
            L
          </div>
          <div
            style={{
              color: "#f7fffc",
              fontFamily: "Inter, SF Pro Display, ui-sans-serif, system-ui, sans-serif",
              fontSize: 88,
              fontWeight: 780,
              letterSpacing: 0
            }}
          >
            Leadsy
          </div>
        </div>
        <div
          style={{
            marginTop: 46,
            opacity: detailOpacity,
            color: "#d7fff5",
            fontFamily: "Inter, SF Pro Display, ui-sans-serif, system-ui, sans-serif",
            fontSize: 30,
            fontWeight: 760,
            letterSpacing: 0,
            textTransform: "uppercase"
          }}
        >
          {scene.headline}
        </div>
        <div
          style={{
            marginTop: 18,
            opacity: detailOpacity * 0.72,
            color: "#94aaa5",
            fontFamily: "Inter, SF Pro Display, ui-sans-serif, system-ui, sans-serif",
            fontSize: 25,
            fontWeight: 560,
            letterSpacing: 0
          }}
        >
          {scene.url}
        </div>
      </div>
    </AbsoluteFill>
  );
}
