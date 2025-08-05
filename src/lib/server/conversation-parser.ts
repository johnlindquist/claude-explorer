import * as fsSync from 'fs';
import * as readline from 'readline';
import { Conversation, ConversationMessage } from '@/lib/types';

export async function parseConversationStream(filePath: string): Promise<Conversation> {
  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const conversationId = filePath.split('/').pop()?.replace('.jsonl', '') || '';
  let summary = null;
  const messages: ConversationMessage[] = [];
  let sideChainDepth = 0;
  let lineNumber = 0;
  let lastMessageTimestamp = new Date().toISOString();

  try {
    for await (const line of rl) {
      lineNumber++;
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      try {
        const data = JSON.parse(trimmedLine);

        // Handle summary (could be first line or multiple summary lines)
        if (data.type === 'conversation.summary' || data.type === 'summary') {
          summary = data;
          continue;
        }

        // Handle sidechain markers
        if (data.type === 'sidechain.start') {
          sideChainDepth++;
          continue;
        } else if (data.type === 'sidechain.end') {
          sideChainDepth = Math.max(0, sideChainDepth - 1);
          continue;
        }

        // Handle messages
        if (data.type === 'user' || data.type === 'assistant') {
          messages.push({
            ...data,
            isSidechain: sideChainDepth > 0
          });
          lastMessageTimestamp = data.timestamp || lastMessageTimestamp;
        } else if (data.type === 'system') {
          messages.push({
            uuid: data.uuid,
            timestamp: data.timestamp,
            type: 'system',
            content: data.content || '',
            ...(data as any)
          });
          lastMessageTimestamp = data.timestamp || lastMessageTimestamp;
        }
      } catch (e) {
        console.warn(`Error parsing line ${lineNumber} in ${filePath}:`, e);
        // Continue processing other lines
      }
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }

  // Generate summary if we don't have one
  if (!summary) {
    const firstUserMessage = messages.find(m => m.type === 'user');
    let summaryText = 'Conversation ' + conversationId.substring(0, 8);

    if (firstUserMessage) {
      const content = firstUserMessage.message?.content;
      if (typeof content === 'string' && content.trim()) {
        summaryText = content.trim().length > 50 
          ? content.trim().substring(0, 50) + '...'
          : content.trim();
      } else if (Array.isArray(content)) {
        const textContent = content.find(item => item.type === 'text' && 'text' in item);
        if (textContent && textContent.type === 'text') {
          summaryText = textContent.text.trim().length > 50 
            ? textContent.text.trim().substring(0, 50) + '...'
            : textContent.text.trim();
        }
      }
    }

    summary = {
      type: 'conversation.summary',
      summary: summaryText,
      timestamp: firstUserMessage?.timestamp || lastMessageTimestamp
    };
  }

  const conversation: Conversation = {
    id: conversationId,
    summary: summary,
    messages,
    messageCount: messages.length,
    lastUpdated: summary.timestamp || lastMessageTimestamp,
    projectId: '' // Will be set by the caller
  };

  return conversation;
}

// Helper function to extract text content from a message
export function extractMessageText(data: any): string {
  if (data.type === 'system' && data.content) {
    return data.content;
  } else if (data.message?.content) {
    if (typeof data.message.content === 'string') {
      return data.message.content;
    } else if (Array.isArray(data.message.content)) {
      return data.message.content
        .filter((item: any) => item.type === 'text' && item.text)
        .map((item: any) => item.text)
        .join(' ');
    }
  }
  return '';
}

// Helper function to parse a single line for quick operations
export function parseLine(line: string): any | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) return null;
  
  try {
    return JSON.parse(trimmedLine);
  } catch {
    return null;
  }
}