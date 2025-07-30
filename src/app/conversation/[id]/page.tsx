"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Conversation } from "@/lib/types";
import MessageContent from "@/components/MessageContent";
import Link from "next/link";

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
    if (params.id) {
      fetch(`/api/conversations/${params.id}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load conversation");
          return res.json();
        })
        .then(data => {
          setConversation(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center">Loading conversation...</div>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center text-red-600">{error || "Conversation not found"}</div>
          <div className="text-center mt-4">
            <Link href="/" className="text-blue-600 hover:underline">
              Back to conversations
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← Back to conversations
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {conversation.summary.summary}
          </h1>
          <div className="text-sm text-gray-600">
            <p>Session ID: {conversation.id}</p>
            <p>{conversation.messageCount} total messages ({visibleMessages.length} visible)</p>
            <p>Last updated: {new Date(conversation.lastUpdated).toLocaleString()}</p>
          </div>
          
          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setShowTools(!showTools)}
              className={`px-3 py-1 rounded text-sm ${
                showTools 
                  ? "bg-purple-600 text-white" 
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              🔧 Tools ({toolMessageCount})
            </button>
            
            <button
              onClick={() => setShowSidechains(!showSidechains)}
              className={`px-3 py-1 rounded text-sm ${
                showSidechains 
                  ? "bg-indigo-600 text-white" 
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              🌟 Sidechains ({sideChainCount})
            </button>
            
            <button
              onClick={() => setShowSystem(!showSystem)}
              className={`px-3 py-1 rounded text-sm ${
                showSystem 
                  ? "bg-yellow-600 text-white" 
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              ⚙️ System ({systemMessageCount})
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {visibleMessages.map((message) => (
            <MessageContent key={message.uuid} message={message} />
          ))}
        </div>
        
        {visibleMessages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No visible messages with current filters
          </div>
        )}
      </div>
    </div>
  );
}