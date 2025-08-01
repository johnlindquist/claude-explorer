import { Conversation, ConversationMessage } from './types';

interface IndexEntry {
  conversationId: string;
  messageId: string;
  text: string;
  tokens: Set<string>;
  timestamp: string;
}

export interface SearchResult {
  conversationId: string;
  matchingMessageIds: Set<string>;
  matchCount: number;
}

export class OptimizedProjectSearchIndex {
  private entries: IndexEntry[] = [];
  
  constructor() {}

  /**
   * Build the search index from multiple conversations
   */
  async buildIndex(conversations: Conversation[]): Promise<void> {
    // Clear existing index
    this.entries = [];
    
    // Index each conversation
    for (const conversation of conversations) {
      // Index each message in the conversation
      for (const message of conversation.messages) {
        const searchableText = this.extractSearchableText(message);
        
        if (searchableText) {
          const tokens = this.tokenize(searchableText);
          this.entries.push({
            conversationId: conversation.id,
            messageId: message.uuid,
            text: searchableText,
            tokens,
            timestamp: message.timestamp
          });
        }
      }
    }
  }

  /**
   * Tokenize text into searchable tokens
   */
  private tokenize(text: string): Set<string> {
    // Convert to lowercase and split by word boundaries
    const tokens = text.toLowerCase()
      .split(/\b/)
      .filter(token => token.trim().length > 0)
      .filter(token => /\w/.test(token)); // Keep only tokens with word characters
    
    return new Set(tokens);
  }

  /**
   * Search the index and return matching conversation IDs with message IDs
   */
  searchForIds(query: string): SearchResult[] {
    if (!query.trim()) return [];

    const queryTokens = this.tokenize(query);
    const conversationMatches = new Map<string, Set<string>>();

    // Search through all entries
    for (const entry of this.entries) {
      let matches = true;
      
      // Check if all query tokens are present
      for (const queryToken of queryTokens) {
        let found = false;
        for (const entryToken of entry.tokens) {
          if (entryToken.includes(queryToken)) {
            found = true;
            break;
          }
        }
        if (!found) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        if (!conversationMatches.has(entry.conversationId)) {
          conversationMatches.set(entry.conversationId, new Set());
        }
        conversationMatches.get(entry.conversationId)!.add(entry.messageId);
      }
    }

    // Build results
    const results: SearchResult[] = [];
    
    for (const [conversationId, messageIds] of conversationMatches) {
      results.push({
        conversationId,
        matchingMessageIds: messageIds,
        matchCount: messageIds.size
      });
    }
    
    return results;
  }

  /**
   * Extract searchable text from a message
   */
  private extractSearchableText(message: ConversationMessage): string {
    if (!message.message?.content) {
      // For system messages
      if (message.type === 'system' && message.content) {
        return message.content;
      }
      return '';
    }

    const content = message.message.content;
    
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (item.type === 'text') {
            return item.text;
          }
          return '';
        })
        .join(' ');
    }
    
    return '';
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.entries = [];
  }
}