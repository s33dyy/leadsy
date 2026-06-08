import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame
} from "remotion";

type Scene1Props = {
  scene: {
    asset: string;
    clickFrame: number;
    clickTarget: { x: number; y: number };
    text: string;
  };
};

const mediaPath = (path: string) => path.replace(/^(\.\.\/)?public\//, "");
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const
};

function Cursor({ x, y, pressed }: { x: number; y: number; pressed: number }) {
  return (
    <svg
      viewBox="0 0 38 38"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 38,
        height: 38,
        filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.48))",
        opacity: 0.98,
        transform: `scale(${1 - pressed * 0.08})`,
        transformOrigin: "7px 7px"
      }}
    >
      <path
        d="M5 3.5 30.5 20.5 18 22.6 13.3 34 5 3.5Z"
        fill="#f8fffc"
        stroke="#06100d"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Scene1({ scene }: Scene1Props) {
  const frame = useCurrentFrame();
  const click = scene.clickFrame;
  const pressed = interpolate(frame, [click - 2, click, click + 5], [0, 1, 0], clamp);
  const screenScale = interpolate(frame, [0, 59], [1.012, 1.07], {
    ...clamp,
    easing: easeOut
  });
  const screenX = interpolate(frame, [0, 59], [-18, 20], { ...clamp, easing: easeOut });
  const screenY = interpolate(frame, [0, 59], [4, -12], { ...clamp, easing: easeOut });
  const cursorX = interpolate(frame, [0, click - 4, 59], [1510, scene.clickTarget.x - 9, scene.clickTarget.x - 9], {
    ...clamp,
    easing: easeOut
  });
  const cursorY = interpolate(frame, [0, click - 4, 59], [126, scene.clickTarget.y + 5, scene.clickTarget.y + 5], {
    ...clamp,
    easing: easeOut
  });
  const pulseOpacity = interpolate(frame, [click - 1, click + 16], [0.55, 0], clamp);
  const pulseScale = interpolate(frame, [click - 1, click + 16], [0.3, 2.2], {
    ...clamp,
    easing: easeOut
  });
  const buttonGlow = interpolate(frame, [click - 3, click, click + 14], [0, 0.7, 0], clamp);
  const textOpacity = interpolate(frame, [click, click + 12, 56, 60], [0, 1, 1, 0], clamp);
  const textScale = interpolate(frame, [click, click + 16], [0.965, 1], {
    ...clamp,
    easing: easeOut
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#010403" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${screenX}px, ${screenY}px) scale(${screenScale})`,
          transformOrigin: "center center",
          filter: "saturate(1.05) contrast(1.03)"
        }}
      >
        <Img
          src={staticFile(mediaPath(scene.asset))}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            left: scene.clickTarget.x - 28,
            top: scene.clickTarget.y - 24,
            width: 112,
            height: 54,
            borderRadius: 12,
            opacity: buttonGlow,
            boxShadow: "0 0 42px rgba(103, 255, 219, 0.42), 0 0 0 1px rgba(103,255,219,0.58)",
            background: "rgba(103,255,219,0.08)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: scene.clickTarget.x - 18,
            top: scene.clickTarget.y - 18,
            width: 36,
            height: 36,
            borderRadius: 999,
            opacity: pulseOpacity,
            transform: `scale(${pulseScale})`,
            border: "2px solid rgba(105, 255, 218, 0.95)",
            boxShadow: "0 0 28px rgba(105,255,218,0.45)"
          }}
        />
        <Cursor x={cursorX} y={cursorY} pressed={pressed} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 74% 9%, rgba(103,255,219,0.14), transparent 25%), linear-gradient(90deg, rgba(0,0,0,0.48), rgba(0,0,0,0.08) 54%, rgba(0,0,0,0.5))"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.72)"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
          transform: `scale(${textScale})`
        }}
      >
        <div
          style={{
            color: "#f7fffc",
            fontFamily: "Inter, SF Pro Display, ui-sans-serif, system-ui, sans-serif",
            fontSize: 154,
            lineHeight: 0.92,
            fontWeight: 800,
            letterSpacing: 0,
            textAlign: "center",
            textShadow: "0 20px 80px rgba(0,0,0,0.72), 0 0 36px rgba(103,255,219,0.1)"
          }}
        >
          {scene.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}
