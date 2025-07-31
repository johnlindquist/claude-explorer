import { ProjectSearchIndex } from '../project-search-index';
import { Conversation, ConversationMessage } from '../types';

describe('ProjectSearchIndex', () => {
  let searchIndex: ProjectSearchIndex;
  
  beforeEach(() => {
    searchIndex = new ProjectSearchIndex();
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

  const createConversation = (id: string, messages: ConversationMessage[]): Conversation => ({
    id,
    summary: {
      type: 'summary',
      summary: `Conversation ${id}`,
      leafUuid: ''
    },
    messages,
    lastUpdated: new Date().toISOString(),
    messageCount: messages.length
  });

  describe('buildIndex', () => {
    it('should build index from multiple conversations', async () => {
      const conversations = [
        createConversation('conv1', [
          createMessage('1-1', 'Hello from conversation one'),
          createMessage('1-2', 'Testing search functionality')
        ]),
        createConversation('conv2', [
          createMessage('2-1', 'Hello from conversation two'),
          createMessage('2-2', 'Another test message')
        ])
      ];

      await searchIndex.buildIndex(conversations);
      
      const stats = searchIndex.getStats();
      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(4);
    });

    it('should clear previous index when rebuilding', async () => {
      const conversations1 = [
        createConversation('conv1', [createMessage('1-1', 'First set')])
      ];
      const conversations2 = [
        createConversation('conv2', [createMessage('2-1', 'Second set')])
      ];

      await searchIndex.buildIndex(conversations1);
      await searchIndex.buildIndex(conversations2);
      
      const results = searchIndex.search('first');
      expect(results).toHaveLength(0);
      
      const stats = searchIndex.getStats();
      expect(stats.totalConversations).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const conversations = [
        createConversation('conv1', [
          createMessage('1-1', 'JavaScript is a programming language'),
          createMessage('1-2', 'React is a JavaScript library'),
          createMessage('1-3', 'TypeScript extends JavaScript')
        ]),
        createConversation('conv2', [
          createMessage('2-1', 'Python is also a programming language'),
          createMessage('2-2', 'Django is a Python framework')
        ]),
        createConversation('conv3', [
          createMessage('3-1', 'Rust is a systems programming language'),
          createMessage('3-2', 'Memory safety in Rust')
        ])
      ];
      await searchIndex.buildIndex(conversations);
    });

    it('should find conversations with matching messages', () => {
      const results = searchIndex.search('JavaScript');
      expect(results).toHaveLength(1);
      expect(results[0].conversation.id).toBe('conv1');
      expect(results[0].matchCount).toBe(3);
      expect(results[0].matchingMessages).toHaveLength(3);
    });

    it('should find multiple conversations', () => {
      const results = searchIndex.search('programming language');
      expect(results).toHaveLength(3);
      
      // Should be sorted by match count
      expect(results[0].conversation.id).toBe('conv1');
      expect(results[0].matchCount).toBe(1);
    });

    it('should be case insensitive', () => {
      const results1 = searchIndex.search('javascript');
      const results2 = searchIndex.search('JAVASCRIPT');
      
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].conversation.id).toBe(results2[0].conversation.id);
    });

    it('should return empty array for no matches', () => {
      const results = searchIndex.search('Ruby');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', () => {
      const results = searchIndex.search('');
      expect(results).toHaveLength(0);
    });

    it('should sort results by match count', () => {
      const results = searchIndex.search('language');
      expect(results).toHaveLength(3);
      
      // conv1 has 'language' in 3 messages
      // conv2 has 'language' in 1 message
      // conv3 has 'language' in 1 message
      expect(results[0].matchCount).toBeGreaterThanOrEqual(results[1].matchCount);
      expect(results[1].matchCount).toBeGreaterThanOrEqual(results[2].matchCount);
    });

    it('should include matching messages in results', () => {
      const results = searchIndex.search('React');
      expect(results).toHaveLength(1);
      
      const result = results[0];
      expect(result.matchingMessages).toHaveLength(1);
      expect(result.matchingMessages[0].uuid).toBe('1-2');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const conversations = [
        createConversation('conv1', [
          createMessage('1-1', 'Message 1'),
          createMessage('1-2', 'Message 2')
        ]),
        createConversation('conv2', [
          createMessage('2-1', 'Message 3')
        ])
      ];

      await searchIndex.buildIndex(conversations);
      
      const stats = searchIndex.getStats();
      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.indexSize).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all indexed data', async () => {
      const conversations = [
        createConversation('conv1', [createMessage('1-1', 'Test message')])
      ];

      await searchIndex.buildIndex(conversations);
      searchIndex.clear();
      
      const results = searchIndex.search('test');
      expect(results).toHaveLength(0);
      
      const stats = searchIndex.getStats();
      expect(stats.totalConversations).toBe(0);
      expect(stats.totalMessages).toBe(0);
    });
  });
});