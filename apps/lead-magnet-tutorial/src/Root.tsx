import { Composition } from "remotion";
import { LeadMagnetTutorial } from "./TutorialVideo";

export const tutorialFps = 30;
export const tutorialDurationInFrames = 3600;

export const RemotionRoot = () => {
  return (
    <Composition
      id="LeadMagnetTutorial"
      component={LeadMagnetTutorial}
      durationInFrames={tutorialDurationInFrames}
      fps={tutorialFps}
      width={1920}
      height={1080}
    />
  );
};
