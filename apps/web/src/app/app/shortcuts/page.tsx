import { Keyboard } from "lucide-react";

export const dynamic = "force-dynamic";

const shortcutGroups = [
  {
    title: "Global navigation",
    rows: [
      ["I", "Dashboard"],
      ["L", "Leads"],
      ["T", "Inbox"],
      ["C", "Calendar"],
      ["G", "Team Chat"],
      ["Q", "Approval Queue"],
      ["Cmd/Ctrl + T", "Teamspace"],
      ["Cmd/Ctrl + Shift + Q", "Follow-up Tasks"],
      ["Cmd/Ctrl + ,", "Settings"]
    ]
  },
  {
    title: "Global actions",
    rows: [
      ["N", "New lead"],
      ["Cmd/Ctrl + K", "Command search"],
      ["Esc", "Close open modal"]
    ]
  },
  {
    title: "Page shortcuts",
    rows: [
      ["/", "Focus search on Leads, Inbox, Calendar, Approval Queue, and Follow-up Tasks"],
      ["U / R / M / A", "Inbox filters: unread, needs reply, assigned to me, all"],
      ["O", "Open the selected Inbox lead"],
      ["Cmd/Ctrl + S", "Summarize the active lead or conversation"],
      ["D / W / M / Y / T", "Calendar views and Today"],
      ["E", "New calendar event"]
    ]
  }
];

export default function ShortcutKeysPage() {
  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <div className="caption">Tutorials / Shortcut keys</div>
        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] border border-border bg-surface text-primary">
            <Keyboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Shortcut keys</h1>
            <p className="mt-1 text-sm text-muted-foreground">Keyboard routes and page actions for moving around Leadsy quickly.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {shortcutGroups.map((group) => (
            <section key={group.title} className="rounded-[8px] border border-border bg-surface">
              <div className="border-b border-border p-4 font-medium">{group.title}</div>
              <div className="divide-y divide-border">
                {group.rows.map(([shortcut, action]) => (
                  <div key={`${group.title}-${shortcut}`} className="grid grid-cols-[120px_1fr] gap-3 p-3 text-sm">
                    <span className="font-mono text-[11px] text-primary">{shortcut}</span>
                    <span className="text-muted-foreground">{action}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
