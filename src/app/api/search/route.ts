import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Conversation, ConversationMessage, Project } from '@/lib/types';
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

        // Read conversations from individual JSONL files
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
        
        const conversations: Conversation[] = [];
        
        // Parse each conversation file
        for (const file of jsonlFiles) {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          
          if (lines.length === 0) continue;
          
          try {
            const firstLine = JSON.parse(lines[0]);
            
            let summary = null;
            let startIndex = 0;
            
            // Check if first line is a summary
            if (firstLine.type === 'conversation.summary' || firstLine.type === 'summary') {
              summary = firstLine;
              startIndex = 1;
              
              // Handle edge case: multiple summary lines
              while (startIndex < lines.length) {
                try {
                  const nextLine = JSON.parse(lines[startIndex]);
                  if (nextLine.type === 'summary' || nextLine.type === 'conversation.summary') {
                    summary = nextLine;
                    startIndex++;
                  } else {
                    break;
                  }
                } catch {
                  break;
                }
              }
            }
            
            const messages: ConversationMessage[] = [];
            let sideChainDepth = 0;
            
            for (let i = startIndex; i < lines.length; i++) {
              try {
                const data = JSON.parse(lines[i]);
                
                if (data.type === 'user' || data.type === 'assistant') {
                  messages.push({
                    ...data,
                    isSidechain: sideChainDepth > 0
                  });
                } else if (data.type === 'sidechain.start') {
                  sideChainDepth++;
                } else if (data.type === 'sidechain.end') {
                  sideChainDepth = Math.max(0, sideChainDepth - 1);
                } else if (data.type === 'system') {
                  messages.push({
                    uuid: data.uuid,
                    timestamp: data.timestamp,
                    type: 'system',
                    content: data.content || '',
                    metadata: data.metadata
                  });
                }
              } catch (e) {
                console.error(`Error parsing line ${i} in ${file}:`, e);
              }
            }
            
            // Create summary if we didn't have one
            if (!summary) {
              const firstUserMessage = messages.find(m => m.type === 'user');
              let summaryText = 'Conversation ' + file.substring(0, 8);
              
              if (firstUserMessage) {
                const content = firstUserMessage.message?.content;
                if (typeof content === 'string' && content.trim()) {
                  summaryText = content.trim().length > 50 
                    ? content.trim().substring(0, 50) + '...'
                    : content.trim();
                } else if (Array.isArray(content)) {
                  const textContent = content.find(item => item.type === 'text' && item.text);
                  if (textContent && textContent.text) {
                    summaryText = textContent.text.trim().length > 50 
                      ? textContent.text.trim().substring(0, 50) + '...'
                      : textContent.text.trim();
                  }
                }
              }
              
              summary = {
                type: 'conversation.summary',
                summary: summaryText,
                timestamp: firstUserMessage?.timestamp || new Date().toISOString()
              };
            }
            
            const conversation: Conversation = {
              id: path.basename(file, '.jsonl'),
              summary: summary,
              messages,
              messageCount: messages.length,
              lastUpdated: summary.timestamp || messages[messages.length - 1]?.timestamp || new Date().toISOString(),
              projectId: projectId
            };
            
            conversations.push(conversation);
          } catch (e) {
            console.error(`Error parsing ${file}:`, e);
          }
        }

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