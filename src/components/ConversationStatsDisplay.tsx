"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ConversationStats {
  conversationId: string;
  projectId: string | null;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  toolCalls: number;
  toolCallsByType: Record<string, number>;
  thinkingBlocks: number;
  totalTokensEstimate: number;
  sidechainMessages: number;
  messageTimeline: Array<{ hour: number; count: number }>;
  averageResponseTime: number;
  uniqueModels: string[];
  errorCount: number;
}

interface ConversationStatsDisplayProps {
  conversationId: string;
  className?: string;
  compact?: boolean;
}

export default function ConversationStatsDisplay({ conversationId, className, compact = false }: ConversationStatsDisplayProps) {
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load conversation stats:", err);
        setLoading(false);
      });
  }, [conversationId]);

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 bg-muted rounded w-32"></div>
      </div>
    );
  }

  if (!stats) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const topTools = Object.entries(stats.toolCallsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const peakHour = stats.messageTimeline.reduce((max, current) => 
    current.count > max.count ? current : max
  );

  if (compact) {
    return (
      <div className={cn("text-xs text-muted-foreground flex gap-3 flex-wrap", className)}>
        <span>💬 {stats.totalMessages} msgs</span>
        <span>🔧 {stats.toolCalls} tools</span>
        {stats.thinkingBlocks > 0 && <span>🧠 {stats.thinkingBlocks}</span>}
        {stats.sidechainMessages > 0 && <span>🔀 {stats.sidechainMessages} sidechain</span>}
      </div>
    );
  }

  return (
    <div className={cn("bg-card border rounded-lg p-4 space-y-3", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground">Conversation Stats</h3>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-2">
          <div>
            <div className="text-muted-foreground">Messages</div>
            <div className="text-lg font-semibold">{stats.totalMessages}</div>
            <div className="text-xs text-muted-foreground">
              {stats.userMessages} user / {stats.assistantMessages} assistant
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground">Tool Calls</div>
            <div className="text-lg font-semibold">{stats.toolCalls}</div>
            {stats.errorCount > 0 && (
              <div className="text-xs text-destructive">{stats.errorCount} errors</div>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div>
            <div className="text-muted-foreground">Avg Response</div>
            <div className="text-lg font-semibold">{stats.averageResponseTime}s</div>
          </div>
          
          {stats.thinkingBlocks > 0 && (
            <div>
              <div className="text-muted-foreground">Thinking Blocks</div>
              <div className="text-lg font-semibold">{stats.thinkingBlocks}</div>
            </div>
          )}
          
          {stats.sidechainMessages > 0 && (
            <div>
              <div className="text-muted-foreground">Sidechain</div>
              <div className="text-lg font-semibold">{stats.sidechainMessages}</div>
            </div>
          )}
        </div>
      </div>
      
      {topTools.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground mb-1">Top Tools</div>
          <div className="space-y-1">
            {topTools.map(([tool, count]) => (
              <div key={tool} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{tool}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="pt-2 border-t space-y-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Peak Activity: </span>
          <span>{peakHour.hour}:00 ({peakHour.count} msgs)</span>
        </div>
        
        {stats.uniqueModels.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Models: </span>
            <span>{stats.uniqueModels.join(', ')}</span>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          ~{formatNumber(stats.totalTokensEstimate)} tokens
        </div>
      </div>
    </div>
  );
}