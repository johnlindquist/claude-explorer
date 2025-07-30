"use client";

import { ConversationMessage } from "@/lib/types";

interface MessageContentProps {
  message: ConversationMessage;
}

export default function MessageContent({ message }: MessageContentProps) {
  const renderContent = () => {
    const content = message.message.content;
    
    // Handle string content
    if (typeof content === "string") {
      return (
        <div className="whitespace-pre-wrap">
          {content}
        </div>
      );
    }
    
    // Handle array content (including tool uses)
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => {
            if (item.type === "text" && item.text) {
              return (
                <div key={index} className="whitespace-pre-wrap">
                  {item.text}
                </div>
              );
            }
            
            if (item.type === "tool_use") {
              return (
                <div key={index} className="bg-purple-100 rounded p-2 text-sm font-mono border border-purple-300">
                  <span className="text-purple-700 font-semibold">🔧 Tool: {item.name}</span>
                  {item.input?.file_path && (
                    <div className="text-purple-600 text-xs mt-1">📁 {item.input.file_path}</div>
                  )}
                  {item.input?.command && (
                    <div className="text-purple-600 text-xs mt-1">💻 {item.input.command}</div>
                  )}
                  {item.input?.pattern && (
                    <div className="text-purple-600 text-xs mt-1">🔍 {item.input.pattern}</div>
                  )}
                </div>
              );
            }
            
            if (item.type === "tool_result") {
              const contentPreview = item.content && typeof item.content === "string" 
                ? item.content.substring(0, 200) 
                : "";
              
              return (
                <div key={index} className={`rounded p-2 text-sm border ${
                  item.is_error 
                    ? "bg-red-50 border-red-300 text-red-700" 
                    : "bg-green-50 border-green-300 text-green-700"
                }`}>
                  <span className="font-semibold">
                    {item.is_error ? "❌ Tool Error" : "✅ Tool Result"}
                  </span>
                  {contentPreview && (
                    <div className="mt-1 text-xs font-mono overflow-auto max-h-40">
                      {contentPreview}
                      {item.content.length > 200 && "..."}
                    </div>
                  )}
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
      <div className="text-gray-400 italic">
        {message.type === "system" ? "[System message]" : "[No message content]"}
      </div>
    );
  };

  // Determine message styling based on type and characteristics
  const getMessageStyle = () => {
    if (message.type === "system") {
      return "bg-yellow-50 border-l-4 border-yellow-400";
    }
    
    if (message.isSidechain) {
      return message.type === "user" 
        ? "bg-indigo-50 ml-auto max-w-[80%] border-l-4 border-indigo-400" 
        : "bg-indigo-100 mr-auto max-w-[80%] border-l-4 border-indigo-400";
    }
    
    return message.type === "user" 
      ? "bg-blue-50 ml-auto max-w-[80%]" 
      : "bg-gray-50 mr-auto max-w-[80%]";
  };

  const getAvatar = () => {
    if (message.type === "system") return "S";
    if (message.isSidechain) return message.type === "user" ? "U*" : "A*";
    return message.type === "user" ? "U" : "A";
  };

  const getAvatarColor = () => {
    if (message.type === "system") return "bg-yellow-600";
    if (message.isSidechain) return message.type === "user" ? "bg-indigo-600" : "bg-indigo-700";
    return message.type === "user" ? "bg-blue-600" : "bg-gray-600";
  };

  const getTypeLabel = () => {
    if (message.type === "system") return "System";
    if (message.isSidechain) {
      return message.type === "user" ? "Sub-Agent User" : "Sub-Agent Assistant";
    }
    return message.type === "user" ? "User" : "Assistant";
  };

  // Skip rendering if it's a tool result message from user with no other content
  if (message.type === "user" && Array.isArray(message.message.content)) {
    const hasOnlyToolResults = message.message.content.every(
      item => item.type === "tool_result"
    );
    if (hasOnlyToolResults && !message.isSidechain) {
      return null;
    }
  }

  return (
    <div className={`rounded-lg p-4 ${getMessageStyle()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs ${getAvatarColor()}`}>
            {getAvatar()}
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm">
              {getTypeLabel()}
            </span>
            {message.isSidechain && (
              <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded">
                Sidechain
              </span>
            )}
            {message.userType && message.userType !== "external" && (
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                {message.userType}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleString()}
            </span>
          </div>
          
          <div className="text-gray-800 text-sm">
            {renderContent()}
          </div>
          
          {message.message.model && (
            <div className="mt-2 text-xs text-gray-500">
              Model: {message.message.model}
            </div>
          )}
          
          {message.message.usage && (
            <div className="mt-1 text-xs text-gray-400">
              Tokens: {message.message.usage.input_tokens} in / {message.message.usage.output_tokens} out
            </div>
          )}
          
          {message.cwd && (
            <div className="mt-1 text-xs text-gray-400">
              Dir: {message.cwd}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}