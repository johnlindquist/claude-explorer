import { ConversationMessage } from './types';

interface IndexEntry {
  messageId: string;
  text: string;
  tokens: Set<string>;
}

export class SimpleSearchIndex {
  private entries: IndexEntry[] = [];
  private messageMap: Map<string, ConversationMessage> = new Map();
  
  constructor() {}

  /**
   * Build the search index from conversation messages
   */
  async buildIndex(messages: ConversationMessage[]): Promise<void> {
    // Clear existing index
    this.entries = [];
    this.messageMap.clear();
    
    // Index each message
    messages.forEach((message) => {
      const searchableText = this.extractSearchableText(message);
      
      if (searchableText) {
        const tokens = this.tokenize(searchableText);
        this.entries.push({
          messageId: message.uuid,
          text: searchableText,
          tokens
        });
        this.messageMap.set(message.uuid, message);
      }
    });
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
   * Search the index and return matching messages
   */
  search(query: string): ConversationMessage[] {
    if (!query.trim()) return [];

    const queryTokens = this.tokenize(query);
    const results: ConversationMessage[] = [];
    const seen = new Set<string>();

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
      
      if (matches && !seen.has(entry.messageId)) {
        const message = this.messageMap.get(entry.messageId);
        if (message) {
          results.push(message);
          seen.add(entry.messageId);
        }
      }
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
    this.messageMap.clear();
  }
}