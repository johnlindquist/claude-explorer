import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import * as readline from 'readline';
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
        
        // Try to read cached stats first
        const cachePath = path.join(projectPath, '.stats_cache.json');
        let projectData = null;
        
        try {
          const cacheStats = await fs.stat(cachePath);
          if (cacheStats.mtimeMs >= projectStats.mtimeMs) {
            const cachedData = await fs.readFile(cachePath, 'utf-8');
            projectData = JSON.parse(cachedData);
          }
        } catch {
          // Cache doesn't exist or is invalid
        }
        
        if (projectData) {
          // Aggregate cached data
          stats.totalConversations += projectData.totalConversations || 0;
          stats.totalMessages += projectData.totalMessages || 0;
          stats.totalUserMessages += projectData.totalUserMessages || 0;
          stats.totalAssistantMessages += projectData.totalAssistantMessages || 0;
          stats.totalToolCalls += projectData.totalToolCalls || 0;
          stats.totalThinkingBlocks += projectData.totalThinkingBlocks || 0;
          stats.totalTokensEstimate += projectData.totalTokensEstimate || 0;
          
          // Merge tool usage breakdown
          if (projectData.toolUsageBreakdown) {
            Object.entries(projectData.toolUsageBreakdown).forEach(([tool, count]) => {
              stats.toolUsageBreakdown[tool] = (stats.toolUsageBreakdown[tool] || 0) + (count as number);
            });
          }
        } else {
          // Fallback to reading files if no cache
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
            
            let hasContent = false;
            
            // Process each line
            for await (const line of rl) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              
              hasContent = true;
              
              try {
                const data = JSON.parse(trimmedLine);
                
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
            
            if (hasContent) {
              stats.totalConversations++;
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