import { saveUnifiedMetaWebhookMessages, type LeadKnowledgeMessage } from "./lead-knowledge-store";
import { findMetaOAuthConnectionForAssets, type MetaOAuthAssetLookup } from "./meta-oauth-store";

export type RoutedMetaWebhookResult = {
  saved: LeadKnowledgeMessage[];
  ignored: number;
  unmatched: number;
  ambiguous: number;
};

function emptyResult(): RoutedMetaWebhookResult {
  return { saved: [], ignored: 0, unmatched: 0, ambiguous: 0 };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function addResult(left: RoutedMetaWebhookResult, right: RoutedMetaWebhookResult): RoutedMetaWebhookResult {
  return {
    saved: [...left.saved, ...right.saved],
    ignored: left.ignored + right.ignored,
    unmatched: left.unmatched + right.unmatched,
    ambiguous: left.ambiguous + right.ambiguous
  };
}

function payloadForEntry(root: Record<string, unknown>, entry: Record<string, unknown>) {
  return { ...root, entry: [entry] };
}

function payloadForWhatsAppChange(root: Record<string, unknown>, entry: Record<string, unknown>, change: Record<string, unknown>) {
  return {
    ...root,
    entry: [
      {
        ...entry,
        changes: [change]
      }
    ]
  };
}

async function saveForAssets(input: {
  assets: MetaOAuthAssetLookup;
  payload: unknown;
  receivedAt?: string;
}): Promise<RoutedMetaWebhookResult> {
  const resolved = await findMetaOAuthConnectionForAssets(input.assets);
  if (!resolved.ok) {
    return {
      saved: [],
      ignored: 0,
      unmatched: resolved.reason === "ambiguous" ? 0 : 1,
      ambiguous: resolved.reason === "ambiguous" ? 1 : 0
    };
  }

  const result = await saveUnifiedMetaWebhookMessages({
    tenantId: resolved.connection.tenantId,
    ownerId: resolved.connection.ownerId,
    payload: input.payload,
    receivedAt: input.receivedAt
  });
  return { ...emptyResult(), saved: result.saved, ignored: result.ignored };
}

async function saveWhatsAppEntry(input: {
  root: Record<string, unknown>;
  entry: Record<string, unknown>;
  receivedAt?: string;
}) {
  const whatsappBusinessAccountId = asString(input.entry.id);
  const changes = asArray(input.entry.changes).map(asRecord).filter(Boolean) as Record<string, unknown>[];

  if (!changes.length) {
    return saveForAssets({
      assets: { whatsappBusinessAccountId },
      payload: payloadForEntry(input.root, input.entry),
      receivedAt: input.receivedAt
    });
  }

  let total = emptyResult();
  for (const change of changes) {
    const value = asRecord(change.value);
    const metadata = asRecord(value?.metadata);
    const phoneNumberId = asString(metadata?.phone_number_id);
    const result = await saveForAssets({
      assets: { whatsappBusinessAccountId, phoneNumberId },
      payload: payloadForWhatsAppChange(input.root, input.entry, change),
      receivedAt: input.receivedAt
    });
    total = addResult(total, result);
  }
  return total;
}

export async function saveRoutedMetaWebhookMessages(input: {
  payload: unknown;
  receivedAt?: string;
}): Promise<RoutedMetaWebhookResult> {
  const root = asRecord(input.payload);
  if (!root) return { ...emptyResult(), unmatched: 1 };

  const object = asString(root.object);
  let total = emptyResult();
  for (const entryValue of asArray(root.entry)) {
    const entry = asRecord(entryValue);
    const entryId = asString(entry?.id);
    if (!entry || !entryId) {
      total = addResult(total, { ...emptyResult(), unmatched: 1 });
      continue;
    }

    const result =
      object === "whatsapp_business_account"
        ? await saveWhatsAppEntry({ root, entry, receivedAt: input.receivedAt })
        : await saveForAssets({
            assets: object === "instagram" ? { instagramBusinessAccountId: entryId } : { facebookPageId: entryId },
            payload: payloadForEntry(root, entry),
            receivedAt: input.receivedAt
          });
    total = addResult(total, result);
  }

  return total;
}
