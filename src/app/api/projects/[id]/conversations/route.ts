import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Conversation, ConversationMessage } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("Getting conversations for project:", params.id);
    const homeDir = os.homedir();
    const projectPath = path.join(homeDir, ".claude", "projects", params.id);
    console.log("Project path:", projectPath);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    // Read JSONL files directly from project directory
    const files = await fs.readdir(projectPath);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    console.log("Found JSONL files:", jsonlFiles.length);
    
    const conversations: Conversation[] = [];
    
    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) continue;
      
      try {
        const firstLine = JSON.parse(lines[0]);
        console.log("First line type:", firstLine.type, "for file:", file);
        
        let summary = null;
        let startIndex = 0;
        
        // Check if first line is a summary
        if (firstLine.type === 'conversation.summary' || firstLine.type === 'summary') {
          summary = firstLine;
          startIndex = 1;
        } else {
          // No summary, create a basic one
          summary = {
            type: 'conversation.summary',
            summary: 'Conversation ' + file.substring(0, 8),
            timestamp: firstLine.timestamp || new Date().toISOString()
          };
          startIndex = 0;
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
          
          const conversation: Conversation = {
            id: path.basename(file, '.jsonl'),
            summary: summary,
            messages,
            messageCount: messages.length,
            lastUpdated: summary.timestamp || messages[messages.length - 1]?.timestamp || new Date().toISOString(),
            projectId: params.id
          };
          
        conversations.push(conversation);
      } catch (e) {
        console.error(`Error parsing ${file}:`, e);
      }
    }
    
    // Sort by last updated, most recent first
    conversations.sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error reading conversations:', error);
    return NextResponse.json(
      { error: 'Failed to read conversations' },
      { status: 500 }
    );
  }
}