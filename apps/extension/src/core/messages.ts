import type { ChatMessage, ChatSiteProfile, MessageDirection } from "./types";

function getAlignmentScore(existing: ChatMessage[], incoming: ChatMessage[], shift: number): number {
  let matches = 0;

  const startIncoming = Math.max(0, -shift);
  const endIncoming = Math.min(incoming.length, existing.length - shift);

  if (startIncoming >= endIncoming) return 0; // No overlap

  for (let i = startIncoming; i < endIncoming; i++) {
    const eMsg = existing[i + shift];
    const iMsg = incoming[i];

    const eText = eMsg.text.trim().replace(/\s+/g, " ");
    const iText = iMsg.text.trim().replace(/\s+/g, " ");

    if (eText !== iText) {
      return 0; // Text mismatch -> invalid alignment
    }

    const dirMatch = eMsg.direction === iMsg.direction || eMsg.direction === "system" || iMsg.direction === "system";
    if (!dirMatch) {
      return 0; // Direction mismatch -> invalid alignment
    }

    matches += (eMsg.direction === iMsg.direction) ? 2 : 1;
  }

  return matches;
}

export function mergeNewMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (existing.length === 0) {
    return [...incoming];
  }

  // Clone incoming messages to avoid mutating the caller's input
  const reconciledIncoming = incoming.map(msg => ({ ...msg }));

  let bestShift = null;
  let maxScore = -1;

  // Search shifts from existing.length - 1 down to -incoming.length
  for (let shift = existing.length - 1; shift >= -reconciledIncoming.length; shift--) {
    const score = getAlignmentScore(existing, reconciledIncoming, shift);
    if (score > 0 && score > maxScore) {
      maxScore = score;
      bestShift = shift;
    }
  }

  if (bestShift !== null) {
    const startIncoming = Math.max(0, -bestShift);
    const endIncoming = Math.min(reconciledIncoming.length, existing.length - bestShift);

    for (let i = startIncoming; i < endIncoming; i++) {
      const eMsg = existing[i + bestShift];
      reconciledIncoming[i].id = eMsg.id;
      if (eMsg.direction !== "system" && reconciledIncoming[i].direction === "system") {
        reconciledIncoming[i].direction = eMsg.direction;
      }
    }
  }

  const seen = new Set(existing.map((message) => message.id));
  const merged = [...existing];

  for (const message of reconciledIncoming) {
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

function closestWithin(node: HTMLElement, selector: string, boundarySelector: string): HTMLElement | null {
  try {
    const matched = node.closest<HTMLElement>(selector);
    if (!matched) return null;
    const boundary = node.closest<HTMLElement>(boundarySelector);
    if (boundary && !boundary.contains(matched)) {
      return null;
    }
    return matched;
  } catch {
    return null;
  }
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

    const parentIdNode = profile.messageListSelector ? closestWithin(node, "[data-id]", profile.messageListSelector) : node.closest<HTMLElement>("[data-id]");

    messages.push({
      id:
        node.id ||
        node.getAttribute("data-message-id") ||
        node.getAttribute("data-id") ||
        parentIdNode?.getAttribute("data-id") ||
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
  const boundary = profile.messageListSelector;

  const hasIncoming = node.matches(profile.incomingSelector) ||
    node.querySelector(profile.incomingSelector) ||
    (boundary ? closestWithin(node, profile.incomingSelector, boundary) : node.closest(profile.incomingSelector));

  if (hasIncoming) {
    return "incoming";
  }

  const hasOutgoing = node.matches(profile.outgoingSelector) ||
    node.querySelector(profile.outgoingSelector) ||
    (boundary ? closestWithin(node, profile.outgoingSelector, boundary) : node.closest(profile.outgoingSelector));

  if (hasOutgoing) {
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
