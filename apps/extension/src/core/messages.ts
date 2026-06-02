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
  if (rect.width > 0 && window.innerWidth > 0) {
    const isBubbleSized = rect.width < window.innerWidth * 0.75;
    if (isBubbleSized && rect.left < window.innerWidth * 0.5) {
      return "incoming";
    }
    if (isBubbleSized && rect.left > window.innerWidth * 0.5) {
      return "outgoing";
    }

    const center = rect.left + rect.width / 2;
    if (center > window.innerWidth * 0.58) {
      return "outgoing";
    }
    if (center < window.innerWidth * 0.42) {
      return "incoming";
    }
  }

  return "system";
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
