import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import plan from "../ad-plan.json";
import { Scene1 } from "./Scene1";
import { Scene2 } from "./Scene2";
import { Scene3 } from "./Scene3";

const mediaPath = (path: string) => path.replace(/^(\.\.\/)?public\//, "");

export const LeadsyTeaser = () => {
  const [scene1, scene2, scene3] = plan.scenes;

  return (
    <AbsoluteFill style={{ backgroundColor: "#020303" }}>
      <Audio src={staticFile(mediaPath(plan.audio.ambientPad))} volume={0.62} />
      <Sequence from={plan.audio.clickImpactFrame}>
        <Audio src={staticFile(mediaPath(plan.audio.clickImpact))} volume={0.78} />
      </Sequence>

      <Sequence from={scene1.fromFrame} durationInFrames={scene1.durationFrames}>
        <Scene1 scene={scene1} />
      </Sequence>
      <Sequence from={scene2.fromFrame} durationInFrames={scene2.durationFrames}>
        <Scene2 scene={scene2} />
      </Sequence>
      <Sequence from={scene3.fromFrame} durationInFrames={scene3.durationFrames}>
        <Scene3 scene={scene3} />
      </Sequence>
    </AbsoluteFill>
  );
};
