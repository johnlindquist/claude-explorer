import { Conversation, ConversationMessage } from './types';

interface IndexEntry {
  conversationId: string;
  messageId: string;
  text: string;
  textLower: string; // Pre-computed lowercase text
  timestamp: string;
}

export interface SearchResult {
  conversation: Conversation;
  matchingMessages: ConversationMessage[];
  matchCount: number;
}

export class FastProjectSearchIndex {
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
    
    // Pre-allocate arrays for better performance
    const estimatedEntries = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const allEntries: IndexEntry[] = new Array(estimatedEntries);
    let entryIndex = 0;
    
    // Store all conversations in the map
    for (const conversation of conversations) {
      this.conversationMap.set(conversation.id, conversation);
    }
    
    // Process all conversations without async overhead
    for (const conversation of conversations) {
      for (const message of conversation.messages) {
        const searchableText = this.extractSearchableText(message);
        
        if (searchableText && searchableText.length > 0) {
          allEntries[entryIndex++] = {
            conversationId: conversation.id,
            messageId: message.uuid,
            text: searchableText,
            textLower: searchableText.toLowerCase(),
            timestamp: message.timestamp
          };
        }
      }
    }
    
    // Trim array to actual size and store
    this.entries = allEntries.slice(0, entryIndex);
  }

  /**
   * Search the index and return matching conversations with their messages
   */
  search(query: string, mode: 'exact' | 'regex' = 'exact'): SearchResult[] {
    if (!query.trim()) return [];

    // Pre-process query
    const queryLower = query.toLowerCase();
    let queryTerms: string[] = [];
    
    if (mode === 'exact') {
      // For exact mode, treat the entire query as one term
      queryTerms = [queryLower.trim()];
    } else {
      // For regex mode (partial match), split into terms
      queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
    }
    
    if (queryTerms.length === 0) return [];
    
    const conversationMatches = new Map<string, Set<string>>();

    // Search through all entries
    for (const entry of this.entries) {
      let matches = false;
      
      if (mode === 'exact') {
        // For exact mode, check for exact phrase match with word boundaries
        const escapedQuery = queryTerms[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactRegex = new RegExp(`\\b${escapedQuery}\\b`, 'i');
        matches = exactRegex.test(entry.text);
      } else {
        // For regex mode, check if all query terms are present
        let allTermsFound = true;
        for (const term of queryTerms) {
          if (!entry.textLower.includes(term)) {
            allTermsFound = false;
            break;
          }
        }
        matches = allTermsFound;
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
      // Pre-allocate string array for better performance
      const textParts: string[] = [];
      
      for (const item of content) {
        if (item.type === 'text' && item.text) {
          textParts.push(item.text);
        }
      }
      
      return textParts.join(' ');
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