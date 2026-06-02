import { ChatAutomationController } from "./automation";
import { createStatusChip } from "./status-chip";
import { RuntimeWorkerClient, openLeadsySidePanel } from "../core/runtime-client";

const runtimeClient = new RuntimeWorkerClient();
const controller = new ChatAutomationController((state) => chip.setState(state), {
  openRouter: runtimeClient
});

const chip = createStatusChip({
  onOpenPanel: openLeadsySidePanel,
  onPause: () => controller.pause()
});

chip.mount(document.documentElement);

void controller.arm();
