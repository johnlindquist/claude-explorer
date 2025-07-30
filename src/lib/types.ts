export interface ConversationSummary {
  type: "summary";
  summary: string;
  leafUuid: string;
}

export interface ToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: any;
}

export interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface TextContent {
  type: "text";
  text: string;
}

export type MessageContent = string | Array<TextContent | ToolUse | ToolResult>;

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
    content: MessageContent;
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
  toolUseResult?: any;
}

export type ConversationEntry = ConversationSummary | ConversationMessage;

export interface Conversation {
  id: string;
  summary: ConversationSummary;
  messages: ConversationMessage[];
  lastUpdated: string;
  messageCount: number;
}