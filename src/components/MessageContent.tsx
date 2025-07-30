"use client";

import { ConversationMessage } from "@/lib/types";

interface MessageContentProps {
  message: ConversationMessage;
}

export default function MessageContent({ message }: MessageContentProps) {
  const renderContent = () => {
    const content = message.message.content;
    
    if (typeof content === "string") {
      return (
        <div className="whitespace-pre-wrap">
          {content}
        </div>
      );
    }
    
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => (
            <div key={index} className="whitespace-pre-wrap">
              {item.text}
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

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
        </div>
      </div>
    </div>
  );
}