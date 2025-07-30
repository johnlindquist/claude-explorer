"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Conversation } from "@/lib/types";
import MessageContent from "@/components/MessageContent";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(true);
  const [showSidechains, setShowSidechains] = useState(true);
  const [showSystem, setShowSystem] = useState(true);

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

  // Filter messages based on visibility settings
  const visibleMessages = conversation.messages.filter(message => {
    // Handle system messages
    if (message.type === "system" && !showSystem) return false;
    
    // Handle sidechain messages
    if (message.isSidechain && !showSidechains) return false;
    
    // Handle tool-only messages
    if (!showTools && message.type === "user" && message.message) {
      const content = message.message.content;
      if (Array.isArray(content)) {
        const hasOnlyTools = content.every(item => 
          item.type === "tool_use" || item.type === "tool_result"
        );
        if (hasOnlyTools) return false;
      }
    }
    
    // For regular messages, check if they have actual content
    if (message.type === "user" && message.message) {
      const content = message.message.content;
      if (typeof content === "string" && content.trim()) return true;
      if (Array.isArray(content)) {
        // Show if there's at least one text content or if tools are visible
        return content.some(item => 
          (item.type === "text" && item.text?.trim()) ||
          (showTools && (item.type === "tool_use" || item.type === "tool_result"))
        );
      }
    }
    
    // Always show assistant messages and system messages (if enabled)
    return message.type === "assistant" || message.type === "system";
  });

  const sideChainCount = conversation.messages.filter(m => m.isSidechain).length;
  const toolMessageCount = conversation.messages.filter(m => {
    if (!m.message) return false;
    const content = m.message.content;
    if (Array.isArray(content)) {
      return content.some(item => item.type === "tool_use" || item.type === "tool_result");
    }
    return false;
  }).length;
  const systemMessageCount = conversation.messages.filter(m => m.type === "system").length;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
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
              onClick={() => setShowTools(!showTools)}
              className={cn(
                "px-3 py-1 rounded-md text-xs transition-colors",
                showTools 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              🔧 Tools ({toolMessageCount})
            </button>
            
            <button
              onClick={() => setShowSidechains(!showSidechains)}
              className={cn(
                "px-3 py-1 rounded-md text-xs transition-colors",
                showSidechains 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              🌟 Sidechains ({sideChainCount})
            </button>
            
            <button
              onClick={() => setShowSystem(!showSystem)}
              className={cn(
                "px-3 py-1 rounded-md text-xs transition-colors",
                showSystem 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              ⚙️ System ({systemMessageCount})
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          {visibleMessages.map((message) => (
            <MessageContent key={message.uuid} message={message} />
          ))}
        </div>
        
        {visibleMessages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No visible messages with current filters
          </div>
        )}
      </div>
    </div>
  );
}