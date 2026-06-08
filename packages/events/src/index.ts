export type RevenueEventName =
  | "lead.detected"
  | "meta.lead.ingested"
  | "qualification.scored"
  | "whatsapp.reply.generated"
  | "lead.enriched"
  | "lead.routed"
  | "sequence.started"
  | "deal.updated"
  | "workflow.executed"
  | "copilot.invoked";

export type RevenueEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  tenantId: string;
  name: RevenueEventName;
  payload: TPayload;
  occurredAt: string;
};

type Handler = (event: RevenueEvent) => void | Promise<void>;

export class InMemoryEventBus {
  private handlers = new Map<RevenueEventName, Handler[]>();
  private log: RevenueEvent[] = [];

  subscribe(name: RevenueEventName, handler: Handler) {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(handler);
    this.handlers.set(name, handlers);
    return () => {
      this.handlers.set(
        name,
        (this.handlers.get(name) ?? []).filter((candidate) => candidate !== handler)
      );
    };
  }

  async publish(event: Omit<RevenueEvent, "id" | "occurredAt">) {
    const enriched: RevenueEvent = {
      ...event,
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString()
    };
    this.log.push(enriched);
    await Promise.all((this.handlers.get(enriched.name) ?? []).map((handler) => handler(enriched)));
    return enriched;
  }

  recent(limit = 25) {
    return this.log.slice(-limit).reverse();
  }
}

export const eventBus = new InMemoryEventBus();
