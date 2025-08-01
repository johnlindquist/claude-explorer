"use client";

import { useEffect, useState, useCallback } from "react";
import { Project, Conversation } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import { cn } from "@/lib/utils";
import { highlightSearchTerms, extractMessageText } from "@/lib/highlight-utils";

interface SearchResult {
  project: {
    id: string;
    name: string;
  };
  conversation: {
    id: string;
    summary: any;
    messageCount: number;
    lastUpdated: string;
    projectId: string;
  };
  matchingMessages: Array<{
    uuid: string;
    type: string;
    timestamp: string;
    content: any;
  }>;
  matchCount: number;
}

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDuration, setSearchDuration] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load projects");
        return res.json();
      })
      .then(data => {
        setProjects(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleProjectSelect = (project: Project) => {
    router.push(`/project/${encodeURIComponent(project.id)}`);
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchDuration(null);
      setSearchQuery("");
      return;
    }

    setSearching(true);
    setSearchQuery(query);
    const startTime = performance.now();

    try {
      const response = await fetch(`/api/search-fast?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      
      const data = await response.json();
      setSearchResults(data.results || []);
      
      const endTime = performance.now();
      setSearchDuration(endTime - startTime);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="p-4 text-center text-muted-foreground">
            Loading projects...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="p-4 text-center text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Conversation Visualizer</h1>
        
        {/* Global Search Bar */}
        <div className="mb-8">
          <SearchBar 
            onSearch={handleSearch}
            placeholder="Search across all projects and conversations..."
            className="w-full max-w-3xl mx-auto"
          />
          {searchDuration !== null && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              {searching ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                  Searching across all projects...
                </span>
              ) : (
                <>
                  Found {searchResults.length} conversations with matches in {searchDuration.toFixed(2)}ms
                  {searchResults.length > 0 && (
                    <span> ({searchResults.reduce((sum, r) => sum + r.matchCount, 0)} total matches)</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Search Results</h2>
            <div className="grid gap-4">
              {searchResults.map((result, idx) => {
                const searchParams = new URLSearchParams({
                  q: searchQuery,
                  highlight: result.matchingMessages[0]?.uuid || ''
                });
                
                return (
                  <Link
                    key={`${result.project.id}-${result.conversation.id}-${idx}`}
                    href={`/project/${result.project.id}/conversation/${result.conversation.id}?${searchParams.toString()}`}
                    className="bg-card rounded-lg shadow-sm hover:shadow-md transition-all p-6 block border"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground mb-1">
                          {result.project.name}
                        </div>
                        <h3 className="text-lg font-semibold">
                          {result.conversation.summary.summary}
                        </h3>
                      </div>
                      <div className="text-sm text-muted-foreground ml-4 text-right">
                        <div className="text-primary font-medium">{result.matchCount} matches</div>
                      </div>
                    </div>
                    
                    {/* Show preview of matching messages */}
                    {result.matchingMessages.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="space-y-1">
                          {result.matchingMessages.slice(0, 2).map((msg, msgIdx) => {
                            const text = extractMessageText(msg);
                            const preview = text.slice(0, 150) + (text.length > 150 ? '...' : '');
                            const highlightedPreview = highlightSearchTerms(preview, searchQuery);
                            
                            return (
                              <div key={msgIdx} className="text-xs bg-muted/50 p-2 rounded">
                                <span className="font-medium">{msg.type}:</span>{' '}
                                <span dangerouslySetInnerHTML={{ __html: highlightedPreview }} />
                              </div>
                            );
                          })}
                          {result.matchCount > 2 && (
                            <p className="text-xs text-muted-foreground">
                              ...and {result.matchCount - 2} more match{result.matchCount - 2 !== 1 ? 'es' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !searching && (
          <div className="mb-8 text-center text-muted-foreground">
            No conversations found matching &quot;{searchQuery}&quot;
          </div>
        )}
        
        {/* Project List */}
        {(!searchQuery || searchResults.length === 0) && (
          <>
            {projects.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No projects found in ~/.claude/projects
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4">Select a Project</h2>
                <div className="grid gap-3">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSelect(project)}
                      className="text-left p-4 rounded-lg border transition-all hover:shadow-md hover:border-primary/50 bg-card border-border"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-lg">{project.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {project.conversationCount || 0} conversations
                          </p>
                        </div>
                        {project.lastModified && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(project.lastModified).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}