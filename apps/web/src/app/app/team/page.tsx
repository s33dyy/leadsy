import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listAuthUsers } from "@/lib/auth-store";
import { listCrmAssignmentRules } from "@/lib/crm-store";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getCurrentSession();
  const users = session ? (await listAuthUsers()).filter((user) => user.tenantId === session.tenantId) : [];
  const assignmentRules = session ? await listCrmAssignmentRules({ tenantId: session.tenantId, ownerId: session.id }) : [];

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[10px] border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users2 className="h-4 w-4 text-primary" />
            Team
          </div>
          <h1 className="mt-2 text-xl font-semibold">Read-only workspace team</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Phase 4.5 only verifies who can operate the CRM and which assignment defaults are configured. User management workflows are reserved for a later phase.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="teal">Read-only</Badge>
            <Badge tone="neutral">No management workflows</Badge>
          </div>
        </header>

        <section className="rounded-[10px] border border-border bg-surface p-5">
          <div className="caption">Current user</div>
          {session ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <ReadOnlyField label="Name" value={session.name} />
              <ReadOnlyField label="Email" value={session.email} />
              <ReadOnlyField label="Role" value={session.role} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No Data Available</p>
          )}
        </section>

        <section className="rounded-[10px] border border-border bg-surface p-5">
          <div className="caption">Workspace users</div>
          {users.length ? (
            <div className="mt-3 divide-y divide-border rounded-[8px] border border-border">
              {users.map((user) => (
                <div key={user.id} className="grid gap-2 p-3 md:grid-cols-4">
                  <div className="text-sm font-medium text-foreground">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.emailOrPhone}</div>
                  <div className="font-mono text-xs text-muted-foreground">{user.role}</div>
                  <div className="font-mono text-xs text-muted-foreground">{user.onboardingCompletedAt ? "Onboarded" : "Onboarding pending"}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No Data Available</p>
          )}
        </section>

        <section className="rounded-[10px] border border-border bg-surface p-5">
          <div className="caption">Assignment configuration</div>
          {assignmentRules.length ? (
            <div className="mt-3 grid gap-2">
              {assignmentRules.map((rule) => (
                <div key={rule.id} className="rounded-[8px] border border-border bg-background/50 p-3">
                  <div className="text-sm font-medium text-foreground">{rule.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Source contains {rule.sourceIncludes || "Not Configured"} → {rule.assigneeName}</div>
                  <div className="mt-2 font-mono text-xs text-muted-foreground">Rule {rule.id}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Not Configured</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-background/50 p-3">
      <div className="caption">{label}</div>
      <div className="mt-1 break-words text-sm text-foreground">{value || "No Data Available"}</div>
    </div>
  );
}
