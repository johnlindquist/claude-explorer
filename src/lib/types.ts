export interface ConversationSummary {
  type: "summary";
  summary: string;
  leafUuid: string;
}

export interface ConversationMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  type: "user" | "assistant";
  message: {
    role: "user" | "assistant";
    content: string | Array<{ type: string; text: string }>;
    id?: string;
    model?: string;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
      service_tier: string;
    };
  };
  uuid: string;
  timestamp: string;
  requestId?: string;
}

export type ConversationEntry = ConversationSummary | ConversationMessage;

export interface Conversation {
  id: string;
  summary: ConversationSummary;
  messages: ConversationMessage[];
  lastUpdated: string;
  messageCount: number;
}