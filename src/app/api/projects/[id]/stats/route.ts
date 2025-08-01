import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectPath = path.join(os.homedir(), '.claude', 'projects', params.id);
    
    try {
      await fs.access(projectPath);
    } catch {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    const stats = {
      projectId: params.id,
      totalConversations: 0,
      totalMessages: 0,
      totalUserMessages: 0,
      totalAssistantMessages: 0,
      totalToolCalls: 0,
      toolUsageBreakdown: {} as Record<string, number>,
      totalThinkingBlocks: 0,
      averageMessagesPerConversation: 0,
      totalTokensEstimate: 0,
      longestConversation: { id: '', messageCount: 0 },
      mostActiveDay: { date: '', messageCount: 0 }
    };
    
    const dailyActivity: Record<string, number> = {};
    
    // Read all conversation files
    const files = await fs.readdir(projectPath);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) continue;
      
      stats.totalConversations++;
      let conversationMessageCount = 0;
      
      // Process each line
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'user' || data.type === 'assistant' || data.type === 'system') {
            conversationMessageCount++;
            stats.totalMessages++;
            
            // Track daily activity
            const date = new Date(data.timestamp).toISOString().split('T')[0];
            dailyActivity[date] = (dailyActivity[date] || 0) + 1;
          }
          
          if (data.type === 'user') {
            stats.totalUserMessages++;
          } else if (data.type === 'assistant') {
            stats.totalAssistantMessages++;
            
            // Count tool calls and thinking blocks
            if (data.message?.content && Array.isArray(data.message.content)) {
              data.message.content.forEach((item: any) => {
                if (item.type === 'tool_use') {
                  stats.totalToolCalls++;
                  const toolName = item.name || 'unknown';
                  stats.toolUsageBreakdown[toolName] = (stats.toolUsageBreakdown[toolName] || 0) + 1;
                } else if (item.type === 'thinking') {
                  stats.totalThinkingBlocks++;
                }
              });
            }
          }
          
          // Rough token estimate
          const messageText = JSON.stringify(data);
          stats.totalTokensEstimate += Math.ceil(messageText.length / 4);
          
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
      
      // Track longest conversation
      if (conversationMessageCount > stats.longestConversation.messageCount) {
        stats.longestConversation = {
          id: path.basename(file, '.jsonl'),
          messageCount: conversationMessageCount
        };
      }
    }
    
    // Calculate averages
    stats.averageMessagesPerConversation = stats.totalConversations > 0 
      ? Math.round(stats.totalMessages / stats.totalConversations) 
      : 0;
    
    // Find most active day
    const mostActiveEntry = Object.entries(dailyActivity)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (mostActiveEntry) {
      stats.mostActiveDay = {
        date: mostActiveEntry[0],
        messageCount: mostActiveEntry[1]
      };
    }
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Project stats error:', error);
    return NextResponse.json({ error: 'Failed to calculate stats' }, { status: 500 });
  }
}