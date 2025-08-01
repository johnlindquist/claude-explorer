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
    
    // Process conversations in parallel batches
    const BATCH_SIZE = 50; // Process 50 conversations at a time
    const batches: Conversation[][] = [];
    
    for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
      batches.push(conversations.slice(i, i + BATCH_SIZE));
    }
    
    // Process each batch in parallel
    const batchResults = await Promise.all(
      batches.map(batch => this.processBatch(batch))
    );
    
    // Merge results from all batches
    for (const { entries, conversationMap } of batchResults) {
      this.entries.push(...entries);
      for (const [id, conversation] of conversationMap) {
        this.conversationMap.set(id, conversation);
      }
    }
  }
  
  /**
   * Process a batch of conversations in parallel
   */
  private async processBatch(conversations: Conversation[]): Promise<{
    entries: IndexEntry[];
    conversationMap: Map<string, Conversation>;
  }> {
    const entries: IndexEntry[] = [];
    const conversationMap = new Map<string, Conversation>();
    
    // Process conversations in this batch in parallel
    await Promise.all(conversations.map(async (conversation) => {
      conversationMap.set(conversation.id, conversation);
      
      // Process messages for this conversation
      const conversationEntries = await this.processConversation(conversation);
      entries.push(...conversationEntries);
    }));
    
    return { entries, conversationMap };
  }
  
  /**
   * Process a single conversation's messages
   */
  private async processConversation(conversation: Conversation): Promise<IndexEntry[]> {
    const entries: IndexEntry[] = [];
    
    // Process messages in chunks to avoid blocking
    const CHUNK_SIZE = 100;
    for (let i = 0; i < conversation.messages.length; i += CHUNK_SIZE) {
      const chunk = conversation.messages.slice(i, i + CHUNK_SIZE);
      
      for (const message of chunk) {
        const searchableText = this.extractSearchableText(message);
        
        if (searchableText) {
          const tokens = this.tokenize(searchableText);
          entries.push({
            conversationId: conversation.id,
            messageId: message.uuid,
            text: searchableText,
            tokens,
            timestamp: message.timestamp
          });
        }
      }
      
      // Yield to event loop every chunk
      if (i + CHUNK_SIZE < conversation.messages.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return entries;
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