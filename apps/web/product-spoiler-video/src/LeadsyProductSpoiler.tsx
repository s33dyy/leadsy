import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { useEffect, useMemo } from "react";
import plan from "../ad-plan.json";

type Accent = "amber" | "cyan" | "green" | "teal" | "violet";

type Scene = {
  id: string;
  title: string;
  eyebrow: string;
  detail: string;
  fromFrame: number;
  durationFrames: number;
  screenshot: string;
  focus: string;
  accent: Accent;
};

type Voiceover = {
  id: string;
  text: string;
  fromFrame: number;
  durationFrames: number;
  audio: string;
};

const scenes = plan.scenes as Scene[];
const voiceover = plan.voiceover as Voiceover[];

const accentColors: Record<Accent, string> = {
  amber: "#f4b45e",
  cyan: "#67e8f9",
  green: "#77f0a4",
  teal: "#38f2d0",
  violet: "#b99cff"
};

const mediaPath = (path: string) => path.replace(/^(\.\.\/)?public\//, "");

function currentSceneAt(frame: number) {
  return (
    [...scenes]
      .reverse()
      .find((scene) => frame >= scene.fromFrame) ?? scenes[0]
  );
}

function sceneProgress(frame: number, scene: Scene) {
  return Math.max(0, Math.min(1, (frame - scene.fromFrame) / scene.durationFrames));
}

function activeVoiceover(frame: number) {
  return voiceover.find(
    (phrase) => frame >= phrase.fromFrame && frame < phrase.fromFrame + phrase.durationFrames + 42
  );
}

function safeInterpolate(value: number, input: [number, number], output: [number, number]) {
  if (input[0] === input[1]) return output[1];
  return interpolate(value, input, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

function BackgroundGrid({ accent }: { accent: string }) {
  return (
    <AbsoluteFill
      style={{
        background:
          `radial-gradient(circle at 20% 20%, ${accent}24, transparent 32%), ` +
          "linear-gradient(135deg, #050707 0%, #091011 48%, #020303 100%)"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(to bottom, black, transparent 78%)"
        }}
      />
    </AbsoluteFill>
  );
}

function SceneFrame({ scene, index }: { scene: Scene; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - scene.fromFrame;
  const progress = sceneProgress(frame, scene);
  const accent = accentColors[scene.accent];
  const entrance = spring({ frame: Math.max(0, local), fps, config: { damping: 28, stiffness: 130 } });
  const exit = safeInterpolate(progress, [0.86, 1], [1, 0]);
  const scale = 0.94 + entrance * 0.055 + progress * 0.018;
  const x = safeInterpolate(progress, [0, 1], [index % 2 === 0 ? 18 : -18, index % 2 === 0 ? -10 : 10]);
  const y = safeInterpolate(progress, [0, 1], [10, -8]);

  return (
    <Sequence from={scene.fromFrame} durationInFrames={scene.durationFrames + 30}>
      <AbsoluteFill style={{ opacity: exit }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${x}px, ${y}px) scale(${scale})`,
            transformOrigin: "center",
            filter: "saturate(1.05) contrast(1.04)"
          }}
        >
          <Img
            src={staticFile(mediaPath(scene.screenshot))}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.26) 34%, rgba(0,0,0,0.08) 64%, rgba(0,0,0,0.58) 100%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 70,
            width: 560,
            transform: `translateY(${safeInterpolate(entrance, [0, 1], [26, 0])}px)`,
            opacity: entrance
          }}
        >
          <div
            style={{
              color: accent,
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              fontSize: 20,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0
            }}
          >
            {scene.eyebrow}
          </div>
          <div
            style={{
              marginTop: 14,
              color: "#f7fffc",
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              fontSize: scene.title.length > 24 ? 54 : 70,
              lineHeight: 1,
              fontWeight: 760,
              letterSpacing: 0,
              textWrap: "balance"
            }}
          >
            {scene.title}
          </div>
          <div
            style={{
              marginTop: 22,
              maxWidth: 520,
              color: "#b8c8c4",
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              fontSize: 25,
              lineHeight: 1.35,
              fontWeight: 500,
              letterSpacing: 0
            }}
          >
            {scene.detail}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 72,
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "#eafff8",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSize: 18,
            fontWeight: 700
          }}
        >
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 28px ${accent}`
            }}
          />
          <span>{String(index + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</span>
        </div>
      </AbsoluteFill>
    </Sequence>
  );
}

function PhrasePunch() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phrase = activeVoiceover(frame);
  if (!phrase) return null;

  const local = frame - phrase.fromFrame;
  const inSpring = spring({ frame: Math.max(0, local), fps, config: { damping: 18, stiffness: 180 } });
  const out = safeInterpolate(local, [phrase.durationFrames + 16, phrase.durationFrames + 42], [1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        bottom: 86,
        height: 112,
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity: inSpring * out,
        transform: `translateY(${safeInterpolate(inSpring, [0, 1], [34, 0])}px)`
      }}
    >
      <div
        style={{
          width: 7,
          height: 96,
          borderRadius: 999,
          background: "#38f2d0",
          boxShadow: "0 0 30px rgba(56, 242, 208, 0.55)"
        }}
      />
      <div
        style={{
          color: "#ffffff",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: phrase.text.length > 16 ? 74 : 92,
          lineHeight: 1,
          fontWeight: 820,
          letterSpacing: 0,
          textShadow: "0 22px 60px rgba(0, 0, 0, 0.62)"
        }}
      >
        {phrase.text}
      </div>
    </div>
  );
}

function Timeline({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const accent = accentColors[scene.accent];
  const globalProgress = safeInterpolate(frame, [0, plan.durationFrames - 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 42,
        height: 4,
        borderRadius: 999,
        background: "rgba(255,255,255,0.16)",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          width: `${globalProgress * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, #38f2d0, ${accent})`
        }}
      />
    </div>
  );
}

function BrandLockup() {
  const frame = useCurrentFrame();
  const show = safeInterpolate(frame, [0, 36], [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: 44,
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity: show
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          color: "#06100e",
          background: "#38f2d0",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 860
        }}
      >
        L
      </div>
      <div
        style={{
          color: "#effffb",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: 26,
          fontWeight: 760,
          letterSpacing: 0
        }}
      >
        Leadsy
      </div>
    </div>
  );
}

function AudioTracks() {
  return (
    <>
      <Audio src={staticFile(mediaPath(plan.music.audio))} volume={plan.music.volume} />
      {voiceover.map((phrase) => (
        <Sequence key={phrase.id} from={phrase.fromFrame}>
          <Audio src={staticFile(mediaPath(phrase.audio))} volume={1} />
        </Sequence>
      ))}
    </>
  );
}

export function LeadsyProductSpoiler() {
  const frame = useCurrentFrame();
  const [handle] = useMemo(() => [delayRender("preload product spoiler assets")], []);
  const scene = currentSceneAt(frame);
  const accent = accentColors[scene.accent];

  useEffect(() => {
    continueRender(handle);
  }, [handle]);

  return (
    <AbsoluteFill style={{ background: "#040606" }}>
      <BackgroundGrid accent={accent} />
      {scenes.map((item, index) => (
        <SceneFrame key={item.id} scene={item} index={index} />
      ))}
      <BrandLockup />
      <PhrasePunch />
      <Timeline scene={scene} />
      <AudioTracks />
    </AbsoluteFill>
  );
}
