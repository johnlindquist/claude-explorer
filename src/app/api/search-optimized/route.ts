import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Conversation, ConversationMessage } from '@/lib/types';
import { OptimizedProjectSearchIndex, SearchResult } from '@/lib/project-search-index-optimized';

// Cache for search indices (in-memory for now)
const indexCache = new Map<string, { index: OptimizedProjectSearchIndex, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getProjectIndex(projectId: string, projectPath: string): Promise<OptimizedProjectSearchIndex | null> {
  try {
    // Check cache first
    const cached = indexCache.get(projectId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.index;
    }

    // Read all conversation files
    const files = await fs.readdir(projectPath);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) return null;
    
    const conversations: Conversation[] = [];
    
    // Parse each conversation file (minimal parsing for index)
    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) continue;
      
      const messages: ConversationMessage[] = [];
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === 'user' || data.type === 'assistant' || data.type === 'system') {
            messages.push(data);
          }
        } catch (e) {
          // Skip invalid lines
        }
      }
      
      conversations.push({
        id: path.basename(file, '.jsonl'),
        summary: { type: 'summary', summary: '', leafUuid: '' }, // Dummy for indexing
        messages,
        messageCount: messages.length,
        lastUpdated: new Date().toISOString(),
        projectId
      });
    }
    
    // Build index
    const index = new OptimizedProjectSearchIndex();
    await index.buildIndex(conversations);
    
    // Cache it
    indexCache.set(projectId, { index, timestamp: Date.now() });
    
    return index;
  } catch (error) {
    console.error(`Error building index for project ${projectId}:`, error);
    return null;
  }
}

async function loadConversationDetails(projectPath: string, conversationId: string, matchingMessageIds: Set<string>) {
  try {
    const filePath = path.join(projectPath, `${conversationId}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let summary = null;
    let startIndex = 0;
    
    // Parse summary
    if (lines.length > 0) {
      try {
        const firstLine = JSON.parse(lines[0]);
        if (firstLine.type === 'conversation.summary' || firstLine.type === 'summary') {
          summary = firstLine;
          startIndex = 1;
        }
      } catch {}
    }
    
    // If no summary, create one
    if (!summary) {
      summary = {
        type: 'conversation.summary',
        summary: 'Conversation ' + conversationId.substring(0, 8),
        timestamp: new Date().toISOString()
      };
    }
    
    // Parse only the matching messages
    const matchingMessages: ConversationMessage[] = [];
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const data = JSON.parse(lines[i]);
        if ((data.type === 'user' || data.type === 'assistant' || data.type === 'system') && matchingMessageIds.has(data.uuid)) {
          matchingMessages.push(data);
        }
      } catch {}
    }
    
    return {
      id: conversationId,
      summary,
      matchingMessages,
      messageCount: lines.length - startIndex
    };
  } catch (error) {
    console.error(`Error loading conversation ${conversationId}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const timings: Record<string, number> = {};
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query || !query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    
    try {
      await fs.access(projectsDir);
    } catch {
      return NextResponse.json({ results: [] });
    }

    timings.setup = Date.now() - startTime;
    const readDirStart = Date.now();
    const projectDirs = await fs.readdir(projectsDir);
    timings.readDir = Date.now() - readDirStart;
    
    // Search all projects in parallel
    const searchPromises = projectDirs.map(async (projectId) => {
      const projectPath = path.join(projectsDir, projectId);
      
      try {
        const projectStats = await fs.stat(projectPath);
        if (!projectStats.isDirectory()) return [];
        
        // Get or build search index
        const index = await getProjectIndex(projectId, projectPath);
        if (!index) return [];
        
        // Search for matching conversation IDs only
        const searchResults = index.searchForIds(query);
        if (searchResults.length === 0) return [];
        
        // Read project info
        let projectName = projectId;
        try {
          const projectInfoPath = path.join(projectPath, 'project.json');
          const projectData = await fs.readFile(projectInfoPath, 'utf-8');
          const projectInfo = JSON.parse(projectData);
          projectName = projectInfo.name || projectId;
        } catch {}
        
        // Load only the matching conversations
        const conversationPromises = searchResults.map(async (result) => {
          const details = await loadConversationDetails(projectPath, result.conversationId, result.matchingMessageIds);
          if (!details) return null;
          
          return {
            project: { id: projectId, name: projectName },
            conversation: {
              id: details.id,
              summary: details.summary,
              messageCount: details.messageCount,
              lastUpdated: (details.summary as any).timestamp || new Date().toISOString(),
              projectId
            },
            matchingMessages: details.matchingMessages.slice(0, 3).map(msg => ({
              uuid: msg.uuid,
              type: msg.type,
              timestamp: msg.timestamp,
              content: msg.message?.content || msg.content || ''
            })),
            matchCount: result.matchCount
          };
        });
        
        const conversationResults = await Promise.all(conversationPromises);
        return conversationResults.filter(r => r !== null);
        
      } catch (error) {
        console.error(`Error searching project ${projectId}:`, error);
        return [];
      }
    });
    
    // Wait for all searches to complete
    const allResultArrays = await Promise.all(searchPromises);
    const allResults = allResultArrays.flat();
    
    // Sort by match count
    allResults.sort((a, b) => b.matchCount - a.matchCount);
    
    // Limit results
    const limitedResults = allResults.slice(0, 50);
    
    return NextResponse.json({ 
      results: limitedResults,
      totalMatches: allResults.reduce((sum, r) => sum + r.matchCount, 0),
      totalConversations: allResults.length,
      limited: allResults.length > 50
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}