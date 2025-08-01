import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ConversationMessage } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    
    // Search for the conversation file across all projects
    let conversationPath: string | null = null;
    let projectId: string | null = null;
    
    const projectDirs = await fs.readdir(projectsDir);
    
    for (const projId of projectDirs) {
      const projPath = path.join(projectsDir, projId);
      const conversationFile = path.join(projPath, `${params.id}.jsonl`);
      
      try {
        await fs.access(conversationFile);
        conversationPath = conversationFile;
        projectId = projId;
        break;
      } catch {
        // Continue searching
      }
    }
    
    if (!conversationPath) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const stats = {
      conversationId: params.id,
      projectId,
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      toolCalls: 0,
      toolCallsByType: {} as Record<string, number>,
      thinkingBlocks: 0,
      totalTokensEstimate: 0,
      sidechainMessages: 0,
      messageTimeline: [] as Array<{ hour: number; count: number }>,
      averageResponseTime: 0,
      uniqueModels: new Set<string>(),
      errorCount: 0
    };
    
    // Initialize hourly timeline
    for (let i = 0; i < 24; i++) {
      stats.messageTimeline[i] = { hour: i, count: 0 };
    }
    
    // Read and parse conversation
    const content = await fs.readFile(conversationPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let lastUserTimestamp: Date | null = null;
    const responseTimes: number[] = [];
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        
        if (data.type === 'user' || data.type === 'assistant' || data.type === 'system') {
          stats.totalMessages++;
          
          // Track hourly activity
          const hour = new Date(data.timestamp).getHours();
          stats.messageTimeline[hour].count++;
          
          // Estimate tokens
          const messageText = JSON.stringify(data);
          stats.totalTokensEstimate += Math.ceil(messageText.length / 4);
        }
        
        if (data.type === 'user') {
          stats.userMessages++;
          lastUserTimestamp = new Date(data.timestamp);
          
          if (data.isSidechain) {
            stats.sidechainMessages++;
          }
        } else if (data.type === 'assistant') {
          stats.assistantMessages++;
          
          if (data.isSidechain) {
            stats.sidechainMessages++;
          }
          
          // Track response time
          if (lastUserTimestamp) {
            const responseTime = new Date(data.timestamp).getTime() - lastUserTimestamp.getTime();
            responseTimes.push(responseTime);
          }
          
          // Track model usage
          if (data.message?.model) {
            stats.uniqueModels.add(data.message.model);
          }
          
          // Count tools and thinking blocks
          if (data.message?.content && Array.isArray(data.message.content)) {
            data.message.content.forEach((item: any) => {
              if (item.type === 'tool_use') {
                stats.toolCalls++;
                const toolName = item.name || 'unknown';
                stats.toolCallsByType[toolName] = (stats.toolCallsByType[toolName] || 0) + 1;
              } else if (item.type === 'thinking') {
                stats.thinkingBlocks++;
              } else if (item.type === 'tool_result' && item.is_error) {
                stats.errorCount++;
              }
            });
          }
        } else if (data.type === 'system') {
          stats.systemMessages++;
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
    
    // Calculate average response time
    if (responseTimes.length > 0) {
      const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      stats.averageResponseTime = Math.round(avgMs / 1000); // Convert to seconds
    }
    
    return NextResponse.json({
      ...stats,
      uniqueModels: Array.from(stats.uniqueModels)
    });
  } catch (error) {
    console.error('Conversation stats error:', error);
    return NextResponse.json({ error: 'Failed to calculate stats' }, { status: 500 });
  }
}