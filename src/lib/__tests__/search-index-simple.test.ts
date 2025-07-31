import { SimpleSearchIndex } from '../search-index-simple';
import { ConversationMessage } from '../types';

describe('SimpleSearchIndex', () => {
  let searchIndex: SimpleSearchIndex;
  
  beforeEach(() => {
    searchIndex = new SimpleSearchIndex();
  });

  const createMessage = (uuid: string, content: string, type: 'user' | 'assistant' | 'system' = 'user'): ConversationMessage => ({
    uuid,
    timestamp: new Date().toISOString(),
    type,
    parentUuid: null,
    isSidechain: false,
    userType: 'test',
    cwd: '/test',
    sessionId: 'test',
    version: '1.0',
    gitBranch: 'main',
    ...(type === 'system' 
      ? { content }
      : {
          message: {
            role: type as 'user' | 'assistant',
            content
          }
        }
    )
  });

  const createMessageWithTextContent = (uuid: string, text: string): ConversationMessage => ({
    uuid,
    timestamp: new Date().toISOString(),
    type: 'assistant',
    parentUuid: null,
    isSidechain: false,
    userType: 'test',
    cwd: '/test',
    sessionId: 'test',
    version: '1.0',
    gitBranch: 'main',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text }
      ]
    }
  });

  describe('buildIndex', () => {
    it('should build index from messages', async () => {
      const messages = [
        createMessage('1', 'Hello world'),
        createMessage('2', 'Testing search functionality'),
        createMessage('3', 'Another test message', 'system')
      ];

      await searchIndex.buildIndex(messages);
      
      // Test that messages are indexed
      const results = searchIndex.search('test');
      expect(results).toHaveLength(2);
      expect(results.map(r => r.uuid)).toContain('2');
      expect(results.map(r => r.uuid)).toContain('3');
    });

    it('should handle array content with text blocks', async () => {
      const messages = [
        createMessageWithTextContent('1', 'This is a text block'),
        createMessageWithTextContent('2', 'Another text block with search term')
      ];

      await searchIndex.buildIndex(messages);
      
      const results = searchIndex.search('search');
      expect(results).toHaveLength(1);
      expect(results[0].uuid).toBe('2');
    });

    it('should clear previous index when rebuilding', async () => {
      const messages1 = [createMessage('1', 'First set of messages')];
      const messages2 = [createMessage('2', 'Second set of messages')];

      await searchIndex.buildIndex(messages1);
      await searchIndex.buildIndex(messages2);
      
      const results = searchIndex.search('first');
      expect(results).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const messages = [
        createMessage('1', 'The quick brown fox jumps over the lazy dog'),
        createMessage('2', 'JavaScript and TypeScript are programming languages'),
        createMessage('3', 'React is a JavaScript library for building user interfaces'),
        createMessage('4', 'System message about errors', 'system'),
        createMessageWithTextContent('5', 'Claude is an AI assistant')
      ];
      await searchIndex.buildIndex(messages);
    });

    it('should find messages with exact matches', () => {
      const results = searchIndex.search('JavaScript');
      expect(results).toHaveLength(2);
      expect(results.map(r => r.uuid)).toContain('2');
      expect(results.map(r => r.uuid)).toContain('3');
    });

    it('should be case insensitive', () => {
      const results1 = searchIndex.search('javascript');
      const results2 = searchIndex.search('JAVASCRIPT');
      const results3 = searchIndex.search('JavaScript');
      
      expect(results1).toHaveLength(2);
      expect(results2).toHaveLength(2);
      expect(results3).toHaveLength(2);
    });

    it('should handle partial matches', () => {
      const results = searchIndex.search('Java');
      expect(results).toHaveLength(2);
    });

    it('should handle multiple search terms', () => {
      const results = searchIndex.search('JavaScript library');
      expect(results).toHaveLength(1);
      expect(results[0].uuid).toBe('3');
    });

    it('should return empty array for no matches', () => {
      const results = searchIndex.search('Python');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', () => {
      const results = searchIndex.search('');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for whitespace query', () => {
      const results = searchIndex.search('   ');
      expect(results).toHaveLength(0);
    });

    it('should find system messages', () => {
      const results = searchIndex.search('errors');
      expect(results).toHaveLength(1);
      expect(results[0].uuid).toBe('4');
    });

    it('should not return duplicate results', () => {
      const results = searchIndex.search('the');
      const uuids = results.map(r => r.uuid);
      const uniqueUuids = new Set(uuids);
      expect(uuids.length).toBe(uniqueUuids.size);
    });
  });

  describe('clear', () => {
    it('should clear all indexed data', async () => {
      const messages = [
        createMessage('1', 'Test message'),
        createMessage('2', 'Another test')
      ];

      await searchIndex.buildIndex(messages);
      searchIndex.clear();
      
      const results = searchIndex.search('test');
      expect(results).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle messages without content', async () => {
      const messages = [
        {
          ...createMessage('1', ''),
          message: undefined
        } as ConversationMessage
      ];

      await searchIndex.buildIndex(messages);
      const results = searchIndex.search('test');
      expect(results).toHaveLength(0);
    });

    it('should handle empty message array', async () => {
      await searchIndex.buildIndex([]);
      const results = searchIndex.search('test');
      expect(results).toHaveLength(0);
    });

    it('should handle special characters in search', () => {
      const results = searchIndex.search('!@#$%');
      expect(results).toHaveLength(0);
    });
  });
});