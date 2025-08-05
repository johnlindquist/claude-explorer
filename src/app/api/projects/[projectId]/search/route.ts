import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Conversation } from '@/lib/types';
import { FastProjectSearchIndex } from '@/lib/project-search-index-fast';
import { parseConversationStream } from '@/lib/server/conversation-parser';
import { decodeProjectPath } from '@/lib/path-utils';

// Cache for search indices with TTL
const indexCache = new Map<string, { index: FastProjectSearchIndex, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query || !query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const projectId = params.projectId;
    const projectPath = path.join(os.homedir(), '.claude', 'projects', projectId);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check cache first
    const cached = indexCache.get(projectId);
    let index: FastProjectSearchIndex;
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      index = cached.index;
    } else {
      // Build new index
      const files = await fs.readdir(projectPath);
      const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        return NextResponse.json({ results: [] });
      }
      
      // Load all conversations using our centralized parser
      const conversations: Conversation[] = [];
      
      await Promise.all(jsonlFiles.map(async (file) => {
        try {
          const filePath = path.join(projectPath, file);
          const conversation = await parseConversationStream(filePath);
          conversation.projectId = projectId;
          conversations.push(conversation);
        } catch (error) {
          console.error(`Error parsing ${file}:`, error);
        }
      }));
      
      // Build search index
      index = new FastProjectSearchIndex();
      await index.buildIndex(conversations);
      
      // Cache it
      indexCache.set(projectId, { index, timestamp: Date.now() });
    }
    
    // Perform search
    const searchResults = index.search(query);
    
    // Get project name
    let projectName = decodeProjectPath(projectId);
    try {
      const projectInfoPath = path.join(projectPath, 'project.json');
      const projectData = await fs.readFile(projectInfoPath, 'utf-8');
      const projectInfo = JSON.parse(projectData);
      projectName = projectInfo.name || decodeProjectPath(projectId);
    } catch {}
    
    // Format results for frontend (limit data sent)
    const formattedResults = searchResults.map(result => ({
      project: {
        id: projectId,
        name: projectName
      },
      conversation: {
        id: result.conversation.id,
        summary: result.conversation.summary,
        messageCount: result.conversation.messageCount,
        lastUpdated: result.conversation.lastUpdated,
        projectId: result.conversation.projectId
      },
      matchingMessages: result.matchingMessages.slice(0, 3).map(msg => ({
        uuid: msg.uuid,
        type: msg.type,
        timestamp: msg.timestamp,
        content: msg.message?.content || msg.content || ''
      })),
      matchCount: result.matchCount
    }));
    
    return NextResponse.json({ 
      results: formattedResults,
      indexStats: index.getStats()
    });
  } catch (error) {
    console.error('Project search error:', error);
    return NextResponse.json({ error: 'Failed to search project' }, { status: 500 });
  }
}