import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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

export async function GET(request: NextRequest) {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    
    try {
      await fs.access(projectsDir);
    } catch {
      return NextResponse.json({ 
        totalProjects: 0,
        totalConversations: 0,
        totalMessages: 0,
        totalUserMessages: 0,
        totalAssistantMessages: 0,
        totalToolCalls: 0,
        toolUsageBreakdown: {},
        totalThinkingBlocks: 0,
        averageMessagesPerConversation: 0,
        totalTokensEstimate: 0
      });
    }

    const projectDirs = await fs.readdir(projectsDir);
    const stats: Stats = {
      totalProjects: 0,
      totalConversations: 0,
      totalMessages: 0,
      totalUserMessages: 0,
      totalAssistantMessages: 0,
      totalToolCalls: 0,
      toolUsageBreakdown: {},
      totalThinkingBlocks: 0,
      averageMessagesPerConversation: 0,
      totalTokensEstimate: 0
    };

    // Process all projects
    for (const projectId of projectDirs) {
      const projectPath = path.join(projectsDir, projectId);
      
      try {
        const projectStats = await fs.stat(projectPath);
        if (!projectStats.isDirectory()) continue;
        
        stats.totalProjects++;
        
        // Read all conversation files
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
        
        for (const file of jsonlFiles) {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) continue;
          
          stats.totalConversations++;
          
          // Process each line
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'user') {
                stats.totalMessages++;
                stats.totalUserMessages++;
                
                // Count tool results from user messages
                if (data.message?.content && Array.isArray(data.message.content)) {
                  data.message.content.forEach((item: any) => {
                    if (item.type === 'tool_result') {
                      // This is counted as part of the conversation flow, not a new tool call
                    }
                  });
                }
              } else if (data.type === 'assistant') {
                stats.totalMessages++;
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
              } else if (data.type === 'system') {
                stats.totalMessages++;
              }
              
              // Rough token estimate (4 chars = 1 token approximation)
              const messageText = JSON.stringify(data);
              stats.totalTokensEstimate += Math.ceil(messageText.length / 4);
              
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      } catch (error) {
        console.error(`Error processing project ${projectId}:`, error);
      }
    }
    
    // Calculate averages
    stats.averageMessagesPerConversation = stats.totalConversations > 0 
      ? Math.round(stats.totalMessages / stats.totalConversations) 
      : 0;
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to calculate stats' }, { status: 500 });
  }
}