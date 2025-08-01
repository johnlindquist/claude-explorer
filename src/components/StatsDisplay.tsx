"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Stats {
  totalProjects: number;
  totalConversations: number;
  totalMessages: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalToolCalls: number;
  toolUsageBreakdown: Record<string, number>;
  totalThinkingBlocks: number;
  averageMessagesPerConversation: number;
  totalTokensEstimate: number;
}

interface StatsDisplayProps {
  className?: string;
  compact?: boolean;
}

export default function StatsDisplay({ className, compact = false }: StatsDisplayProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load stats:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 bg-muted rounded w-32"></div>
      </div>
    );
  }

  if (!stats) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const topTools = Object.entries(stats.toolUsageBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (compact) {
    return (
      <div className={cn("text-xs text-muted-foreground space-y-1", className)}>
        <div className="flex gap-3 flex-wrap">
          <span title="Total conversations">💬 {formatNumber(stats.totalConversations)}</span>
          <span title="Total messages">📝 {formatNumber(stats.totalMessages)}</span>
          <span title="Tool calls">🔧 {formatNumber(stats.totalToolCalls)}</span>
          {stats.totalThinkingBlocks > 0 && (
            <span title="Thinking blocks">🧠 {formatNumber(stats.totalThinkingBlocks)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground">Claude Usage Stats</h3>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Projects:</span>
            <span className="font-medium">{formatNumber(stats.totalProjects)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Conversations:</span>
            <span className="font-medium">{formatNumber(stats.totalConversations)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Messages:</span>
            <span className="font-medium">{formatNumber(stats.totalMessages)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg/Conv:</span>
            <span className="font-medium">{stats.averageMessagesPerConversation}</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">User:</span>
            <span className="font-medium">{formatNumber(stats.totalUserMessages)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assistant:</span>
            <span className="font-medium">{formatNumber(stats.totalAssistantMessages)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tool Calls:</span>
            <span className="font-medium">{formatNumber(stats.totalToolCalls)}</span>
          </div>
          {stats.totalThinkingBlocks > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thinking:</span>
              <span className="font-medium">{formatNumber(stats.totalThinkingBlocks)}</span>
            </div>
          )}
        </div>
      </div>
      
      {topTools.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground mb-1">Top Tools:</div>
          <div className="space-y-1">
            {topTools.map(([tool, count]) => (
              <div key={tool} className="flex justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{tool}:</span>
                <span className="font-medium">{formatNumber(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="pt-2 border-t text-xs text-muted-foreground">
        ~{formatNumber(stats.totalTokensEstimate)} tokens
      </div>
    </div>
  );
}