"use client";

import { ConversationMessage } from "@/lib/types";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  message: ConversationMessage;
  onMessageClick?: (message: ConversationMessage) => void;
  isSelected?: boolean;
}

export default function MessageContent({ message, onMessageClick, isSelected }: MessageContentProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(message, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClick = () => {
    if (onMessageClick) {
      onMessageClick(message);
    } else {
      copyToClipboard();
    }
  };

  // Check if message contains tools
  const hasTools = message.message && Array.isArray(message.message.content) && 
    message.message.content.some(item => item.type === 'tool_use' || item.type === 'tool_result');

  const renderToolParameters = (input: any) => {
    if (!input) return null;
    
    const params = Object.entries(input).filter(([key]) => key !== 'description');
    if (params.length === 0) return null;
    
    return (
      <div className="mt-2 space-y-1">
        {params.map(([key, value]) => (
          <div key={key} className="text-xs">
            <span className="text-muted-foreground">{key}: </span>
            <span className="text-foreground">
              {typeof value === 'string' 
                ? value.length > 100 
                  ? value.substring(0, 100) + '...' 
                  : value
                : JSON.stringify(value, null, 2)
              }
            </span>
          </div>
        ))}
      </div>
    );
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
              className="text-primary hover:underline text-xs mt-1"
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
        <div className="space-y-2">
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
                      className="text-primary hover:underline text-xs mt-1"
                    >
                      {expanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              );
            }
            
            if (item.type === "thinking" && item.thinking) {
              const shouldTruncate = !expanded && item.thinking.length > 500;
              const displayContent = shouldTruncate ? item.thinking.substring(0, 500) + "..." : item.thinking;
              
              return (
                <div key={index} className="bg-accent/30 rounded-md p-3 border border-accent/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🧠</span>
                    <span className="text-sm font-semibold text-accent-foreground">
                      Thinking
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {displayContent}
                  </div>
                  {item.thinking.length > 500 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpanded(!expanded);
                      }}
                      className="text-primary hover:underline text-xs mt-2"
                    >
                      {expanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              );
            }
            
            if (item.type === "tool_use") {
              const toolIcons: Record<string, string> = {
                'Bash': '💻',
                'Read': '📖',
                'Write': '✏️',
                'Edit': '📝',
                'MultiEdit': '📝',
                'Grep': '🔍',
                'Glob': '🔎',
                'LS': '📁',
                'WebFetch': '🌐',
                'WebSearch': '🔍',
                'Task': '🤖',
                'TodoWrite': '✅',
                'NotebookRead': '📓',
                'NotebookEdit': '📓',
                'ExitPlanMode': '🚪',
              };
              
              const icon = toolIcons[item.name] || '🔧';
              
              return (
                <div key={index} className="bg-secondary/50 rounded-md p-3 text-xs font-mono border border-border opacity-60 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-secondary-foreground font-semibold">
                      {icon} {item.name}
                    </span>
                  </div>
                  
                  {/* Special handling for common tools */}
                  {item.name === "Bash" && item.input?.command && (
                    <div className="bg-background/50 rounded p-2 mt-2 overflow-x-auto">
                      <span className="text-muted-foreground">$ </span>
                      <span className="text-foreground">{item.input.command}</span>
                    </div>
                  )}
                  
                  {/* Display all parameters */}
                  {renderToolParameters(item.input)}
                </div>
              );
            }
            
            if (item.type === "tool_result") {
              return (
                <div key={index} className={cn(
                  "rounded-md p-2 text-xs border opacity-60 hover:opacity-100 transition-opacity",
                  item.is_error 
                    ? "bg-destructive/10 border-destructive/50 text-destructive" 
                    : "bg-secondary/30 border-border text-secondary-foreground"
                )}>
                  <span className="font-semibold">
                    {item.is_error ? "❌ Error" : "✅ Result"}
                  </span>
                  {item.content && typeof item.content === "string" && item.content.length > 0 && (
                    <div className="mt-1 text-xs font-mono overflow-auto max-h-40 bg-background/50 rounded p-2">
                      {item.content.substring(0, 500)}
                      {item.content.length > 500 && "..."}
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
      <div className="text-muted-foreground italic text-sm">
        {message.type === "system" ? message.content || "[System message]" : "[No content]"}
      </div>
    );
  };

  // Determine message styling based on type and characteristics
  const getMessageStyle = () => {
    let base = "rounded-lg p-3 transition-all cursor-pointer relative group ";
    
    // Add selected state
    if (isSelected) {
      base += "ring-2 ring-primary ";
    }
    
    if (message.type === "system") {
      return base + "bg-accent/50 border border-accent";
    }
    
    // Make assistant messages more prominent
    if (message.type === "assistant") {
      return base + (message.isSidechain 
        ? "bg-secondary/50 mr-8 border border-border" 
        : "bg-card mr-8 border border-primary/30 shadow-sm");
    }
    
    if (message.isSidechain) {
      return base + (message.type === "user" 
        ? "bg-primary/10 ml-8 border border-primary/20" 
        : "bg-secondary/50 mr-8 border border-border");
    }
    
    return base + (message.type === "user" 
      ? "bg-primary/5 ml-8 border border-border" 
      : "bg-secondary/30 mr-8 border border-border");
  };

  const getAvatar = () => {
    if (message.type === "system") return "S";
    if (message.isSidechain) return message.type === "user" ? "U*" : "A*";
    return message.type === "user" ? "U" : "A";
  };

  const getAvatarStyle = () => {
    if (message.type === "system") return "bg-accent text-accent-foreground";
    if (message.isSidechain) return message.type === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground";
    return message.type === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground";
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
    <div 
      className={cn(
        getMessageStyle(), 
        "hover:shadow-md",
        hasTools && "opacity-75 hover:opacity-100"
      )} 
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs", getAvatarStyle())}>
            {getAvatar()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {message.isSidechain && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                Sidechain
              </span>
            )}
            {message.message?.model && (
              <span className="text-xs text-muted-foreground">
                {message.message.model}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          
          <div className="text-foreground">
            {renderContent()}
          </div>
        </div>
        
        <button
          className={cn(
            "opacity-0 group-hover:opacity-100 px-2 py-1 text-xs rounded transition-all",
            copied 
              ? "bg-primary text-primary-foreground" 
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
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