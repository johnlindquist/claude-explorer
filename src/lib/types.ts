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

export interface ThinkingContent {
  type: "thinking";
  content: string;
}

export type MessageContent = string | Array<TextContent | ToolUse | ToolResult | ThinkingContent>;

export interface ConversationMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  type: "user" | "assistant" | "system";
  message?: {
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
  content?: string; // For system messages
  isMeta?: boolean;
  level?: string;
  uuid: string;
  timestamp: string;
  requestId?: string;
  toolUseResult?: any;
  toolUseID?: string;
}

export type ConversationEntry = ConversationSummary | ConversationMessage;

export interface Conversation {
  id: string;
  summary: ConversationSummary;
  messages: ConversationMessage[];
  lastUpdated: string;
  messageCount: number;
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  conversationCount?: number;
  lastModified?: string;
}