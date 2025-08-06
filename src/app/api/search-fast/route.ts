import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import * as readline from 'readline';
import path from 'path';
import os from 'os';
import { ConversationMessage } from '@/lib/types';
import { decodeProjectPath } from '@/lib/path-utils';

interface QuickSearchResult {
  projectId: string;
  projectName: string;
  conversationId: string;
  matchCount: number;
  firstMatches: Array<{
    uuid: string;
    type: string;
    content: string;
    lineNumber: number;
  }>;
  summary: string;
}

// Quick search that only reads lines containing the query
async function quickSearchProject(projectPath: string, projectId: string, query: string, mode: 'exact' | 'regex' = 'exact'): Promise<QuickSearchResult[]> {
  const files = await fs.readdir(projectPath);
  const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
  const results: QuickSearchResult[] = [];
  
  // Get project name
  let projectName = decodeProjectPath(projectId);
  try {
    const projectInfoPath = path.join(projectPath, 'project.json');
    const projectData = await fs.readFile(projectInfoPath, 'utf-8');
    const projectInfo = JSON.parse(projectData);
    projectName = projectInfo.name || decodeProjectPath(projectId);
  } catch {}
  
  const queryLower = query.toLowerCase();
  let queryTokens: string[] = [];
  
  if (mode === 'exact') {
    // For exact mode, treat the entire query as one token
    queryTokens = [queryLower.trim()];
  } else {
    // For regex mode (partial match), split into tokens
    queryTokens = queryLower.split(/\b/).filter(token => token.trim().length > 0 && /\w/.test(token));
  }
  
  // Search each conversation file
  await Promise.all(jsonlFiles.map(async (file) => {
    try {
      const filePath = path.join(projectPath, file);
      const conversationId = path.basename(file, '.jsonl');
      const matches: QuickSearchResult['firstMatches'] = [];
      
      let summary = null;
      let matchCount = 0;
      
      // Use streaming to read file
      const fileStream = fsSync.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      let i = 0;
      for await (const line of rl) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          i++;
          continue;
        }
        
        try {
          const data = JSON.parse(trimmedLine);
          
          // Capture summary if present
          if (i === 0 && (data.type === 'conversation.summary' || data.type === 'summary')) {
            summary = data;
          }
          
          // Only search user/assistant/system messages
          if (data.type !== 'user' && data.type !== 'assistant' && data.type !== 'system') {
            i++;
            continue;
          }
          
          // Extract text content
          let text = '';
          if (data.type === 'system' && data.content) {
            text = data.content;
          } else if (data.message?.content) {
            if (typeof data.message.content === 'string') {
              text = data.message.content;
            } else if (Array.isArray(data.message.content)) {
              text = data.message.content
                .filter((item: any) => item.type === 'text' && item.text)
                .map((item: any) => item.text)
                .join(' ');
            }
          }
          
          if (!text) {
            i++;
            continue;
          }
          
          // Check if all query tokens are present
          const textLower = text.toLowerCase();
          let hasAllTokens = false;
          
          if (mode === 'exact') {
            // For exact mode, check for exact phrase match with word boundaries
            const escapedQuery = queryTokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const exactRegex = new RegExp(`\\b${escapedQuery}\\b`, 'i');
            hasAllTokens = exactRegex.test(text);
          } else {
            // For regex mode, check if all tokens are present
            hasAllTokens = queryTokens.every(token => textLower.includes(token));
          }
          
          if (hasAllTokens) {
            matchCount++;
            
            if (matches.length < 3) {
              // Extract a preview around the match
              const firstTokenIndex = textLower.indexOf(queryTokens[0]);
              const start = Math.max(0, firstTokenIndex - 50);
              const end = Math.min(text.length, firstTokenIndex + 150);
              const preview = text.substring(start, end);
              
              matches.push({
                uuid: data.uuid,
                type: data.type,
                content: (start > 0 ? '...' : '') + preview + (end < text.length ? '...' : ''),
                lineNumber: i
              });
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
        
        i++;
      }
      
      if (matchCount > 0) {
        results.push({
          projectId,
          projectName,
          conversationId,
          matchCount,
          firstMatches: matches,
          summary: summary?.summary || `Conversation ${conversationId.substring(0, 8)}...`
        });
      }
    } catch (error) {
      console.error(`Error searching file ${file}:`, error);
    }
  }));
  
  return results;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const mode = (searchParams.get('mode') || 'exact') as 'exact' | 'regex';
    
    if (!query || !query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    
    try {
      await fs.access(projectsDir);
    } catch {
      return NextResponse.json({ results: [] });
    }

    const projectDirs = await fs.readdir(projectsDir);
    
    // Search all projects in parallel
    const searchPromises = projectDirs.map(async (projectId) => {
      const projectPath = path.join(projectsDir, projectId);
      try {
        const projectStats = await fs.stat(projectPath);
        if (!projectStats.isDirectory()) return [];
        
        return await quickSearchProject(projectPath, projectId, query, mode);
      } catch (error) {
        console.error(`Error searching project ${projectId}:`, error);
        return [];
      }
    });
    
    const projectResults = await Promise.all(searchPromises);
    const allResults = projectResults.flat();
    
    // Sort by match count
    allResults.sort((a, b) => b.matchCount - a.matchCount);
    
    // Convert to expected format and limit
    const formattedResults = allResults.slice(0, 50).map(result => ({
      project: {
        id: result.projectId,
        name: result.projectName
      },
      conversation: {
        id: result.conversationId,
        summary: { summary: result.summary },
        messageCount: 0, // We don't know without loading full file
        lastUpdated: new Date().toISOString(),
        projectId: result.projectId
      },
      matchingMessages: result.firstMatches.map(match => ({
        uuid: match.uuid,
        type: match.type,
        timestamp: new Date().toISOString(),
        content: match.content
      })),
      matchCount: result.matchCount
    }));
    
    return NextResponse.json({ 
      results: formattedResults,
      totalMatches: allResults.reduce((sum, r) => sum + r.matchCount, 0),
      totalConversations: allResults.length,
      limited: allResults.length > 50
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}