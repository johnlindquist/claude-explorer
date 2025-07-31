"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Conversation, ConversationMessage } from "@/lib/types";
import MessageContent from "@/components/MessageContent";
import Link from "next/link";
import { cn } from "@/lib/utils";

type FilterMode = 'all' | 'tools' | 'sidechains' | 'system' | 'thinking' | 'assistant' | 'user';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedMessage, setSelectedMessage] = useState<ConversationMessage | null>(null);
  const [showJsonPanel, setShowJsonPanel] = useState(false);

  useEffect(() => {
    if (params.projectId && params.id) {
      fetch(`/api/projects/${params.projectId}/conversations`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load conversations");
          return res.json();
        })
        .then((conversations: Conversation[]) => {
          const conv = conversations.find(c => c.id === params.id);
          if (!conv) throw new Error("Conversation not found");
          setConversation(conv);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [params.projectId, params.id]);

  // Check window width for JSON panel
  useEffect(() => {
    const handleResize = () => {
      setShowJsonPanel(window.innerWidth >= 1536); // 2xl breakpoint
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Filter messages based on filter mode
  const visibleMessages = conversation.messages.filter(message => {
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

  // Count messages by type
  const counts = {
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

  const handleMessageClick = (message: ConversationMessage) => {
    setSelectedMessage(message);
  };

  return (
    <div className="min-h-screen p-4">
      <div className={cn(
        "mx-auto flex gap-4",
        showJsonPanel && selectedMessage ? "max-w-7xl" : "max-w-4xl"
      )}>
        <div className="flex-1">
          <div className="mb-4">
            <Link href="/" className="text-primary hover:underline text-sm">
              ← Back to projects
            </Link>
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
          </div>
          
          <div className="space-y-2">
            {visibleMessages.map((message) => (
              <MessageContent 
                key={message.uuid} 
                message={message}
                onMessageClick={handleMessageClick}
                isSelected={selectedMessage?.uuid === message.uuid}
              />
            ))}
          </div>
          
          {visibleMessages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No messages found for filter: {filterMode}
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