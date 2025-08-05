import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import * as readline from 'readline';
import path from 'path';
import os from 'os';

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectPath = path.join(os.homedir(), '.claude', 'projects', params.projectId);
    const cachePath = path.join(projectPath, '.stats_cache.json');
    
    try {
      await fs.access(projectPath);
    } catch {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Check cache validity
    try {
      const projectStat = await fs.stat(projectPath);
      const cacheStat = await fs.stat(cachePath);
      
      // If cache is newer than or equal to project directory, use it
      if (cacheStat.mtimeMs >= projectStat.mtimeMs) {
        const cachedData = await fs.readFile(cachePath, 'utf-8');
        return NextResponse.json(JSON.parse(cachedData));
      }
    } catch {
      // Cache doesn't exist or error reading it, continue to calculate
    }
    
    const stats = {
      projectId: params.projectId,
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
      
      // Use streaming to read file
      const fileStream = fsSync.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      stats.totalConversations++;
      let conversationMessageCount = 0;
      let hasContent = false;
      
      // Process each line
      for await (const line of rl) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        hasContent = true;
        
        try {
          const data = JSON.parse(trimmedLine);
          
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
      
      // Decrement if file was empty
      if (!hasContent) {
        stats.totalConversations--;
        continue;
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
    
    // Write stats to cache
    try {
      await fs.writeFile(cachePath, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to write stats cache:', error);
      // Continue without failing the request
    }
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Project stats error:', error);
    return NextResponse.json({ error: 'Failed to calculate stats' }, { status: 500 });
  }
}