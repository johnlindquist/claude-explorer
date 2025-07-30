"use client";

import { ConversationMessage } from "@/lib/types";
import { useState } from "react";

interface MessageContentProps {
  message: ConversationMessage;
}

export default function MessageContent({ message }: MessageContentProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(message, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    const content = message.message?.content || message.content;
    
    // Handle string content
    if (typeof content === "string") {
      const shouldTruncate = !expanded && content.length > 200;
      const displayContent = shouldTruncate ? content.substring(0, 200) + "..." : content;
      
      return (
        <div>
          <div className="whitespace-pre-wrap text-sm">
            {displayContent}
          </div>
          {content.length > 200 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setExpanded(!expanded);
              }}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      );
    }
    
    // Handle array content (including tool uses)
    if (Array.isArray(content)) {
      return (
        <div className="space-y-1">
          {content.map((item, index) => {
            if (item.type === "text" && item.text) {
              const shouldTruncate = !expanded && item.text.length > 200;
              const displayContent = shouldTruncate ? item.text.substring(0, 200) + "..." : item.text;
              
              return (
                <div key={index}>
                  <div className="whitespace-pre-wrap text-sm">
                    {displayContent}
                  </div>
                  {item.text.length > 200 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setExpanded(!expanded);
                      }}
                      className="text-blue-400 hover:text-blue-300 text-xs mt-1"
                    >
                      {expanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              );
            }
            
            if (item.type === "tool_use") {
              return (
                <div key={index} className="bg-purple-900 bg-opacity-30 rounded p-2 text-xs font-mono border border-purple-700">
                  <span className="text-purple-300">🔧 {item.name}</span>
                  {item.input?.file_path && (
                    <span className="text-purple-400 ml-2 text-xs">📁 {item.input.file_path}</span>
                  )}
                </div>
              );
            }
            
            if (item.type === "tool_result") {
              return (
                <div key={index} className={`rounded p-2 text-xs border ${
                  item.is_error 
                    ? "bg-red-900 bg-opacity-30 border-red-700 text-red-300" 
                    : "bg-green-900 bg-opacity-30 border-green-700 text-green-300"
                }`}>
                  <span className="font-semibold">
                    {item.is_error ? "❌ Error" : "✅ Result"}
                  </span>
                </div>
              );
            }
            
            return null;
          })}
        </div>
      );
    }
    
    // Handle system messages or empty content
    return (
      <div className="text-gray-500 italic text-sm">
        {message.type === "system" ? message.content || "[System message]" : "[No content]"}
      </div>
    );
  };

  // Determine message styling based on type and characteristics
  const getMessageStyle = () => {
    let base = "rounded-lg p-3 message-hover cursor-pointer relative ";
    
    if (message.type === "system") {
      return base + "bg-yellow-900 bg-opacity-20 border border-yellow-700";
    }
    
    if (message.isSidechain) {
      return base + (message.type === "user" 
        ? "bg-indigo-900 bg-opacity-20 ml-8 border border-indigo-700" 
        : "bg-indigo-900 bg-opacity-30 mr-8 border border-indigo-700");
    }
    
    return base + (message.type === "user" 
      ? "bg-blue-900 bg-opacity-20 ml-8 border border-blue-700" 
      : "bg-gray-800 mr-8 border border-gray-700");
  };

  const getAvatar = () => {
    if (message.type === "system") return "S";
    if (message.isSidechain) return message.type === "user" ? "U*" : "A*";
    return message.type === "user" ? "U" : "A";
  };

  const getAvatarColor = () => {
    if (message.type === "system") return "bg-yellow-700";
    if (message.isSidechain) return message.type === "user" ? "bg-indigo-600" : "bg-indigo-700";
    return message.type === "user" ? "bg-blue-600" : "bg-gray-600";
  };

  // Skip rendering if it's a tool result message from user with no other content
  if (message.type === "user" && message.message && Array.isArray(message.message.content)) {
    const hasOnlyToolResults = message.message.content.every(
      item => item.type === "tool_result"
    );
    if (hasOnlyToolResults && !message.isSidechain) {
      return null;
    }
  }

  return (
    <div className={getMessageStyle()} onClick={copyToClipboard}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-xs ${getAvatarColor()}`}>
            {getAvatar()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {message.isSidechain && (
              <span className="text-xs bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded">
                Sidechain
              </span>
            )}
            {message.message?.model && (
              <span className="text-xs text-gray-400">
                {message.message.model}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          
          <div className="text-gray-200">
            {renderContent()}
          </div>
        </div>
        
        <button
          className={`copy-button px-2 py-1 text-xs rounded transition-all ${
            copied 
              ? "bg-green-700 text-green-200" 
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard();
          }}
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>
    </div>
  );
}