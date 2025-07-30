import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Project } from "@/lib/types";

export async function GET() {
  try {
    const homeDir = os.homedir();
    const projectsDir = path.join(homeDir, ".claude", "projects");
    
    console.log("Reading projects from:", projectsDir);
    
    // Check if the projects directory exists
    try {
      await fs.access(projectsDir);
    } catch (error) {
      console.error("Projects directory not found:", projectsDir);
      return NextResponse.json([]);
    }
    
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const projects: Project[] = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(projectsDir, entry.name);
        
        let conversationCount = 0;
        let lastModified = new Date().toISOString();
        
        // Try to count conversations directly in project directory
        try {
          const files = await fs.readdir(projectPath);
          conversationCount = files.filter(f => f.endsWith('.jsonl')).length;
          
          // Get last modified time
          const stats = await fs.stat(projectPath);
          lastModified = stats.mtime.toISOString();
        } catch (e) {
          console.error(`Error reading project ${entry.name}:`, e);
        }
        
        projects.push({
          id: entry.name,
          name: entry.name,
          path: projectPath,
          conversationCount,
          lastModified
        });
      }
    }
    
    // Sort by last modified date
    projects.sort((a, b) => 
      new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime()
    );
    
    console.log("Found projects:", projects.map(p => p.name));
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error reading projects:', error);
    return NextResponse.json(
      { error: 'Failed to read projects' },
      { status: 500 }
    );
  }
}