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
                <div key={index} className="bg-gray-100 rounded p-2 text-sm font-mono">
                  <span className="text-gray-600">Tool: </span>
                  <span className="font-semibold">{item.name}</span>
                  {item.input?.file_path && (
                    <span className="text-gray-600"> - {item.input.file_path}</span>
                  )}
                  {item.input?.command && (
                    <span className="text-gray-600"> - {item.input.command}</span>
                  )}
                </div>
              );
            }
            
            if (item.type === "tool_result") {
              return (
                <div key={index} className="bg-gray-100 rounded p-2 text-sm">
                  <span className="text-gray-600">Tool Result</span>
                  {item.content && typeof item.content === "string" && (
                    <div className="mt-1 text-xs overflow-auto max-h-40">
                      {item.content.substring(0, 200)}
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
    
    // Handle empty content
    return (
      <div className="text-gray-400 italic">
        {message.type === "user" ? "[No message content]" : "[Empty response]"}
      </div>
    );
  };

  // Skip rendering if it's a tool result message from user
  if (message.type === "user" && Array.isArray(message.message.content)) {
    const hasOnlyToolResults = message.message.content.every(
      item => item.type === "tool_result"
    );
    if (hasOnlyToolResults) {
      return null;
    }
  }

  return (
    <div className={`rounded-lg p-4 ${
      message.type === "user" 
        ? "bg-blue-50 ml-auto max-w-[80%]" 
        : "bg-gray-50 mr-auto max-w-[80%]"
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
            message.type === "user" ? "bg-blue-600" : "bg-gray-600"
          }`}>
            {message.type === "user" ? "U" : "A"}
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm">
              {message.type === "user" ? "User" : "Assistant"}
            </span>
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
        </div>
      </div>
    </div>
  );
}