import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame
} from "remotion";

type Scene2Props = {
  scene: {
    asset: string;
    text: string;
  };
};

const mediaPath = (path: string) => path.replace(/^(\.\.\/)?public\//, "");
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const
};

export function Scene2({ scene }: Scene2Props) {
  const frame = useCurrentFrame();
  const imgScale = interpolate(frame, [0, 59], [1.08, 1.155], {
    ...clamp,
    easing: easeOut
  });
  const fadeOut = interpolate(frame, [52, 60], [1, 0], clamp);
  const textOpacity = interpolate(frame, [7, 21, 54, 60], [0, 1, 1, 0], clamp);
  const textY = interpolate(frame, [7, 23], [20, 0], { ...clamp, easing: easeOut });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#070403", opacity: fadeOut }}>
      <Img
        src={staticFile(mediaPath(scene.asset))}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 72%",
          transform: `scale(${imgScale})`,
          transformOrigin: "center center",
          filter: "saturate(0.98) contrast(1.05) brightness(0.88)"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 28% 54%, rgba(255,210,156,0.2), transparent 34%), linear-gradient(90deg, rgba(22,9,4,0.52), rgba(0,0,0,0.18) 52%, rgba(25,9,3,0.52))"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 190px rgba(0,0,0,0.58)"
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
          transform: `translateY(${textY}px)`
        }}
      >
        <div
          style={{
            color: "#fffaf2",
            fontFamily: "Inter, SF Pro Display, ui-sans-serif, system-ui, sans-serif",
            fontSize: 144,
            lineHeight: 0.95,
            fontWeight: 800,
            letterSpacing: 0,
            textAlign: "center",
            textShadow: "0 24px 76px rgba(24,10,4,0.7)"
          }}
        >
          {scene.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}
