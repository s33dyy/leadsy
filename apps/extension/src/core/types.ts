export type MessageDirection = "incoming" | "outgoing" | "system";

export type ProfileValidationStatus = "untested" | "valid" | "invalid";

export type ApprovalState = "unapproved" | "needs_first_approval" | "approved" | "paused";

export type ResponderAction = "send" | "pause";

export interface ChatSiteProfile {
  id: string;
  siteFingerprint: string;
  messageListSelector: string;
  messageSelector: string;
  composerSelector: string;
  sendButtonSelector: string;
  incomingSelector: string;
  outgoingSelector: string;
  confidence: number;
  validationStatus: ProfileValidationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  direction: MessageDirection;
  text: string;
  timestamp: number;
  sourceUrl: string;
  raw?: Record<string, unknown>;
}

export interface ChatContact {
  displayName?: string;
  phone?: string;
  email?: string;
  handle?: string;
  profileUrl?: string;
}

export interface ConversationLog {
  chatFingerprint: string;
  profileId?: string;
  contact?: ChatContact;
  approvalState: ApprovalState;
  messages: ChatMessage[];
  lastHandledIncomingId?: string;
  lastHandledIncomingTurnKey?: string;
  lastLeadsyOutbound?: {
    normalizedText: string;
    sentAt: number;
    externalId?: string;
  };
  leadsyOutboundHistory?: Array<{
    normalizedText: string;
    sentAt: number;
    externalId?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export type ConversationSyncEventType =
  | "detected"
  | "inbound-synced"
  | "reply-generated"
  | "reply-sent"
  | "reply-paused"
  | "fallback-used"
  | "error"
  | "monitor_started"
  | "monitor_synced"
  | "monitor_stale"
  | "monitor_blocked"
  | "monitor_error";

export interface ResponderDecision {
  action: ResponderAction;
  replyText: string;
  confidence: number;
  reason: string;
  tags: string[];
  leadFields?: Record<string, string>;
  supportMetadata?: Record<string, string>;
}

export interface AssistantSettings {
  modelId: string;
  fallbackModelIds?: string[];
  fallbackBusinessPrompt: string;
  escalationRules: string[];
  requireFirstReplyApproval: boolean;
  temperature: number;
  maxTokens: number;
}

export interface KnowledgeContext {
  businessPrompt: string;
  supportNotes: string[];
  leadQualificationHints: string[];
}

export interface KnowledgeProvider {
  getContext(chat: ConversationLog, messages: ChatMessage[]): Promise<KnowledgeContext>;
}

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DomSnapshotElement {
  selector: string;
  tagName: string;
  role?: string;
  ariaLabel?: string;
  placeholder?: string;
  text?: string;
  contentEditable?: string;
}

export interface DomSnapshot {
  url: string;
  title: string;
  siteFingerprint: string;
  visibleTextSamples: string[];
  elements: DomSnapshotElement[];
}

export interface OverlayState {
  mode: "unarmed" | "detecting" | "needs_approval" | "auto_active" | "paused" | "error";
  statusText: string;
  pendingReply?: string;
  lastReason?: string;
}
