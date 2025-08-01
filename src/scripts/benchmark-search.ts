import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { performance } from 'perf_hooks';
import { ProjectSearchIndex } from '../lib/project-search-index';
import { OptimizedProjectSearchIndex } from '../lib/project-search-index-optimized';
import { Conversation, ConversationMessage } from '../lib/types';

async function loadConversations(projectPath: string): Promise<Conversation[]> {
  const files = await fs.readdir(projectPath);
  const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
  const conversations: Conversation[] = [];
  
  for (const file of jsonlFiles) {
    const filePath = path.join(projectPath, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) continue;
    
    const messages: ConversationMessage[] = [];
    let startIndex = 0;
    let summary = null;
    
    // Parse first line for summary
    try {
      const firstLine = JSON.parse(lines[0]);
      if (firstLine.type === 'conversation.summary' || firstLine.type === 'summary') {
        summary = firstLine;
        startIndex = 1;
      }
    } catch {}
    
    // Parse messages
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const data = JSON.parse(lines[i]);
        if (data.type === 'user' || data.type === 'assistant' || data.type === 'system') {
          messages.push(data);
        }
      } catch {}
    }
    
    if (!summary) {
      summary = {
        type: 'conversation.summary',
        summary: 'Conversation ' + file.substring(0, 8),
        timestamp: new Date().toISOString()
      };
    }
    
    conversations.push({
      id: path.basename(file, '.jsonl'),
      summary,
      messages,
      messageCount: messages.length,
      lastUpdated: summary.timestamp || new Date().toISOString(),
      projectId: path.basename(projectPath)
    });
  }
  
  return conversations;
}

async function benchmarkSearch() {
  console.log('Starting search benchmark...\n');
  
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  const projectDirs = await fs.readdir(projectsDir);
  
  // Test queries
  const queries = ['agent', 'claude', 'search', 'typescript', 'error'];
  
  // Benchmark original implementation
  console.log('=== Original Implementation ===');
  for (const query of queries) {
    console.log(`\nSearching for "${query}":`);
    
    const startTotal = performance.now();
    let totalMatches = 0;
    let projectCount = 0;
    
    for (const projectId of projectDirs) {
      const projectPath = path.join(projectsDir, projectId);
      try {
        const projectStats = await fs.stat(projectPath);
        if (!projectStats.isDirectory()) continue;
        
        const startLoad = performance.now();
        const conversations = await loadConversations(projectPath);
        const loadTime = performance.now() - startLoad;
        
        if (conversations.length === 0) continue;
        
        const startIndex = performance.now();
        const searchIndex = new ProjectSearchIndex();
        await searchIndex.buildIndex(conversations);
        const indexTime = performance.now() - startIndex;
        
        const startSearch = performance.now();
        const results = searchIndex.search(query);
        const searchTime = performance.now() - startSearch;
        
        if (results.length > 0) {
          projectCount++;
          totalMatches += results.reduce((sum, r) => sum + r.matchCount, 0);
          console.log(`  ${projectId}: ${results.length} conversations, ${results.reduce((sum, r) => sum + r.matchCount, 0)} matches`);
          console.log(`    Load: ${loadTime.toFixed(2)}ms, Index: ${indexTime.toFixed(2)}ms, Search: ${searchTime.toFixed(2)}ms`);
        }
      } catch (error) {
        console.error(`Error in project ${projectId}:`, error);
      }
    }
    
    const totalTime = performance.now() - startTotal;
    console.log(`Total: ${totalTime.toFixed(2)}ms for ${projectCount} projects with ${totalMatches} matches`);
  }
  
  // Benchmark optimized implementation
  console.log('\n\n=== Optimized Implementation ===');
  
  // Pre-build indices
  const indices = new Map<string, OptimizedProjectSearchIndex>();
  console.log('\nPre-building indices...');
  const startPreBuild = performance.now();
  
  for (const projectId of projectDirs) {
    const projectPath = path.join(projectsDir, projectId);
    try {
      const projectStats = await fs.stat(projectPath);
      if (!projectStats.isDirectory()) continue;
      
      const conversations = await loadConversations(projectPath);
      if (conversations.length === 0) continue;
      
      const index = new OptimizedProjectSearchIndex();
      await index.buildIndex(conversations);
      indices.set(projectId, index);
    } catch {}
  }
  
  const preBuildTime = performance.now() - startPreBuild;
  console.log(`Pre-build completed in ${preBuildTime.toFixed(2)}ms for ${indices.size} projects`);
  
  // Test with pre-built indices
  for (const query of queries) {
    console.log(`\nSearching for "${query}":`);
    
    const startTotal = performance.now();
    let totalMatches = 0;
    let projectCount = 0;
    
    for (const [projectId, index] of indices) {
      const startSearch = performance.now();
      const results = index.searchForIds(query);
      const searchTime = performance.now() - startSearch;
      
      if (results.length > 0) {
        projectCount++;
        totalMatches += results.reduce((sum, r) => sum + r.matchCount, 0);
        console.log(`  ${projectId}: ${results.length} conversations, ${results.reduce((sum, r) => sum + r.matchCount, 0)} matches in ${searchTime.toFixed(2)}ms`);
      }
    }
    
    const totalTime = performance.now() - startTotal;
    console.log(`Total: ${totalTime.toFixed(2)}ms for ${projectCount} projects with ${totalMatches} matches`);
  }
}

benchmarkSearch().catch(console.error);