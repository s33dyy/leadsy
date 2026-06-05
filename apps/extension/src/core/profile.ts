import type {
  ChatContact,
  ChatMessage,
  ChatSiteProfile,
  DomSnapshot,
  DomSnapshotElement,
  ProfileValidationResult
} from "./types";

const MIN_PROFILE_CONFIDENCE = 0.6;

export function validateChatSiteProfile(
  profile: ChatSiteProfile,
  root: Document | ParentNode = document,
  options: { requireSendButton?: boolean } = {}
): ProfileValidationResult {
  const errors: string[] = [];
  const requireSendButton = options.requireSendButton ?? true;

  validateSelector(root, "messageListSelector", profile.messageListSelector, errors);
  validateSelector(root, "messageSelector", profile.messageSelector, errors);
  validateSelector(root, "composerSelector", profile.composerSelector, errors);
  if (requireSendButton) {
    validateSelector(root, "sendButtonSelector", profile.sendButtonSelector, errors);
  } else {
    validateSelectorSyntax("sendButtonSelector", profile.sendButtonSelector, errors);
  }
  validateDirectionSelector(root, "incomingSelector", profile.incomingSelector, errors);
  validateDirectionSelector(root, "outgoingSelector", profile.outgoingSelector, errors);

  if (profile.confidence < MIN_PROFILE_CONFIDENCE) {
    errors.push(`confidence must be at least ${MIN_PROFILE_CONFIDENCE}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createSiteFingerprint(locationLike: Pick<Location, "origin" | "pathname">): string {
  const stablePath = locationLike.pathname.replace(/\/+$/, "") || "/";
  return `${locationLike.origin}${stablePath}`;
}

export function collectDomSnapshot(doc: Document = document): DomSnapshot {
  const elements = Array.from(
    doc.querySelectorAll<HTMLElement>(
      "main,section,article,[role],button,input,textarea,[contenteditable],a,[aria-label],[placeholder]"
    )
  )
    .filter(isElementVisible)
    .slice(0, 90)
    .map(toSnapshotElement);

  const visibleTextSamples = Array.from(doc.body.querySelectorAll<HTMLElement>("p,span,div,li"))
    .filter(isElementVisible)
    .map((element) => normalizedText(element.innerText || element.textContent || ""))
    .filter(Boolean)
    .slice(0, 40);

  return {
    url: doc.location.href,
    title: doc.title,
    siteFingerprint: createSiteFingerprint(doc.location),
    visibleTextSamples,
    elements
  };
}

export function normalizeProfileFromAi(
  value: Partial<ChatSiteProfile>,
  siteFingerprint: string,
  now = Date.now()
): ChatSiteProfile {
  return {
    id: value.id || `${siteFingerprint}:${now}`,
    siteFingerprint,
    messageListSelector: value.messageListSelector || "",
    messageSelector: value.messageSelector || "",
    composerSelector: value.composerSelector || "",
    sendButtonSelector: value.sendButtonSelector || "",
    incomingSelector: value.incomingSelector || "",
    outgoingSelector: value.outgoingSelector || "",
    confidence: Number(value.confidence || 0),
    validationStatus: value.validationStatus || "untested",
    createdAt: value.createdAt || now,
    updatedAt: now
  };
}

export function detectLocalChatProfile(
  doc: Document = document,
  siteFingerprint = createSiteFingerprint(doc.location),
  now = Date.now()
): ChatSiteProfile | undefined {
  const candidates: Array<
    Pick<
      ChatSiteProfile,
      | "messageListSelector"
      | "messageSelector"
      | "composerSelector"
      | "sendButtonSelector"
      | "incomingSelector"
      | "outgoingSelector"
    >
  > = [
    {
      messageListSelector: "#main",
      messageSelector: "[data-id]",
      composerSelector: '[contenteditable="true"][role="textbox"]',
      sendButtonSelector: '[aria-label="Send"]',
      incomingSelector: ".message-in",
      outgoingSelector: ".message-out"
    },
    {
      messageListSelector: "[data-message-list]",
      messageSelector: "[data-message]",
      composerSelector: "[data-composer]",
      sendButtonSelector: "[data-send]",
      incomingSelector: '[data-direction="incoming"]',
      outgoingSelector: '[data-direction="outgoing"]'
    },
    {
      messageListSelector: 'main [role="grid"], main [role="log"], main',
      messageSelector: '[role="row"], [dir="auto"]',
      composerSelector: 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label*="Message" i]',
      sendButtonSelector: 'button[type="submit"], [role="button"][aria-label*="Send" i], div[role="button"]',
      incomingSelector: '[data-direction="incoming"], .incoming, [data-testid*="incoming" i]',
      outgoingSelector: '[data-direction="outgoing"], .outgoing, [data-testid*="outgoing" i], [aria-label*="sent" i]'
    },
    {
      messageListSelector: "main",
      messageSelector: ".message-in, .message-out, [data-id]",
      composerSelector: '[contenteditable="true"]',
      sendButtonSelector: 'button[aria-label="Send"], [role="button"][aria-label="Send"]',
      incomingSelector: ".message-in",
      outgoingSelector: ".message-out"
    }
  ];

  for (const candidate of candidates) {
    const profile: ChatSiteProfile = {
      id: `local:${siteFingerprint}:${now}`,
      siteFingerprint,
      ...candidate,
      confidence: 0.75,
      validationStatus: "untested",
      createdAt: now,
      updatedAt: now
    };
    const validation = validateChatSiteProfile(profile, doc, { requireSendButton: false });
    if (validation.valid) {
      return {
        ...profile,
        validationStatus: "valid"
      };
    }
  }

  return undefined;
}

export function extractChatContact(doc: Document = document, platform = platformFromUrl(doc.location?.href || "")): ChatContact | undefined {
  if (platform === "whatsapp-web") {
    const displayName = firstUsefulText(doc, [
      "#main header span[title]",
      "#main header [title]",
      "header span[title]",
      "header [data-testid='conversation-info-header-chat-title']",
      "header [dir='auto']",
      "#main [data-testid='conversation-info-header'] [dir='auto']"
    ]);
    if (displayName) {
      const phone = phoneFromText(displayName);
      return cleanContact({
        displayName,
        phone: phone && phone === displayName.replace(/\D/g, "") ? phone : undefined
      });
    }
  }

  return undefined;
}

function validateSelectorSyntax(
  fieldName: keyof Pick<ChatSiteProfile, "sendButtonSelector">,
  selector: string,
  errors: string[]
): void {
  if (!selector.trim()) {
    errors.push(`${fieldName} is required`);
    return;
  }

  try {
    document.createDocumentFragment().querySelector(selector);
  } catch {
    errors.push(`${fieldName} is not a valid selector`);
  }
}

export function buildProfileDetectionPrompt(snapshot: DomSnapshot, messages: ChatMessage[]): string {
  return JSON.stringify(
    {
      task:
        "Identify selectors for a generic web chat. Return only JSON matching ChatSiteProfile fields. Prefer stable data attributes, roles, aria labels, and compact selectors.",
      requiredFields: [
        "messageListSelector",
        "messageSelector",
        "composerSelector",
        "sendButtonSelector",
        "incomingSelector",
        "outgoingSelector",
        "confidence"
      ],
      snapshot,
      recentMessages: messages.slice(-12)
    },
    null,
    2
  );
}

function validateDirectionSelector(
  root: Document | ParentNode,
  fieldName: "incomingSelector" | "outgoingSelector",
  selector: string,
  errors: string[]
): void {
  if (!selector.trim()) {
    errors.push(`${fieldName} is required`);
    return;
  }

  try {
    root.querySelector(selector);
  } catch {
    errors.push(`${fieldName} is not a valid selector`);
  }
}

function validateSelector(
  root: Document | ParentNode,
  fieldName: keyof Pick<
    ChatSiteProfile,
    | "messageListSelector"
    | "messageSelector"
    | "composerSelector"
    | "sendButtonSelector"
    | "incomingSelector"
    | "outgoingSelector"
  >,
  selector: string,
  errors: string[]
): void {
  if (!selector.trim()) {
    errors.push(`${fieldName} is required`);
    return;
  }

  try {
    if (!root.querySelector(selector)) {
      errors.push(`${fieldName} did not match any elements`);
    }
  } catch {
    errors.push(`${fieldName} is not a valid selector`);
  }
}

function firstUsefulText(doc: Document, selectors: string[]) {
  for (const selector of selectors) {
    let nodes: HTMLElement[] = [];
    try {
      nodes = Array.from(doc.querySelectorAll<HTMLElement>(selector));
    } catch {
      continue;
    }

    for (const node of nodes) {
      const text = normalizedText(node.getAttribute("title") || node.innerText || node.textContent || "");
      if (isUsefulContactText(text)) return text;
    }
  }
  return undefined;
}

function cleanContact(contact: ChatContact): ChatContact | undefined {
  const cleaned: ChatContact = {
    displayName: contact.displayName?.trim() || undefined,
    phone: contact.phone?.trim() || undefined,
    email: contact.email?.trim() || undefined,
    handle: contact.handle?.trim() || undefined,
    profileUrl: contact.profileUrl?.trim() || undefined
  };
  return Object.values(cleaned).some(Boolean) ? cleaned : undefined;
}

function isUsefulContactText(value: string) {
  if (!value || value.length > 160) return false;
  const normalized = value.toLowerCase();
  return ![
    "search",
    "menu",
    "more options",
    "type a message",
    "message",
    "online",
    "typing",
    "click here to update"
  ].some((blocked) => normalized === blocked || normalized.includes(` ${blocked}`));
}

function phoneFromText(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : undefined;
}

function platformFromUrl(value: string) {
  if (/web\.whatsapp\.com/i.test(value)) return "whatsapp-web";
  if (/instagram\.com/i.test(value)) return "instagram-web";
  if (/facebook\.com|messenger\.com/i.test(value)) return "facebook-web";
  return "generic-web-chat";
}

function toSnapshotElement(element: HTMLElement): DomSnapshotElement {
  return {
    selector: selectorForElement(element),
    tagName: element.tagName.toLowerCase(),
    role: element.getAttribute("role") || undefined,
    ariaLabel: element.getAttribute("aria-label") || undefined,
    placeholder: element.getAttribute("placeholder") || undefined,
    text: normalizedText(element.innerText || element.textContent || "").slice(0, 160) || undefined,
    contentEditable: element.getAttribute("contenteditable") || undefined
  };
}

function selectorForElement(element: HTMLElement): string {
  if (element.id) {
    return `#${escapeCssValue(element.id)}`;
  }

  const dataAttribute = Array.from(element.attributes).find((attribute) =>
    attribute.name.startsWith("data-")
  );
  if (dataAttribute) {
    return `${element.tagName.toLowerCase()}[${dataAttribute.name}="${escapeCssValue(dataAttribute.value)}"]`;
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return `${element.tagName.toLowerCase()}[aria-label="${escapeCssValue(ariaLabel)}"]`;
  }

  return element.tagName.toLowerCase();
}

function escapeCssValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/#/g, "\\#");
}

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width >= 0 && rect.height >= 0 && style.display !== "none" && style.visibility !== "hidden";
}
