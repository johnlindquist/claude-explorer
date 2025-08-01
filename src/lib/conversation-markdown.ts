import { Conversation, ConversationMessage } from './types';

/**
 * Convert a conversation to clean Markdown format
 */
export function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [];
  
  // Add title
  lines.push(`# ${conversation.summary.summary}`);
  lines.push('');
  lines.push(`*Date: ${new Date(conversation.lastUpdated).toLocaleString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Process each message
  for (const message of conversation.messages) {
    // Skip sidechain messages if desired (or mark them specially)
    const sidechainPrefix = message.isSidechain ? '[Sidechain] ' : '';
    
    if (message.type === 'user') {
      lines.push(`## ${sidechainPrefix}User`);
      lines.push('');
      lines.push(formatMessageContent(message));
      lines.push('');
    } else if (message.type === 'assistant') {
      lines.push(`## ${sidechainPrefix}Assistant`);
      if (message.message?.model) {
        lines.push(`*Model: ${message.message.model}*`);
        lines.push('');
      }
      lines.push(formatMessageContent(message));
      lines.push('');
    } else if (message.type === 'system') {
      lines.push(`## System`);
      lines.push('');
      lines.push(`> ${message.content || '[System message]'}`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Format message content including tool calls
 */
function formatMessageContent(message: ConversationMessage): string {
  const content = message.message?.content || message.content;
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    const parts: string[] = [];
    
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        parts.push(item.text);
      } else if (item.type === 'thinking' && item.thinking) {
        parts.push('### 🧠 Thinking');
        parts.push('');
        parts.push('```');
        parts.push(item.thinking);
        parts.push('```');
        parts.push('');
      } else if (item.type === 'tool_use') {
        parts.push(`### 🔧 Tool Use: ${item.name}`);
        parts.push('');
        
        // Format tool parameters
        if (item.input) {
          parts.push('**Parameters:**');
          parts.push('```json');
          parts.push(JSON.stringify(item.input, null, 2));
          parts.push('```');
          parts.push('');
        }
      } else if (item.type === 'tool_result') {
        if (item.is_error) {
          parts.push('### ❌ Tool Error');
        } else {
          parts.push('### ✅ Tool Result');
        }
        
        if (item.content) {
          parts.push('');
          parts.push('```');
          // Truncate very long results
          const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
          if (content.length > 1000) {
            parts.push(content.substring(0, 1000));
            parts.push('... [truncated]');
          } else {
            parts.push(content);
          }
          parts.push('```');
        }
        parts.push('');
      }
    }
    
    return parts.join('\n');
  }
  
  return '[No content]';
}

/**
 * Convert a conversation to simplified Markdown (without tool results)
 */
export function conversationToSimpleMarkdown(conversation: Conversation): string {
  const lines: string[] = [];
  
  // Add title
  lines.push(`# ${conversation.summary.summary}`);
  lines.push('');
  lines.push(`*Date: ${new Date(conversation.lastUpdated).toLocaleString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Process each message
  for (const message of conversation.messages) {
    // Skip tool result messages from user
    if (message.type === 'user' && message.message?.content && Array.isArray(message.message.content)) {
      const hasOnlyToolResults = message.message.content.every(item => item.type === 'tool_result');
      if (hasOnlyToolResults) continue;
    }
    
    const sidechainPrefix = message.isSidechain ? '[Sidechain] ' : '';
    
    if (message.type === 'user') {
      lines.push(`## ${sidechainPrefix}User`);
      lines.push('');
      lines.push(formatSimpleMessageContent(message));
      lines.push('');
    } else if (message.type === 'assistant') {
      lines.push(`## ${sidechainPrefix}Assistant`);
      lines.push('');
      lines.push(formatSimpleMessageContent(message));
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Format message content for simple markdown (tool calls as brief mentions)
 */
function formatSimpleMessageContent(message: ConversationMessage): string {
  const content = message.message?.content || message.content;
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    const parts: string[] = [];
    let hasText = false;
    const toolCalls: string[] = [];
    
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        parts.push(item.text);
        hasText = true;
      } else if (item.type === 'thinking' && item.thinking) {
        parts.push('*[Thinking...]*');
      } else if (item.type === 'tool_use') {
        toolCalls.push(item.name);
      }
    }
    
    // Add tool calls summary at the end if there were any
    if (toolCalls.length > 0) {
      if (hasText) parts.push('');
      parts.push(`*[Used tools: ${toolCalls.join(', ')}]*`);
    }
    
    return parts.join('\n');
  }
  
  return '[No content]';
}