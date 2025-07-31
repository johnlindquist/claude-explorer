import { Conversation, ConversationMessage } from './types';

interface IndexEntry {
  conversationId: string;
  messageId: string;
  text: string;
  tokens: Set<string>;
  timestamp: string;
}

export interface SearchResult {
  conversation: Conversation;
  matchingMessages: ConversationMessage[];
  matchCount: number;
}

export class ProjectSearchIndex {
  private entries: IndexEntry[] = [];
  private conversationMap: Map<string, Conversation> = new Map();
  
  constructor() {}

  /**
   * Build the search index from multiple conversations
   */
  async buildIndex(conversations: Conversation[]): Promise<void> {
    // Clear existing index
    this.entries = [];
    this.conversationMap.clear();
    
    // Index each conversation
    for (const conversation of conversations) {
      this.conversationMap.set(conversation.id, conversation);
      
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
   * Search the index and return matching conversations with their messages
   */
  search(query: string): SearchResult[] {
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
      const conversation = this.conversationMap.get(conversationId);
      if (!conversation) continue;
      
      const matchingMessages = conversation.messages.filter(
        msg => messageIds.has(msg.uuid)
      );
      
      results.push({
        conversation,
        matchingMessages,
        matchCount: matchingMessages.length
      });
    }
    
    // Sort by match count (descending) and then by last updated
    results.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return new Date(b.conversation.lastUpdated).getTime() - 
             new Date(a.conversation.lastUpdated).getTime();
    });
    
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
   * Get statistics about the index
   */
  getStats() {
    return {
      totalConversations: this.conversationMap.size,
      totalMessages: this.entries.length,
      indexSize: this.entries.reduce((sum, entry) => sum + entry.text.length, 0)
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.entries = [];
    this.conversationMap.clear();
  }
}