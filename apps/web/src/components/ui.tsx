import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "amber" | "rose" | "sky" | "lime" | "violet";
}) {
  const tones = {
    neutral: "border-[var(--line)] bg-white/[0.04] text-[var(--muted-2)]",
    teal: "border-teal-300/25 bg-teal-300/10 text-teal-200",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    rose: "border-rose-300/25 bg-rose-300/10 text-rose-200",
    sky: "border-sky-300/25 bg-sky-300/10 text-sky-200",
    lime: "border-lime-300/25 bg-lime-300/10 text-lime-200",
    violet: "border-violet-300/25 bg-violet-300/10 text-violet-200"
  };

  return (
    <span
      className={`mono inline-flex h-6 items-center gap-1 rounded-[4px] border px-2 text-[11px] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Panel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function SectionTitle({
  eyebrow,
  title,
  action
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow ? <div className="mono mb-2 text-[11px] uppercase text-[var(--teal)]">{eyebrow}</div> : null}
        <h2 className="text-xl font-semibold text-white md:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  tone = "good"
}: {
  label: string;
  value: string;
  delta: string;
  tone?: "good" | "watch" | "risk" | "flat";
}) {
  const toneClass = {
    good: "text-teal-200",
    watch: "text-amber-200",
    risk: "text-rose-200",
    flat: "text-[var(--muted-2)]"
  }[tone];
  const Icon = tone === "risk" ? ArrowDownRight : tone === "flat" ? Minus : ArrowUpRight;

  return (
    <div className="panel-quiet scanline p-4">
      <div className="mono text-[11px] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold text-white">{value}</div>
        <div className={`mono flex items-center gap-1 text-xs ${toneClass}`}>
          <Icon size={14} />
          {delta}
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "teal"
}: {
  value: number;
  tone?: "teal" | "amber" | "rose" | "sky" | "lime" | "violet";
}) {
  const color = {
    teal: "bg-[var(--teal)]",
    amber: "bg-[var(--amber)]",
    rose: "bg-[var(--rose)]",
    sky: "bg-[var(--sky)]",
    lime: "bg-[var(--lime)]",
    violet: "bg-[var(--violet)]"
  }[tone];

  return (
    <div className="h-2 overflow-hidden rounded-[4px] bg-white/[0.08]">
      <div className={`h-full rounded-[4px] ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:border-teal-200 hover:bg-teal-300/[0.18]"
    >
      {children}
    </a>
  );
}

export function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-4 text-sm font-medium text-[var(--muted-2)] hover:border-[var(--line-strong)] hover:text-white"
    >
      {children}
    </a>
  );
}

export function MiniBars({ values }: { values: number[] }) {
  return (
    <div className="flex h-16 items-end gap-1">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="w-full rounded-[3px] bg-teal-300/70"
          style={{ height: `${value}%`, opacity: 0.42 + index * 0.06 }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  detail,
  action
}: {
  icon?: LucideIcon;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] bg-black/20 p-6 text-center">
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-teal-300/25 bg-teal-300/10 text-teal-100">
          <Icon size={20} />
        </div>
      ) : null}
      <div className="mt-4 text-base font-semibold text-white">{title}</div>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-2)]">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
