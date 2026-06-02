import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig
} from "remotion";

const colors = {
  background: "#07090b",
  foreground: "#eef4f8",
  muted: "#87919e",
  muted2: "#b6c0ca",
  surface: "#0d1115",
  surface2: "#121820",
  surface3: "#182029",
  line: "#26313b",
  lineStrong: "#34414d",
  teal: "#20e6be",
  lime: "#a6ff6a",
  amber: "#f6b64b",
  rose: "#ff5c7a",
  sky: "#68b7ff",
  violet: "#ad8cff"
};

const scenes = [
  {
    start: 0,
    duration: 300,
    title: "Leadsy Lead Magnet",
    subtitle: "Start with one buyer brief. End with evidence-backed leads and approved outreach.",
    focus: "Start to finish workflow",
    step: "00"
  },
  {
    start: 300,
    duration: 360,
    title: "Tell Leadsy What To Find",
    subtitle: "Enter the service, ideal customers, location, target count, and exclusions.",
    focus: "Step 1: Lead brief",
    step: "01"
  },
  {
    start: 660,
    duration: 360,
    title: "Choose Search Depth",
    subtitle: "Broad mode sweeps more public sources. Focused mode stays tight for a city or niche.",
    focus: "Research mode + source settings",
    step: "02"
  },
  {
    start: 1020,
    duration: 420,
    title: "Preview The Plan",
    subtitle: "Leadsy shows buyer lanes, source types, batch size, and spend guard before search starts.",
    focus: "Protected search plan",
    step: "03"
  },
  {
    start: 1440,
    duration: 420,
    title: "Run Public Research",
    subtitle: "Collectors search free public web, directories, profiles, reviews, websites, and imports.",
    focus: "Live discovery",
    step: "04"
  },
  {
    start: 1860,
    duration: 420,
    title: "Read The Owner Summary",
    subtitle: "The top panel tells you what happened, what to inspect next, and how close you are to target.",
    focus: "Good / target",
    step: "05"
  },
  {
    start: 2280,
    duration: 420,
    title: "Open Lead Results",
    subtitle: "Good leads are separated from weak matches, retained QA, and rejected candidates.",
    focus: "Evidence-backed dossiers",
    step: "06"
  },
  {
    start: 2700,
    duration: 360,
    title: "Draft Outreach",
    subtitle: "Open a lead, review the evidence trail, then create a WhatsApp, DM, or email draft.",
    focus: "Approval-first messages",
    step: "07"
  },
  {
    start: 3060,
    duration: 540,
    title: "Repeat With Confidence",
    subtitle: "Every run is stored in history with receipts, costs, source logs, and guardrails.",
    focus: "Saved workflow",
    step: "08"
  }
] as const;

type Scene = (typeof scenes)[number];

const sourceBadges = [
  "Free public web",
  "Business directories",
  "Public social profiles",
  "Website/contact pages",
  "Reviews/reputation",
  "Content gap audit",
  "Hiring/news signals",
  "Competitor context",
  "Public page extractor",
  "Manual import"
];

const leads = [
  {
    name: "Northstar Dental Studio",
    meta: "Kolkata · Dental clinic",
    score: 86,
    angle: "Instagram is active, but the booking funnel is unclear. Offer a reel + WhatsApp inquiry cleanup."
  },
  {
    name: "Bistro Avenue",
    meta: "Barasat · Cafe",
    score: 78,
    angle: "Good reviews, weak local content cadence. Pitch neighborhood discovery reels and offer posts."
  },
  {
    name: "Aarav Builders",
    meta: "North 24 Parganas · Real estate",
    score: 73,
    angle: "Website has projects but no recent launch content. Pitch campaign calendar and inquiry capture."
  }
];

export const LeadMagnetTutorial = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = scenes.find((candidate) => frame >= candidate.start && frame < candidate.start + candidate.duration) ?? scenes[0];
  const localFrame = frame - scene.start;

  return (
    <AbsoluteFill style={styles.root}>
      <GridBackground />
      <Sequence from={0}>
        <Header scene={scene} />
        <SceneCaption scene={scene} localFrame={localFrame} />
        <Stage scene={scene} localFrame={localFrame} fps={fps} />
        <Timeline frame={frame} />
      </Sequence>
    </AbsoluteFill>
  );
};

function GridBackground() {
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) 0 0 / 48px 48px, linear-gradient(180deg, rgba(255,255,255,0.018) 1px, transparent 1px) 0 0 / 48px 48px, #07090b"
      }}
    />
  );
}

function Header({ scene }: { scene: Scene }) {
  return (
    <div style={styles.header}>
      <div>
        <div style={styles.eyebrow}>Lead Magnet Engine</div>
        <div style={styles.headerTitle}>Find real leads, research them, and draft messages for approval</div>
      </div>
      <div style={styles.headerBadges}>
        <Badge tone="teal">agency owner workflow</Badge>
        <Badge tone="lime">public sources only</Badge>
        <Badge tone="amber">AI drafts only</Badge>
        <Badge tone="violet">Tutorial {scene.step}</Badge>
      </div>
    </div>
  );
}

function SceneCaption({ scene, localFrame }: { scene: Scene; localFrame: number }) {
  const opacity = interpolate(localFrame, [0, 18, scene.duration - 40, scene.duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const y = interpolate(localFrame, [0, 24], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });

  return (
    <div style={{ ...styles.caption, opacity, transform: `translateY(${y}px)` }}>
      <div style={styles.captionStep}>{scene.focus}</div>
      <h1 style={styles.captionTitle}>{scene.title}</h1>
      <p style={styles.captionText}>{scene.subtitle}</p>
    </div>
  );
}

function Stage({ scene, localFrame, fps }: { scene: Scene; localFrame: number; fps: number }) {
  if (scene.step === "00") {
    return <IntroBoard localFrame={localFrame} fps={fps} />;
  }

  return (
    <div style={styles.stage}>
      <LeftWorkflow scene={scene} localFrame={localFrame} />
      <LeadsyScreen scene={scene} localFrame={localFrame} fps={fps} />
    </div>
  );
}

function IntroBoard({ localFrame, fps }: { localFrame: number; fps: number }) {
  const scale = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 90 } });
  const items = [
    ["Brief", "What you sell, who to find, where to search"],
    ["Plan", "Buyer lanes, source mix, batch and spend guard"],
    ["Research", "Public collectors, extraction, dedupe, QA"],
    ["Review", "Owner summary, source receipt, lead dossiers"],
    ["Draft", "Approval-first WhatsApp, DM, or email copy"]
  ];

  return (
    <div style={styles.introWrap}>
      <div style={{ ...styles.introCard, transform: `scale(${0.96 + scale * 0.04})` }}>
        <div style={styles.introKicker}>A start-to-end operating loop</div>
        <div style={styles.introTitle}>Turn a niche and city into a clean outreach queue</div>
        <div style={styles.flowRow}>
          {items.map(([label, detail], index) => (
            <React.Fragment key={label}>
              <div style={styles.flowItem}>
                <div style={styles.flowNumber}>{String(index + 1).padStart(2, "0")}</div>
                <div style={styles.flowLabel}>{label}</div>
                <div style={styles.flowDetail}>{detail}</div>
              </div>
              {index < items.length - 1 ? <div style={styles.arrow}>→</div> : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeftWorkflow({ scene, localFrame }: { scene: Scene; localFrame: number }) {
  const activeIndex = Math.max(0, Number(scene.step) - 1);
  const labels = ["Brief", "Sources", "Plan", "Search", "Summary", "Results", "Draft", "History"];

  return (
    <div style={styles.sidePanel}>
      <div style={styles.sideTitle}>Workflow</div>
      <div style={styles.sideSub}>Use the page from top-left to bottom-right.</div>
      <div style={styles.steps}>
        {labels.map((label, index) => {
          const active = index === activeIndex;
          const done = index < activeIndex;
          const pulse = active
            ? interpolate(localFrame % 60, [0, 30, 60], [0.55, 1, 0.55], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp"
              })
            : 1;
          return (
            <div key={label} style={{ ...styles.stepRow, borderColor: active ? colors.teal : done ? "rgba(166,255,106,0.28)" : colors.line }}>
              <div
                style={{
                  ...styles.stepDot,
                  background: done ? colors.lime : active ? colors.teal : "transparent",
                  opacity: pulse
                }}
              >
                {done ? "✓" : index + 1}
              </div>
              <div>
                <div style={styles.stepLabel}>{label}</div>
                <div style={styles.stepHint}>{stepHint(index)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function stepHint(index: number) {
  return [
    "Target buyer",
    "Public sources",
    "Guarded batch",
    "Live receipt",
    "Next actions",
    "Qualified list",
    "Approval copy",
    "Saved evidence"
  ][index];
}

function LeadsyScreen({ scene, localFrame }: { scene: Scene; localFrame: number; fps: number }) {
  return (
    <div style={styles.screen}>
      <div style={styles.screenTop}>
        <div style={styles.windowDots}>
          <span style={{ ...styles.windowDot, background: colors.rose }} />
          <span style={{ ...styles.windowDot, background: colors.amber }} />
          <span style={{ ...styles.windowDot, background: colors.lime }} />
        </div>
        <div style={styles.urlBar}>leadsy.local/app/magnet</div>
        <Badge tone={scene.step === "04" ? "lime" : "teal"}>{scene.step === "04" ? "running" : "ready"}</Badge>
      </div>
      <div style={styles.screenBody}>
        <BriefPanel scene={scene} localFrame={localFrame} />
        <RightPanel scene={scene} localFrame={localFrame} />
      </div>
    </div>
  );
}

function BriefPanel({ scene, localFrame }: { scene: Scene; localFrame: number }) {
  const showPlan = ["03", "04"].includes(scene.step);
  const briefTypingFrame = scene.step === "01" ? localFrame : 999;

  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.panelHeader}>
          <div>
            <div style={styles.panelKicker}>Step 1</div>
            <div style={styles.panelTitle}>Tell AI what leads to find</div>
          </div>
          <Badge tone={Number(scene.step) >= 1 ? "teal" : "amber"}>{Number(scene.step) >= 1 ? "ready" : "needs brief"}</Badge>
        </div>
        <CheckGrid active={scene.step === "01"} />
        <Field label="What do you sell?" value={typedValue("Content marketing + Instagram reels", briefTypingFrame)} />
        <Field
          label="Who should we find?"
          value={typedValue("Local clinics, cafes, coaching centers and builders with weak social proof", briefTypingFrame - 45)}
          multiline
        />
        <div style={styles.fieldRow}>
          <Field label="Where should we search?" value={typedValue("Barasat, Kolkata, North 24 Parganas", briefTypingFrame - 95)} compact />
          <Field label="How many?" value="25" compact />
        </div>
        <Field label="Who should AI avoid?" value="Agencies, famous brands, businesses outside Kolkata" />
        <ModeSelector active={scene.step === "02"} />
        <div style={styles.buttonRow}>
          <Button label="Save brief" kind="neutral" active={scene.step === "01"} />
          <Button label={showPlan ? "Run protected search" : "Preview search plan"} kind="teal" active={["03", "04"].includes(scene.step)} />
          <Button label={showPlan ? "Run full campaign" : "Preview full campaign"} kind="lime" />
        </div>
      </Panel>
    </div>
  );
}

function CheckGrid({ active }: { active: boolean }) {
  const labels = ["What you sell", "Who to find", "Where to search", "Lead count", "Search sources"];
  return (
    <div style={styles.checkGrid}>
      {labels.map((label, index) => (
        <div key={label} style={{ ...styles.checkItem, background: active && index > 2 ? "rgba(255,255,255,0.03)" : "rgba(32,230,190,0.1)" }}>
          <span style={styles.checkIcon}>{active && index > 2 ? "!" : "✓"}</span>
          {label}
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, multiline = false, compact = false }: { label: string; value: string; multiline?: boolean; compact?: boolean }) {
  return (
    <div style={{ ...styles.field, flex: compact ? 1 : undefined }}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={{ ...styles.input, height: multiline ? 58 : 38, alignItems: multiline ? "flex-start" : "center" }}>{value}</div>
    </div>
  );
}

function ModeSelector({ active }: { active: boolean }) {
  return (
    <div style={styles.modeBox}>
      <div style={styles.modeHeader}>
        <div>
          <div style={styles.fieldLabel}>Research depth</div>
          <div style={styles.modeCopy}>Broad research is for bigger markets; focused is for one city or a small list.</div>
        </div>
        <Badge tone={active ? "lime" : "teal"}>{active ? "broad mode" : "focused mode"}</Badge>
      </div>
      <div style={styles.modeCards}>
        <ModeCard title="Broad OSINT sweep" detail="More searches, more public pages, larger candidate pool." selected={active} />
        <ModeCard title="Focused local search" detail="Faster search for one niche, one city, or a small list." selected={!active} />
      </div>
    </div>
  );
}

function ModeCard({ title, detail, selected }: { title: string; detail: string; selected: boolean }) {
  return (
    <div style={{ ...styles.modeCard, borderColor: selected ? "rgba(32,230,190,0.45)" : colors.line, background: selected ? "rgba(32,230,190,0.12)" : "rgba(0,0,0,0.2)" }}>
      <div style={styles.modeTitle}>{selected ? "✓" : "○"} {title}</div>
      <div style={styles.modeDetail}>{detail}</div>
    </div>
  );
}

function SourcePanel({ localFrame }: { localFrame: number }) {
  const visible = Math.min(sourceBadges.length, Math.floor(localFrame / 18) + 1);

  return (
    <Panel>
      <div style={styles.sourceHeader}>
        <div>
          <div style={styles.panelTitleSmall}>Research source settings</div>
          <div style={styles.modeCopy}>Default is free public research. Open this when you want to change where Leadsy searches.</div>
        </div>
        <Badge tone="teal">10 active</Badge>
      </div>
      <div style={styles.sourceGrid}>
        {sourceBadges.slice(0, visible).map((label, index) => (
          <div key={label} style={styles.sourceCard}>
            <span style={styles.checkbox}>✓</span>
            <div>
              <div style={styles.sourceTitle}>{label}</div>
              <div style={styles.sourceMeta}>{index % 3 === 0 ? "free web" : index % 3 === 1 ? "free public" : "local free"} · ready</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PlanPanel({ localFrame, running }: { localFrame: number; running: boolean }) {
  const progress = running ? interpolate(localFrame, [0, 330], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  return (
    <Panel accent="lime">
      <div style={styles.planHeader}>
        <div>
          <div style={{ ...styles.panelKicker, color: colors.lime }}>Search plan preview</div>
          <div style={styles.panelTitle}>Leadsy will search these buyer lanes first</div>
          <div style={styles.modeCopy}>Protected mode cap Rs. 1.000000. Good 0 / 25 target; this batch will save up to 25.</div>
        </div>
        <div style={styles.headerBadges}>
          <Badge tone="lime">18 searches</Badge>
          <Badge tone="teal">batch 1</Badge>
        </div>
      </div>
      {["Clinics with weak Instagram", "Local cafes with good reviews", "Builders with stale project pages"].map((lane, index) => (
        <Lane key={lane} lane={lane} index={index} localFrame={localFrame} running={running} />
      ))}
      {running ? <Progress value={progress} /> : null}
    </Panel>
  );
}

function Lane({ lane, index, localFrame, running }: { lane: string; index: number; localFrame: number; running: boolean }) {
  const active = running && localFrame > index * 90;
  return (
    <div style={{ ...styles.lane, borderColor: active ? "rgba(166,255,106,0.35)" : colors.line }}>
      <div style={styles.laneTitle}>{active ? "✓" : "•"} {lane}</div>
      <div style={styles.modeCopy}>Search public pages, profiles, reviews, and visible contact details.</div>
      <div style={styles.miniBadges}>
        <Badge tone="neutral">Free public web</Badge>
        <Badge tone="neutral">Website/contact pages</Badge>
        <Badge tone={active ? "lime" : "teal"}>{active ? "evidence found" : "visible proof"}</Badge>
      </div>
    </div>
  );
}

function RightPanel({ scene, localFrame }: { scene: Scene; localFrame: number }) {
  if (scene.step === "02") {
    return (
      <div style={styles.column}>
        <SourcePanel localFrame={localFrame} />
      </div>
    );
  }
  if (scene.step === "03") {
    return (
      <div style={styles.column}>
        <PlanPanel localFrame={localFrame} running={false} />
      </div>
    );
  }
  if (scene.step === "01") {
    return <ReadySummary />;
  }
  if (scene.step === "04") {
    return <RunningSummary localFrame={localFrame} />;
  }
  if (scene.step === "05") {
    return <CompletedSummary />;
  }
  if (scene.step === "06") {
    return <LeadResults localFrame={localFrame} />;
  }
  if (scene.step === "07") {
    return <DraftPanel localFrame={localFrame} />;
  }
  return <HistoryPanel />;
}

function ReadySummary() {
  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.panelKicker}>Owner summary</div>
        <div style={styles.bigTitle}>Ready to find leads</div>
        <div style={styles.summaryText}>Preview the search plan first, then run a protected search.</div>
        <div style={styles.nextActions}>
          <div>Fill the brief</div>
          <div>Preview search plan</div>
          <div>Run protected search</div>
        </div>
      </Panel>
      <MetricGrid values={[["Good / target", "0 / 25"], ["Needs proof", "0"], ["Money spent", "Rs. 0.000000"], ["Batch", "ready"]]} />
      <Receipt waiting />
    </div>
  );
}

function RunningSummary({ localFrame }: { localFrame: number }) {
  const values = [
    ["Searches run", Math.floor(interpolate(localFrame, [0, 330], [0, 18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))],
    ["Pages checked", Math.floor(interpolate(localFrame, [0, 330], [0, 42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))],
    ["Usable prospects", Math.floor(interpolate(localFrame, [120, 330], [0, 11], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))],
    ["Discarded noise", Math.floor(interpolate(localFrame, [60, 330], [0, 31], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))]
  ] as const;

  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.panelKicker}>Owner summary</div>
        <div style={styles.bigTitle}>Research is running</div>
        <div style={styles.summaryText}>Leadsy is checking public sources for batch 1. Good leads count only after identity, location, fit, evidence, and contact checks pass.</div>
      </Panel>
      <MetricGrid values={values.map(([label, value]) => [label, String(value)])} />
      <Transcript localFrame={localFrame} />
    </div>
  );
}

function CompletedSummary() {
  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.panelKicker}>Owner summary</div>
        <div style={styles.bigTitle}>Good 11 / 25</div>
        <div style={styles.summaryText}>Discovery batch finished and saved in history. Review saved leads, open one lead dossier, then draft a message for approval.</div>
        <div style={styles.nextActions}>
          <div>Review saved leads</div>
          <div>Open one lead dossier</div>
          <div>Draft a message</div>
        </div>
      </Panel>
      <MetricGrid values={[["Good / target", "11 / 25"], ["Needs proof", "4"], ["Money spent", "Rs. 0.184020"], ["Batch", "1 · protected"]]} />
      <Receipt />
    </div>
  );
}

function LeadResults({ localFrame }: { localFrame: number }) {
  const visible = Math.min(leads.length, Math.floor(localFrame / 70) + 1);
  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.resultsHeader}>
          <div>
            <div style={styles.panelTitleSmall}>Lead results</div>
            <div style={styles.modeCopy}>Main list shows usable leads first. Weak matches stay separated.</div>
          </div>
          <Badge tone="lime">11 good</Badge>
        </div>
        <div style={styles.tabs}>
          {["Good leads 11", "Needs proof 4", "Rejected 31", "Retained QA 2", "History 6"].map((tab, index) => (
            <div key={tab} style={{ ...styles.tab, background: index === 0 ? "rgba(32,230,190,0.14)" : "rgba(255,255,255,0.03)" }}>{tab}</div>
          ))}
        </div>
        {leads.slice(0, visible).map((lead) => (
          <LeadCard key={lead.name} lead={lead} />
        ))}
      </Panel>
    </div>
  );
}

function DraftPanel({ localFrame }: { localFrame: number }) {
  const draft = typedValue(
    "Hi Northstar Dental team, noticed your clinic has strong reviews but your Instagram booking path is hard to follow. We can help turn patient questions into a simple reel + WhatsApp inquiry flow. Open to a 10-minute idea walkthrough?",
    localFrame - 60,
    2
  );

  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.panelKicker}>Lead dossier</div>
        <div style={styles.bigTitle}>Northstar Dental Studio</div>
        <div style={styles.summaryText}>Kolkata · Dental clinic · score 86 · 4 public evidence sources</div>
        <div style={styles.evidenceBox}>
          <div>✓ Website contact page shows phone and location.</div>
          <div>✓ Public Instagram active, but no booking CTA.</div>
          <div>✓ Reviews mention appointment questions.</div>
        </div>
      </Panel>
      <Panel accent="teal">
        <div style={styles.resultsHeader}>
          <div>
            <div style={styles.panelTitleSmall}>Draft message</div>
            <div style={styles.modeCopy}>Nothing sends automatically. Review and approve first.</div>
          </div>
          <Badge tone="amber">approval required</Badge>
        </div>
        <div style={styles.draftBox}>{draft}</div>
        <div style={styles.buttonRow}>
          <Button label="Copy draft" kind="neutral" active />
          <Button label="Save update" kind="teal" />
          <Button label="Delete lead" kind="rose" />
        </div>
      </Panel>
    </div>
  );
}

function HistoryPanel() {
  return (
    <div style={styles.column}>
      <Panel>
        <div style={styles.panelKicker}>Run history</div>
        <div style={styles.bigTitle}>Every batch stays auditable</div>
        <div style={styles.summaryText}>Brief history, public source receipt, costs, rejected candidates, and agent activity remain attached to the workspace.</div>
      </Panel>
      <Panel>
        {[
          ["Brief", "Content marketing + Instagram reels · clinics, cafes, builders · Kolkata", "updated 02:14 PM"],
          ["Run", "Batch 1: 11 good · 4 needs proof", "completed 02:19 PM"],
          ["Draft", "Northstar Dental Studio · WhatsApp draft saved", "created 02:22 PM"]
        ].map(([type, title, at]) => (
          <div key={title} style={styles.historyRow}>
            <Badge tone={type === "Run" ? "lime" : "teal"}>{type}</Badge>
            <div style={{ flex: 1 }}>
              <div style={styles.historyTitle}>{title}</div>
              <div style={styles.sourceMeta}>{at}</div>
            </div>
          </div>
        ))}
      </Panel>
      <Panel accent="amber">
        <div style={styles.guardrail}>Public sources only. No private profiles, no paid data brokers, no login bypass, no CAPTCHA bypass, no invented contacts.</div>
      </Panel>
    </div>
  );
}

function MetricGrid({ values }: { values: Array<readonly [string, string]> }) {
  return (
    <div style={styles.metricGrid}>
      {values.map(([label, value]) => (
        <div key={label} style={styles.metric}>
          <div style={styles.metricLabel}>{label}</div>
          <div style={styles.metricValue}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Transcript({ localFrame }: { localFrame: number }) {
  const items = [
    ["Search", "Running free public web searches for clinics and cafes in Kolkata.", "running"],
    ["Candidate pool", "42 visible candidates found; merging duplicate business names.", "running"],
    ["Page checked", "Public page extractor found phone, website, and social links.", "completed"],
    ["Saved good lead", "Northstar Dental Studio passed identity, location, fit, evidence, and contact checks.", "completed"]
  ];
  const visible = Math.min(items.length, Math.floor(localFrame / 75) + 1);

  return (
    <Panel>
      <div style={styles.resultsHeader}>
        <div style={styles.panelTitleSmall}>Live research transcript</div>
        <Badge tone="lime">newest first</Badge>
      </div>
      {items.slice(0, visible).map(([title, text, status]) => (
        <div key={title} style={styles.transcriptRow}>
          <div style={{ ...styles.statusIcon, color: status === "completed" ? colors.teal : colors.lime }}>{status === "completed" ? "✓" : "•"}</div>
          <div>
            <div style={styles.sourceTitle}>{title}</div>
            <div style={styles.modeCopy}>{text}</div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function Receipt({ waiting = false }: { waiting?: boolean }) {
  return (
    <Panel>
      <div style={styles.resultsHeader}>
        <div style={styles.panelTitleSmall}>OSINT receipt</div>
        <Badge tone={waiting ? "amber" : "teal"}>{waiting ? "waiting" : "completed"}</Badge>
      </div>
      <div style={styles.summaryText}>
        {waiting
          ? "After research starts, this receipt shows what was checked, what came back, and what was blocked."
          : "18 searches ran, 42 public pages were checked, 31 noisy results were discarded, and 11 records were saved with source evidence."}
      </div>
      <MetricGrid values={[["Searches", waiting ? "0" : "18"], ["Pages", waiting ? "0" : "42"], ["Unique pool", waiting ? "0" : "27"], ["Saved", waiting ? "0" : "11"]]} />
      <div style={styles.guardrail}>No fake records are created when evidence is missing.</div>
    </Panel>
  );
}

function LeadCard({ lead }: { lead: (typeof leads)[number] }) {
  return (
    <div style={styles.leadCard}>
      <div style={styles.leadTop}>
        <div>
          <div style={styles.sourceTitle}>{lead.name}</div>
          <div style={styles.sourceMeta}>{lead.meta}</div>
        </div>
        <Badge tone={lead.score > 80 ? "lime" : "teal"}>{lead.score}</Badge>
      </div>
      <div style={styles.modeCopy}>{lead.angle}</div>
      <div style={styles.buttonRow}>
        <Button label="View" kind="neutral" />
        <Button label="Update" kind="teal" />
        <Button label="Delete" kind="rose" />
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div style={styles.progressTrack}>
      <div style={{ ...styles.progressFill, width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  );
}

function Timeline({ frame }: { frame: number }) {
  const width = `${(frame / 3600) * 100}%`;
  return (
    <div style={styles.timeline}>
      <div style={{ ...styles.timelineFill, width }} />
    </div>
  );
}

function Panel({ children, accent }: { children: React.ReactNode; accent?: "teal" | "lime" | "amber" }) {
  return (
    <section
      style={{
        ...styles.panel,
        borderColor: accent ? hexToRgba(colors[accent], 0.3) : colors.line,
        background: accent ? `linear-gradient(180deg, ${hexToRgba(colors[accent], 0.07)}, rgba(255,255,255,0.015)), rgba(13,17,21,0.92)` : styles.panel.background
      }}
    >
      {children}
    </section>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "teal" | "amber" | "rose" | "sky" | "lime" | "violet" }) {
  const toneColors = {
    neutral: [colors.line, "rgba(255,255,255,0.04)", colors.muted2],
    teal: ["rgba(32,230,190,0.25)", "rgba(32,230,190,0.10)", "#9ff8e8"],
    amber: ["rgba(246,182,75,0.25)", "rgba(246,182,75,0.10)", "#ffd994"],
    rose: ["rgba(255,92,122,0.25)", "rgba(255,92,122,0.10)", "#ffb0bf"],
    sky: ["rgba(104,183,255,0.25)", "rgba(104,183,255,0.10)", "#b8ddff"],
    lime: ["rgba(166,255,106,0.25)", "rgba(166,255,106,0.10)", "#d8ffbd"],
    violet: ["rgba(173,140,255,0.25)", "rgba(173,140,255,0.10)", "#d9cbff"]
  }[tone];

  return <span style={{ ...styles.badge, borderColor: toneColors[0], background: toneColors[1], color: toneColors[2] }}>{children}</span>;
}

function Button({ label, kind, active = false }: { label: string; kind: "neutral" | "teal" | "lime" | "rose"; active?: boolean }) {
  const color = kind === "teal" ? colors.teal : kind === "lime" ? colors.lime : kind === "rose" ? colors.rose : colors.lineStrong;
  return (
    <div style={{ ...styles.button, borderColor: active ? hexToRgba(color, 0.5) : hexToRgba(color, 0.28), background: active ? hexToRgba(color, 0.16) : "rgba(255,255,255,0.04)", color: kind === "neutral" ? colors.foreground : color }}>
      {label}
    </div>
  );
}

function typedValue(value: string, frame: number, speed = 2) {
  const chars = Math.max(0, Math.min(value.length, Math.floor(frame / speed)));
  return value.slice(0, chars) + (chars < value.length ? "▌" : "");
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const bigint = parseInt(value, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const font = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

const styles: Record<string, React.CSSProperties> = {
  root: {
    color: colors.foreground,
    fontFamily: font,
    letterSpacing: 0,
    overflow: "hidden"
  },
  header: {
    position: "absolute",
    left: 64,
    right: 64,
    top: 42,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 28,
    zIndex: 3
  },
  eyebrow: {
    color: colors.teal,
    fontFamily: mono,
    fontSize: 18,
    textTransform: "uppercase"
  },
  headerTitle: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 650
  },
  headerBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  badge: {
    display: "inline-flex",
    height: 30,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 4,
    padding: "0 10px",
    fontFamily: mono,
    fontSize: 14,
    textTransform: "uppercase",
    whiteSpace: "nowrap"
  },
  caption: {
    position: "absolute",
    left: 72,
    top: 122,
    width: 780,
    zIndex: 3
  },
  captionStep: {
    color: colors.amber,
    fontFamily: mono,
    fontSize: 18,
    textTransform: "uppercase"
  },
  captionTitle: {
    margin: "10px 0 0",
    fontSize: 40,
    lineHeight: 1.02,
    letterSpacing: 0,
    fontWeight: 750
  },
  captionText: {
    margin: "12px 0 0",
    color: colors.muted2,
    fontSize: 19,
    lineHeight: 1.35
  },
  stage: {
    position: "absolute",
    left: 64,
    right: 64,
    top: 286,
    bottom: 50,
    display: "grid",
    gridTemplateColumns: "282px minmax(0, 1fr)",
    gap: 18
  },
  introWrap: {
    position: "absolute",
    inset: "250px 80px 95px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  introCard: {
    width: "100%",
    border: `1px solid ${colors.line}`,
    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), rgba(13,17,21,0.92)",
    borderRadius: 8,
    padding: 42,
    boxShadow: "0 24px 90px rgba(0,0,0,0.3)"
  },
  introKicker: {
    color: colors.teal,
    fontFamily: mono,
    fontSize: 18,
    textTransform: "uppercase"
  },
  introTitle: {
    marginTop: 12,
    fontSize: 48,
    fontWeight: 760
  },
  flowRow: {
    display: "grid",
    gridTemplateColumns: "1fr 34px 1fr 34px 1fr 34px 1fr 34px 1fr",
    gap: 16,
    alignItems: "center",
    marginTop: 42
  },
  flowItem: {
    minHeight: 210,
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.035)",
    borderRadius: 8,
    padding: 20
  },
  flowNumber: {
    color: colors.amber,
    fontFamily: mono,
    fontSize: 18
  },
  flowLabel: {
    marginTop: 18,
    fontSize: 26,
    fontWeight: 700
  },
  flowDetail: {
    marginTop: 10,
    color: colors.muted2,
    fontSize: 18,
    lineHeight: 1.42
  },
  arrow: {
    color: colors.teal,
    fontSize: 32,
    textAlign: "center"
  },
  sidePanel: {
    border: `1px solid ${colors.line}`,
    background: "rgba(12,16,20,0.76)",
    borderRadius: 8,
    padding: 14,
    height: "100%"
  },
  sideTitle: {
    fontSize: 21,
    fontWeight: 700
  },
  sideSub: {
    marginTop: 6,
    color: colors.muted2,
    fontSize: 14,
    lineHeight: 1.4
  },
  steps: {
    display: "grid",
    gap: 7,
    marginTop: 14
  },
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
    padding: "8px 10px"
  },
  stepDot: {
    width: 28,
    height: 28,
    border: `1px solid ${colors.lineStrong}`,
    borderRadius: 6,
    color: colors.background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 750,
    fontSize: 12
  },
  stepLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: 700
  },
  stepHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12
  },
  screen: {
    border: `1px solid ${colors.line}`,
    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), rgba(13,17,21,0.94)",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 28px 80px rgba(0,0,0,0.3)"
  },
  screenTop: {
    height: 44,
    borderBottom: `1px solid ${colors.line}`,
    display: "grid",
    gridTemplateColumns: "84px 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "0 14px"
  },
  windowDots: {
    display: "flex",
    gap: 8
  },
  windowDot: {
    width: 10,
    height: 10,
    borderRadius: "50%"
  },
  urlBar: {
    height: 26,
    border: `1px solid ${colors.line}`,
    borderRadius: 6,
    background: "rgba(255,255,255,0.035)",
    color: colors.muted2,
    fontFamily: mono,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    paddingLeft: 12
  },
  screenBody: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
    gap: 12,
    padding: 12,
    height: "calc(100% - 44px)",
    overflow: "hidden"
  },
  column: {
    display: "grid",
    alignContent: "start",
    gap: 9,
    minWidth: 0
  },
  panel: {
    border: `1px solid ${colors.line}`,
    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), rgba(13,17,21,0.92)",
    borderRadius: 8,
    padding: 12,
    minWidth: 0
  },
  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  panelKicker: {
    color: colors.teal,
    fontFamily: mono,
    fontSize: 11,
    textTransform: "uppercase"
  },
  panelTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontSize: 19,
    fontWeight: 720
  },
  panelTitleSmall: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: 720
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 6,
    marginTop: 10,
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 8
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    padding: "6px 6px",
    color: colors.muted2,
    fontSize: 11
  },
  checkIcon: {
    color: colors.teal,
    fontWeight: 800
  },
  field: {
    display: "grid",
    gap: 5,
    marginTop: 8
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: mono,
    fontSize: 10,
    textTransform: "uppercase"
  },
  input: {
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 6,
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 1.35,
    display: "flex",
    padding: "8px 10px",
    overflow: "hidden"
  },
  fieldRow: {
    display: "flex",
    gap: 8
  },
  modeBox: {
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10
  },
  modeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10
  },
  modeCopy: {
    marginTop: 5,
    color: colors.muted2,
    fontSize: 12,
    lineHeight: 1.35
  },
  modeCards: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 9
  },
  modeCard: {
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 6,
    padding: 9
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: 700
  },
  modeDetail: {
    marginTop: 5,
    color: colors.muted2,
    fontSize: 11,
    lineHeight: 1.35
  },
  buttonRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 10
  },
  button: {
    minHeight: 32,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    padding: "0 8px",
    textAlign: "center"
  },
  sourceHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  sourceGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
    marginTop: 10
  },
  sourceCard: {
    display: "flex",
    gap: 8,
    border: `1px solid rgba(32,230,190,0.35)`,
    background: "rgba(32,230,190,0.1)",
    borderRadius: 8,
    padding: 8
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    background: colors.teal,
    color: colors.background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800
  },
  sourceTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: 720
  },
  sourceMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11
  },
  planHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  lane: {
    borderWidth: 1,
    borderStyle: "solid",
    background: "rgba(0,0,0,0.25)",
    borderRadius: 7,
    padding: 9,
    marginTop: 8
  },
  laneTitle: {
    fontSize: 14,
    fontWeight: 720
  },
  miniBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8
  },
  progressTrack: {
    height: 7,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10
  },
  progressFill: {
    height: "100%",
    background: colors.lime,
    borderRadius: 4
  },
  bigTitle: {
    marginTop: 6,
    color: colors.foreground,
    fontSize: 27,
    lineHeight: 1.08,
    fontWeight: 760
  },
  summaryText: {
    marginTop: 8,
    color: colors.muted2,
    fontSize: 14,
    lineHeight: 1.4
  },
  nextActions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 12
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8
  },
  metric: {
    border: `1px solid ${colors.line}`,
    background: "rgba(0,0,0,0.2)",
    borderRadius: 8,
    padding: 10
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: mono,
    fontSize: 10,
    textTransform: "uppercase"
  },
  metricValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: 740,
    marginTop: 6
  },
  resultsHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  transcriptRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    gap: 9,
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 7,
    padding: 9,
    marginTop: 8
  },
  statusIcon: {
    width: 26,
    height: 26,
    border: `1px solid rgba(32,230,190,0.25)`,
    background: "rgba(32,230,190,0.1)",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800
  },
  guardrail: {
    border: `1px solid rgba(32,230,190,0.2)`,
    background: "rgba(32,230,190,0.1)",
    color: "#bffcef",
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.35
  },
  tabs: {
    display: "flex",
    gap: 6,
    marginTop: 10,
    marginBottom: 8
  },
  tab: {
    border: `1px solid ${colors.line}`,
    borderRadius: 6,
    padding: "7px 8px",
    color: colors.muted2,
    fontSize: 11,
    whiteSpace: "nowrap"
  },
  leadCard: {
    border: `1px solid rgba(32,230,190,0.35)`,
    background: "rgba(32,230,190,0.1)",
    borderRadius: 8,
    padding: 10,
    marginTop: 8
  },
  leadTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10
  },
  evidenceBox: {
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.035)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    color: colors.muted2,
    fontSize: 13,
    lineHeight: 1.55
  },
  draftBox: {
    minHeight: 130,
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: 12,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 1.45,
    marginTop: 10
  },
  historyRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    border: `1px solid ${colors.line}`,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 10,
    marginTop: 8
  },
  historyTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: 700
  },
  timeline: {
    position: "absolute",
    left: 64,
    right: 64,
    bottom: 22,
    height: 5,
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    overflow: "hidden"
  },
  timelineFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${colors.teal}, ${colors.lime}, ${colors.amber})`
  }
};
