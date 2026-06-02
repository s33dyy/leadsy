import { accounts, contacts } from "@leadsy/domain";
import { Badge } from "./ui";

export function RelationshipGraph() {
  const nodes = [
    { id: "platform", label: "Leadsy", x: 46, y: 42, tone: "teal" as const },
    ...accounts.slice(0, 4).map((account, index) => ({
      id: account.id,
      label: account.name,
      x: [10, 72, 18, 78][index],
      y: [16, 18, 70, 72][index],
      tone: account.intent > 90 ? ("lime" as const) : account.health < 60 ? ("rose" as const) : ("sky" as const)
    }))
  ];

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[8px] border border-[var(--line)] bg-black/20">
      <svg className="absolute inset-0 h-full w-full" role="presentation">
        {nodes.slice(1).map((node) => (
          <line
            key={node.id}
            x1="50%"
            y1="47%"
            x2={`${node.x}%`}
            y2={`${node.y}%`}
            stroke="rgba(32,230,190,.34)"
            strokeWidth="1"
            strokeDasharray="7 7"
          />
        ))}
      </svg>
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-2)] p-3 text-center shadow-xl shadow-black/25"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <Badge tone={node.tone}>{node.id === "platform" ? "system" : "account"}</Badge>
          <div className="mt-2 truncate text-sm font-semibold text-white">{node.label}</div>
          <div className="mono mt-1 text-[10px] text-[var(--muted)]">
            {node.id === "platform" ? "account graph" : `${contacts.filter((contact) => contact.accountId === node.id).length} people`}
          </div>
        </div>
      ))}
    </div>
  );
}
