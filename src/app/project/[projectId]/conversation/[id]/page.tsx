"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Conversation, ConversationMessage } from "@/lib/types";
import MessageContent from "@/components/MessageContent";
import SearchBar from "@/components/SearchBar";
import ConversationStatsDisplay from "@/components/ConversationStatsDisplay";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SimpleSearchIndex } from "@/lib/search-index-simple";
import { conversationToMarkdown, conversationToSimpleMarkdown } from "@/lib/conversation-markdown";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

type FilterMode = 'all' | 'tools' | 'sidechains' | 'system' | 'thinking' | 'assistant' | 'user';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedMessage, setSelectedMessage] = useState<ConversationMessage | null>(null);
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Set<string>>(new Set());
  const [searchDuration, setSearchDuration] = useState<number | null>(null);
  const [indexBuildTime, setIndexBuildTime] = useState<number | null>(null);
  const searchIndexRef = useRef<SimpleSearchIndex | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [copyFormat, setCopyFormat] = useState<'full' | 'simple'>('simple');
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(-1);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params.projectId && params.id) {
      fetch(`/api/projects/${params.projectId}/conversations`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load conversations");
          return res.json();
        })
        .then(async (conversations: Conversation[]) => {
          const conv = conversations.find(c => c.id === params.id);
          if (!conv) throw new Error("Conversation not found");
          setConversation(conv);
          
          // Build search index
          const indexStartTime = performance.now();
          if (!searchIndexRef.current) {
            searchIndexRef.current = new SimpleSearchIndex();
          }
          await searchIndexRef.current.buildIndex(conv.messages);
          const indexEndTime = performance.now();
          setIndexBuildTime(indexEndTime - indexStartTime);
          
          // Check for search params from project search
          const urlQuery = searchParams.get('q');
          const highlightId = searchParams.get('highlight');
          
          if (urlQuery) {
            setSearchQuery(urlQuery);
            // Perform initial search
            const results = searchIndexRef.current.search(urlQuery);
            const resultUuids = new Set(results.map(msg => msg.uuid));
            setSearchResults(resultUuids);
          }
          
          if (highlightId) {
            setHighlightMessageId(highlightId);
            setSelectedMessage(conv.messages.find(m => m.uuid === highlightId) || null);
          }
          
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [params.projectId, params.id, searchParams]);

  // Check window width for JSON panel
  useEffect(() => {
    const handleResize = () => {
      setShowJsonPanel(window.innerWidth >= 1536); // 2xl breakpoint
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to highlighted message
  useEffect(() => {
    if (highlightMessageId && !loading) {
      const messageElement = messageRefs.current.get(highlightMessageId);
      if (messageElement) {
        // Delay to ensure DOM is fully rendered
        setTimeout(() => {
          messageElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Add a visual pulse effect
          messageElement.classList.add('animate-pulse');
          setTimeout(() => {
            messageElement.classList.remove('animate-pulse');
          }, 2000);
        }, 100);
      }
    }
  }, [highlightMessageId, loading]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    if (!searchIndexRef.current) return;
    
    const startTime = performance.now();
    
    if (!query.trim()) {
      setSearchResults(new Set());
      setSearchDuration(null);
      return;
    }
    
    const results = searchIndexRef.current.search(query);
    const resultUuids = new Set(results.map(msg => msg.uuid));
    setSearchResults(resultUuids);
    
    const endTime = performance.now();
    setSearchDuration(endTime - startTime);
    setSearchQuery(query);
  }, []);

  // Filter messages based on filter mode and search
  const visibleMessages = useMemo(() => {
    if (!conversation) return [];
    
    return conversation.messages.filter(message => {
      // First apply search filter
      if (searchQuery.trim() && searchResults.size > 0 && !searchResults.has(message.uuid)) {
        return false;
      }
      
      // Then apply filter mode
      if (filterMode === 'all') return true;
      
      if (filterMode === 'system') return message.type === 'system';
      if (filterMode === 'assistant') return message.type === 'assistant';
      if (filterMode === 'user') return message.type === 'user';
      if (filterMode === 'sidechains') return message.isSidechain;
      
      // For content-based filters
      if (!message.message || !message.message.content) return false;
      const content = message.message.content;
      
      if (filterMode === 'tools' && Array.isArray(content)) {
        return content.some(item => item.type === 'tool_use' || item.type === 'tool_result');
      }
      
      if (filterMode === 'thinking' && Array.isArray(content)) {
        return content.some(item => item.type === 'thinking');
      }
      
      return false;
    });
  }, [conversation, filterMode, searchQuery, searchResults]);

  // Keyboard navigation
  const { selectedIndex, reset: resetKeyboardNav } = useKeyboardNavigation({
    itemCount: visibleMessages.length,
    isActive: !loading,
    containerRef: messagesContainerRef,
    onSelect: (index) => {
      setSelectedMessageIndex(index);
      if (visibleMessages[index]) {
        setSelectedMessage(visibleMessages[index]);
      }
    },
    onEnter: (index) => {
      if (visibleMessages[index]) {
        handleMessageClick(visibleMessages[index]);
      }
    }
  });

  // Update selected message index when keyboard navigation changes
  useEffect(() => {
    setSelectedMessageIndex(selectedIndex);
  }, [selectedIndex]);

  // Reset keyboard navigation when filter or search changes
  useEffect(() => {
    resetKeyboardNav();
    setSelectedMessageIndex(-1);
  }, [filterMode, searchQuery, searchResults, resetKeyboardNav]);

  // Count messages by type
  const counts = useMemo(() => {
    if (!conversation) return { all: 0, assistant: 0, user: 0, tools: 0, sidechains: 0, system: 0, thinking: 0 };
    
    return {
      all: conversation.messages.length,
      assistant: conversation.messages.filter(m => m.type === 'assistant').length,
      user: conversation.messages.filter(m => m.type === 'user').length,
      tools: conversation.messages.filter(m => {
        if (!m.message) return false;
        const content = m.message.content;
        if (Array.isArray(content)) {
          return content.some(item => item.type === "tool_use" || item.type === "tool_result");
        }
        return false;
      }).length,
      sidechains: conversation.messages.filter(m => m.isSidechain).length,
      system: conversation.messages.filter(m => m.type === "system").length,
      thinking: conversation.messages.filter(m => {
        if (!m.message) return false;
        const content = m.message.content;
        if (Array.isArray(content)) {
          return content.some(item => item.type === "thinking");
        }
        return false;
      }).length,
    };
  }, [conversation]);

  const handleMessageClick = (message: ConversationMessage) => {
    setSelectedMessage(message);
  };

  const copyAsMarkdown = () => {
    if (!conversation) return;
    
    const markdown = copyFormat === 'full' 
      ? conversationToMarkdown(conversation)
      : conversationToSimpleMarkdown(conversation);
    
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyPath = () => {
    if (!params.projectId || !params.id) return;
    
    // Get the encoded project ID
    const encodedProjectId = params.projectId as string;
    // Build the full path to the conversation file in ~/.claude/projects
    const conversationPath = `/Users/johnlindquist/.claude/projects/${encodedProjectId}/${params.id}.jsonl`;
    
    navigator.clipboard.writeText(conversationPath).then(() => {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-muted-foreground">Loading conversation...</div>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-destructive">{error || "Conversation not found"}</div>
          <div className="text-center mt-4">
            <Link href="/" className="text-primary hover:underline">
              Back to projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className={cn(
        "mx-auto flex gap-4",
        showJsonPanel && selectedMessage ? "max-w-7xl" : "max-w-4xl"
      )}>
        <div className="flex-1">
          <div className="mb-4 flex justify-between items-start">
            <Link href="/" className="text-primary hover:underline text-sm">
              ← Back to projects
            </Link>
            {params.id && (
              <ConversationStatsDisplay 
                conversationId={params.id as string}
                compact
              />
            )}
          </div>
          
          <div className="bg-card rounded-lg shadow-lg p-4 mb-4 border">
            <h1 className="text-xl font-bold mb-2">
              {conversation.summary.summary}
            </h1>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Session: {conversation.id.substring(0, 8)}...</p>
              <p>{conversation.messageCount} messages • {new Date(conversation.lastUpdated).toLocaleDateString()}</p>
            </div>
            
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterMode('all')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'all' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                📋 All ({counts.all})
              </button>
              
              <button
                onClick={() => setFilterMode('assistant')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'assistant' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                🤖 Assistant ({counts.assistant})
              </button>
              
              <button
                onClick={() => setFilterMode('user')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'user' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                👤 User ({counts.user})
              </button>
              
              <button
                onClick={() => setFilterMode('tools')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'tools' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                🔧 Tools ({counts.tools})
              </button>
              
              <button
                onClick={() => setFilterMode('sidechains')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'sidechains' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                🌟 Sidechains ({counts.sidechains})
              </button>
              
              <button
                onClick={() => setFilterMode('system')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'system' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                ⚙️ System ({counts.system})
              </button>
              
              <button
                onClick={() => setFilterMode('thinking')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors",
                  filterMode === 'thinking' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                🧠 Thinking ({counts.thinking})
              </button>
            </div>
            
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={copyAsMarkdown}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1",
                    copied 
                      ? "bg-green-600 text-white" 
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  📋 {copied ? "Copied!" : "Copy as Markdown"}
                </button>
                <select
                  value={copyFormat}
                  onChange={(e) => setCopyFormat(e.target.value as 'full' | 'simple')}
                  className="px-2 py-1 rounded-md text-xs bg-secondary text-secondary-foreground"
                >
                  <option value="simple">Simple (text only)</option>
                  <option value="full">Full (with tools)</option>
                </select>
              </div>
              <button
                onClick={copyPath}
                className={cn(
                  "px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1",
                  copiedPath 
                    ? "bg-green-600 text-white" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                📁 {copiedPath ? "Copied!" : "Copy Path"}
              </button>
            </div>
            
            <div className="mt-4">
              <SearchBar 
                onSearch={handleSearch}
                placeholder="Search messages..."
                className="w-full"
              />
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                {indexBuildTime !== null && (
                  <p>Index built in {indexBuildTime.toFixed(2)}ms</p>
                )}
                {searchQuery && searchDuration !== null && (
                  <p>Found {searchResults.size} results in {searchDuration.toFixed(2)}ms</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-2" ref={messagesContainerRef}>
            {visibleMessages.map((message, idx) => (
              <MessageContent 
                key={message.uuid}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.uuid, el);
                }}
                message={message}
                onMessageClick={handleMessageClick}
                isSelected={selectedMessage?.uuid === message.uuid}
                searchQuery={searchQuery}
                isHighlighted={message.uuid === highlightMessageId}
                isKeyboardSelected={selectedMessageIndex === idx}
                data-keyboard-item
              />
            ))}
          </div>
          
          {visibleMessages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery 
                ? `No messages found matching "${searchQuery}"${filterMode !== 'all' ? ` in ${filterMode} messages` : ''}`
                : `No messages found for filter: ${filterMode}`}
            </div>
          )}
        </div>
        
        {/* JSON Panel */}
        {showJsonPanel && selectedMessage && (
          <div className="w-[500px] sticky top-4 h-fit">
            <div className="bg-card rounded-lg shadow-lg border p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Message JSON</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedMessage, null, 2));
                      // Could add a toast notification here
                    }}
                    className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                  >
                    Copy JSON
                  </button>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <pre className="text-xs bg-background rounded p-3 overflow-auto max-h-[85vh] font-mono">
                {JSON.stringify(selectedMessage, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}