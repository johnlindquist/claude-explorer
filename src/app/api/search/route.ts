import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Conversation, Project } from '@/lib/types';
import { ProjectSearchIndex } from '@/lib/project-search-index';

export async function GET(request: NextRequest) {
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

    const projectDirs = await fs.readdir(projectsDir);
    const allResults = [];

    // Search across all projects
    for (const projectId of projectDirs) {
      const projectPath = path.join(projectsDir, projectId);
      const projectInfoPath = path.join(projectPath, 'project.json');
      
      try {
        const projectStats = await fs.stat(projectPath);
        if (!projectStats.isDirectory()) continue;
        
        // Read project info
        let projectName = projectId;
        try {
          const projectData = await fs.readFile(projectInfoPath, 'utf-8');
          const projectInfo = JSON.parse(projectData);
          projectName = projectInfo.name || projectId;
        } catch {
          // Continue with directory name if project.json doesn't exist
        }

        // Read conversations
        const conversationsPath = path.join(projectPath, 'conversations.jsonl');
        const conversationData = await fs.readFile(conversationsPath, 'utf-8');
        const conversations: Conversation[] = conversationData
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));

        if (conversations.length === 0) continue;

        // Build search index for this project
        const searchIndex = new ProjectSearchIndex();
        await searchIndex.buildIndex(conversations);
        
        // Search
        const searchResults = searchIndex.search(query);
        
        // Add project info to results
        searchResults.forEach(result => {
          allResults.push({
            project: {
              id: projectId,
              name: projectName,
            },
            conversation: result.conversation,
            matchingMessages: result.matchingMessages,
            matchCount: result.matchCount,
          });
        });
        
      } catch (error) {
        console.error(`Error searching project ${projectId}:`, error);
        continue;
      }
    }

    // Sort by match count
    allResults.sort((a, b) => b.matchCount - a.matchCount);

    return NextResponse.json({ 
      results: allResults,
      totalMatches: allResults.reduce((sum, r) => sum + r.matchCount, 0),
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}