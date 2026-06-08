import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

const tutorials = [
  {
    title: "Leads",
    detail: "Use the lead workspace as the CRM record. Details holds qualification and ownership, Comms holds channel activity, and Tasks holds accountable work."
  },
  {
    title: "Inbox",
    detail: "Inbox is the operating surface for WhatsApp conversations. Use filters, summary, and the lead link to move between chat and CRM context."
  },
  {
    title: "Team Chat",
    detail: "Team Chat is the internal workspace room. Mention AI agents with @ only when you want them to help; assignment and task events appear as system messages."
  },
  {
    title: "Calendar",
    detail: "Calendar stores Leadsy-native availability, meetings, holds, and lead-linked events. Agents can only propose times from this data."
  },
  {
    title: "Approvals And Tasks",
    detail: "AI or hybrid-agent work lands in Approval Queue. Human-owned follow-up work lands in Follow-up Tasks."
  },
  {
    title: "Cost Receipt",
    detail: "The receipt button shows real AI spend, real Twilio spend, and projected Twilio-equivalent simulator burn for testing flows."
  }
];

export default function TutorialsPage() {
  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <div className="caption">Tutorials</div>
        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] border border-border bg-surface text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leadsy tutorials</h1>
            <p className="mt-1 text-sm text-muted-foreground">Text walkthroughs for the current product. Video lessons can be generated later.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tutorials.map((tutorial) => (
            <section key={tutorial.title} className="rounded-[8px] border border-border bg-surface p-4">
              <h2 className="text-lg font-semibold">{tutorial.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{tutorial.detail}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
