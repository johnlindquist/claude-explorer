"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectStats {
  projectId: string;
  totalConversations: number;
  totalMessages: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalToolCalls: number;
  toolUsageBreakdown: Record<string, number>;
  totalThinkingBlocks: number;
  averageMessagesPerConversation: number;
  totalTokensEstimate: number;
  longestConversation: { id: string; messageCount: number };
  mostActiveDay: { date: string; messageCount: number };
}

interface ProjectStatsDisplayProps {
  projectId: string;
  className?: string;
  onConversationClick?: (conversationId: string) => void;
}

export default function ProjectStatsDisplay({ projectId, className, onConversationClick }: ProjectStatsDisplayProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load project stats:", err);
        setLoading(false);
      });
  }, [projectId]);

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const topTools = Object.entries(stats.toolUsageBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className={cn("bg-card/90 backdrop-blur-sm border rounded-lg p-4 space-y-3 shadow-sm", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground">Project Overview</h3>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-2">
          <div>
            <div className="text-muted-foreground">Conversations</div>
            <div className="text-lg font-semibold">{formatNumber(stats.totalConversations)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Messages</div>
            <div className="text-lg font-semibold">{formatNumber(stats.totalMessages)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg per Conv</div>
            <div className="text-lg font-semibold">{stats.averageMessagesPerConversation}</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div>
            <div className="text-muted-foreground">Tool Calls</div>
            <div className="text-lg font-semibold">{formatNumber(stats.totalToolCalls)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">User/Assistant</div>
            <div className="text-lg font-semibold">
              {formatNumber(stats.totalUserMessages)}/{formatNumber(stats.totalAssistantMessages)}
            </div>
          </div>
          {stats.totalThinkingBlocks > 0 && (
            <div>
              <div className="text-muted-foreground">Thinking Blocks</div>
              <div className="text-lg font-semibold">{formatNumber(stats.totalThinkingBlocks)}</div>
            </div>
          )}
        </div>
      </div>
      
      {topTools.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground mb-1">Top Tools</div>
          <div className="space-y-1">
            {topTools.map(([tool, count]) => (
              <div key={tool} className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{tool}</span>
                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{formatNumber(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="pt-2 border-t space-y-2">
        {stats.longestConversation.messageCount > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Longest: </span>
            <button 
              onClick={() => onConversationClick?.(stats.longestConversation.id)}
              className="text-primary hover:underline"
            >
              {stats.longestConversation.messageCount} messages
            </button>
          </div>
        )}
        
        {stats.mostActiveDay.messageCount > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Most Active: </span>
            <span>{formatDate(stats.mostActiveDay.date)} ({stats.mostActiveDay.messageCount} msgs)</span>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          ~{formatNumber(stats.totalTokensEstimate)} tokens
        </div>
      </div>
    </div>
  );
}