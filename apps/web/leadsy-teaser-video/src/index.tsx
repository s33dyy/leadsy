import { Composition, registerRoot } from "remotion";
import plan from "../ad-plan.json";
import { LeadsyTeaser } from "./LeadsyTeaser";

const Root = () => (
  <Composition
    id="LeadsyTeaser"
    component={LeadsyTeaser}
    durationInFrames={plan.durationFrames}
    fps={plan.fps}
    width={plan.width}
    height={plan.height}
  />
);

registerRoot(Root);
