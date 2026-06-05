import type { ChatMessage, ChatSiteProfile, MessageDirection } from "./types";

export function mergeNewMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(existing.map((message) => message.id));
  const merged = [...existing];

  for (const message of incoming) {
    if (!seen.has(message.id)) {
      seen.add(message.id);
      merged.push(message);
    }
  }

  return merged;
}

export function getIncomingTail(messages: ChatMessage[]): ChatMessage[] {
  const tail: ChatMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.direction !== "incoming") {
      break;
    }
    tail.unshift(message);
  }

  return tail;
}

export function getUnansweredIncomingTurn(messages: ChatMessage[]): ChatMessage[] {
  const lastOutgoingIndex = findLastIndex(messages, (message) => message.direction === "outgoing");
  return messages
    .slice(lastOutgoingIndex + 1)
    .filter((message) => message.direction === "incoming");
}

export function createMessageId(text: string, direction: MessageDirection, seed: string | number): string {
  const normalized = text.trim().replace(/\s+/g, " ").slice(0, 120);
  return `${direction}:${hashString(`${seed}:${normalized}`)}`;
}

export function extractMessagesFromDocument(
  profile: ChatSiteProfile,
  doc: Document = document
): ChatMessage[] {
  const nodes = uniqueMessageNodes(Array.from(doc.querySelectorAll<HTMLElement>(profile.messageSelector)));
  const sourceUrl = doc.location?.href || window.location.href;

  const messages: ChatMessage[] = [];

  nodes.forEach((node, index) => {
    const text = extractReadableMessageText(node);
    if (!text) {
      return;
    }

    const direction = inferDirection(node, profile);
    const rawTimestamp = node.getAttribute("data-timestamp") || node.getAttribute("datetime");
    const timestamp = rawTimestamp ? Number(rawTimestamp) || Date.now() : Date.now();

    messages.push({
      id:
        node.id ||
        node.getAttribute("data-message-id") ||
        node.getAttribute("data-id") ||
        node.closest<HTMLElement>("[data-id]")?.getAttribute("data-id") ||
        createMessageId(text, direction, `${sourceUrl}:${index}`),
      direction,
      text,
      timestamp,
      sourceUrl,
      raw: {
        selector: profile.messageSelector
      }
    });
  });

  return messages;
}

function uniqueMessageNodes(nodes: HTMLElement[]): HTMLElement[] {
  const selected: HTMLElement[] = [];

  for (const node of nodes) {
    if (selected.some((existing) => existing.contains(node))) {
      continue;
    }

    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (node.contains(selected[index])) {
        selected.splice(index, 1);
      }
    }

    selected.push(node);
  }

  return selected;
}

function extractReadableMessageText(node: HTMLElement): string {
  const readable = node.querySelector<HTMLElement>(".selectable-text, [dir='auto'], [data-pre-plain-text]");
  return (readable?.innerText || readable?.textContent || node.innerText || node.textContent || "").trim();
}

function inferDirection(node: HTMLElement, profile: ChatSiteProfile): MessageDirection {
  if (
    node.matches(profile.incomingSelector) ||
    node.closest(profile.incomingSelector) ||
    node.querySelector(profile.incomingSelector)
  ) {
    return "incoming";
  }

  if (
    node.matches(profile.outgoingSelector) ||
    node.closest(profile.outgoingSelector) ||
    node.querySelector(profile.outgoingSelector)
  ) {
    return "outgoing";
  }

  const dataId = node.getAttribute("data-id");
  if (dataId?.startsWith("false_")) {
    return "incoming";
  }
  if (dataId?.startsWith("true_")) {
    return "outgoing";
  }

  const rect = node.getBoundingClientRect();
  const containerRect = directionContainerRect(node, profile);
  if (rect.width > 0 && containerRect.width > 0) {
    const leftGap = Math.max(0, rect.left - containerRect.left);
    const rightGap = Math.max(0, containerRect.right - rect.right);
    const isBubbleSized = rect.width < containerRect.width * 0.9;

    if (containerRect.fromContainer && isBubbleSized && Math.abs(leftGap - rightGap) > containerRect.width * 0.05) {
      return rightGap < leftGap ? "outgoing" : "incoming";
    }

    if (!containerRect.fromContainer && isBubbleSized && rect.left < containerRect.width * 0.5) {
      return "incoming";
    }
    if (!containerRect.fromContainer && isBubbleSized && rect.left > containerRect.width * 0.5) {
      return "outgoing";
    }

    const center = rect.left + rect.width / 2;
    const relativeCenter = (center - containerRect.left) / containerRect.width;
    if (relativeCenter > 0.58) {
      return "outgoing";
    }
    if (relativeCenter < 0.42) {
      return "incoming";
    }
  }

  return "system";
}

function directionContainerRect(
  node: HTMLElement,
  profile: ChatSiteProfile
): Pick<DOMRect, "left" | "right" | "width"> & { fromContainer: boolean } {
  const ownerDocument = node.ownerDocument || document;
  const container = safeClosest(node, profile.messageListSelector) || safeQuery(ownerDocument, profile.messageListSelector);
  const rect = container?.getBoundingClientRect();
  if (rect && rect.width > 0) {
    return { left: rect.left, right: rect.right, width: rect.width, fromContainer: true };
  }

  const width = ownerDocument.defaultView?.innerWidth || window.innerWidth || 0;
  return {
    left: 0,
    right: width,
    width,
    fromContainer: false
  };
}

function safeClosest(node: HTMLElement, selector: string): HTMLElement | null {
  try {
    return node.closest<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function safeQuery(doc: Document, selector: string): HTMLElement | null {
  try {
    return doc.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }
  return -1;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
