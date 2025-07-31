import { ConversationMessage } from './types';

// Use dynamic import to avoid build issues
let FlexSearchIndex: any;
if (typeof window !== 'undefined') {
  // @ts-ignore
  FlexSearchIndex = require('flexsearch').Index;
}

export class ConversationSearchIndex {
  private index: any;
  private messageMap: Map<string, ConversationMessage> = new Map();
  
  constructor() {
    if (!FlexSearchIndex) {
      throw new Error('FlexSearch not available');
    }
    
    // Initialize FlexSearch with basic settings to avoid encoder issues
    this.index = new FlexSearchIndex({
      tokenize: 'forward',
      // Use simple encoder to avoid issues
      encoder: 'simple',
      threshold: 0,
      resolution: 9
    });
  }

  /**
   * Build the search index from conversation messages
   */
  async buildIndex(messages: ConversationMessage[]): Promise<void> {
    // Clear existing index
    this.messageMap.clear();
    
    // Index each message
    messages.forEach((message, index) => {
      const searchableText = this.extractSearchableText(message);
      
      if (searchableText) {
        // Use the message UUID as the document ID
        this.index.add(index, searchableText);
        this.messageMap.set(index.toString(), message);
      }
    });
  }

  /**
   * Search the index and return matching messages
   */
  search(query: string): ConversationMessage[] {
    if (!query.trim()) return [];

    // Perform search
    const results = this.index.search(query, {
      limit: 1000, // Return all matches
      suggest: false
    });

    // Convert results to messages
    const messages: ConversationMessage[] = [];
    if (Array.isArray(results)) {
      results.forEach(id => {
        const message = this.messageMap.get(id.toString());
        if (message) {
          messages.push(message);
        }
      });
    }

    return messages;
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
    this.messageMap.clear();
    // Create a new index instance to clear all data
    if (FlexSearchIndex) {
      this.index = new FlexSearchIndex({
        tokenize: 'forward',
        encoder: 'simple',
        threshold: 0,
        resolution: 9
      });
    }
  }
}