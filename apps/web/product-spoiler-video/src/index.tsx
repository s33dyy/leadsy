import { Composition, registerRoot } from "remotion";
import plan from "../ad-plan.json";
import { LeadsyProductSpoiler } from "./LeadsyProductSpoiler";

const Root = () => (
  <Composition
    id="LeadsyProductSpoiler"
    component={LeadsyProductSpoiler}
    durationInFrames={plan.durationFrames}
    fps={plan.fps}
    width={plan.width}
    height={plan.height}
  />
);

registerRoot(Root);
