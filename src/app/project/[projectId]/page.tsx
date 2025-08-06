"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Conversation, Project } from "@/lib/types";
import Link from "next/link";
import SearchBar, { SearchMode } from "@/components/SearchBar";
import ProjectStatsDisplay from "@/components/ProjectStatsDisplay";
// Removed client-side search index import
import { cn } from "@/lib/utils";
import { highlightSearchTerms, extractMessageText } from "@/lib/highlight-utils";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>('exact');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchDuration, setSearchDuration] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params.projectId) {
      // First load project info
      fetch("/api/projects")
        .then(res => res.json())
        .then((projects: Project[]) => {
          const proj = projects.find(p => p.id === params.projectId);
          if (proj) {
            setProject(proj);
          }
        });

      // Then load conversations
      setLoading(true);
      fetch(`/api/projects/${params.projectId}/conversations`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load conversations");
          return res.json();
        })
        .then(data => {
          setConversations(data);
          setLoading(false);
        })
        .catch(err => {
          setError("Failed to load conversations");
          setLoading(false);
        });
    }
  }, [params.projectId]);

  // Handle search
  const handleSearch = useCallback(async (query: string, mode: SearchMode) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearchDuration(null);
      setSearchQuery("");
      return;
    }
    
    setSearching(true);
    const startTime = performance.now();
    
    try {
      const response = await fetch(`/api/projects/${params.projectId}/search?q=${encodeURIComponent(query)}&mode=${mode}`);
      const data = await response.json();
      setSearchResults(data.results);
      
      const endTime = performance.now();
      setSearchDuration(endTime - startTime);
      setSearchQuery(query);
      setSearchMode(mode);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }, [params.projectId]);

  // Display either search results or all conversations
  const displayConversations = useMemo(() => {
    if (searchResults && searchQuery) {
      return searchResults.map(result => result.conversation);
    }
    return conversations;
  }, [conversations, searchResults, searchQuery]);

  // Determine which items are currently displayed for keyboard nav
  const displayedItems = searchResults && searchQuery ? searchResults : conversations;

  // Keyboard navigation
  const { selectedIndex, reset: resetKeyboardNav } = useKeyboardNavigation({
    itemCount: displayedItems.length,
    isActive: !loading && !searching,
    containerRef: listContainerRef,
    onSelect: (index) => {
      setSelectedItemIndex(index);
    },
    onEnter: (index) => {
      if (searchResults && searchQuery) {
        const result = searchResults[index];
        if (result) {
          const searchParams = new URLSearchParams({
            q: searchQuery,
            highlight: result.matchingMessages[0]?.uuid || ''
          });
          router.push(`/project/${params.projectId}/conversation/${result.conversation.id}?${searchParams.toString()}`);
        }
      } else if (conversations[index]) {
        router.push(`/project/${params.projectId}/conversation/${conversations[index].id}`);
      }
    }
  });

  // Reset keyboard navigation when search results change
  useEffect(() => {
    resetKeyboardNav();
    setSelectedItemIndex(-1);
  }, [searchQuery, searchResults, resetKeyboardNav]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Claude Explorer</h1>
            {project && (
              <>
                <h2 className="text-2xl font-semibold mt-2">{project.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {conversations.length} conversations
                </p>
              </>
            )}
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              ← Change Project
            </Link>
          </div>
          {params.projectId && !loading && (
            <ProjectStatsDisplay 
              projectId={params.projectId as string}
              onConversationClick={(conversationId) => {
                router.push(`/project/${params.projectId}/conversation/${conversationId}`);
              }}
            />
          )}
        </div>
        
        {/* Search Bar */}
        {!loading && !error && conversations.length > 0 && (
          <div className="mb-6">
            <SearchBar 
              onSearch={handleSearch}
              placeholder="Search across all conversations..."
              className="w-full max-w-2xl mx-auto"
            />
            <div className="text-xs text-muted-foreground mt-2 text-center space-y-1">
              {searching && (
                <p className="animate-pulse">Searching {conversations.length} conversations...</p>
              )}
              {searchQuery && searchDuration !== null && (
                <p>
                  Found {searchResults?.length || 0} conversations with matches in {searchDuration.toFixed(2)}ms
                  {searchResults && searchResults.length > 0 && (
                    <span> ({searchResults.reduce((sum, r) => sum + r.matchCount, 0)} total matches)</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
        
        {loading && (
          <div className="text-center text-muted-foreground py-8">
            Loading conversations...
          </div>
        )}
        
        {error && (
          <div className="text-center text-destructive py-8">
            {error}
          </div>
        )}
        
        {/* Conversation List */}
        <div className="grid gap-4" ref={listContainerRef}>
          {searchResults && searchQuery ? (
            // Show search results
            searchResults.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No conversations found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              searchResults.map((result, idx) => {
                // Create URL with search params for highlighting and scrolling
                const searchParams = new URLSearchParams({
                  q: searchQuery,
                  highlight: result.matchingMessages[0]?.uuid || ''
                });
                
                return (
                <Link
                  key={result.conversation.id}
                  href={`/project/${params.projectId}/conversation/${result.conversation.id}?${searchParams.toString()}`}
                  className={cn(
                    "bg-card rounded-lg shadow-sm hover:shadow-md transition-all p-6 block border",
                    selectedItemIndex === idx && "ring-2 ring-primary shadow-lg"
                  )}
                  data-keyboard-item
                >
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold flex-1">
                      {result.conversation.summary.summary}
                    </h2>
                    <div className="text-sm text-muted-foreground ml-4 text-right">
                      <div>{result.conversation.messageCount} messages</div>
                      <div className="text-primary font-medium">{result.matchCount} matches</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>ID: {result.conversation.id.substring(0, 8)}...</p>
                    <p>Last updated: {new Date(result.conversation.lastUpdated).toLocaleString()}</p>
                  </div>
                  
                  {/* Show preview of matching messages */}
                  {result.matchingMessages.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Sample matches:</p>
                      <div className="space-y-1">
                        {result.matchingMessages.slice(0, 2).map((msg: any, idx: number) => {
                          const text = extractMessageText(msg);
                          const preview = text.slice(0, 150) + (text.length > 150 ? '...' : '');
                          const highlightedPreview = highlightSearchTerms(preview, searchQuery, searchMode);
                          
                          return (
                            <div key={idx} className="text-xs bg-muted/50 p-2 rounded">
                              <span className="font-medium">{msg.type}:</span>{' '}
                              <span dangerouslySetInnerHTML={{ __html: highlightedPreview }} />
                            </div>
                          );
                        })}
                        {result.matchingMessages.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            ...and {result.matchingMessages.length - 2} more matches
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
                );
              })
            )
          ) : (
            // Show all conversations
            conversations.map((conv, idx) => (
            <Link
              key={conv.id}
              href={`/project/${params.projectId}/conversation/${conv.id}`}
              className={cn(
                "bg-card rounded-lg shadow-sm hover:shadow-md transition-all p-6 block border",
                !searchQuery && selectedItemIndex === idx && "ring-2 ring-primary shadow-lg"
              )}
              data-keyboard-item
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold flex-1">
                  {conv.summary.summary}
                </h2>
                <span className="text-sm text-muted-foreground ml-4">
                  {conv.messageCount} messages
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>ID: {conv.id.substring(0, 8)}...</p>
                <p>Last updated: {new Date(conv.lastUpdated).toLocaleString()}</p>
              </div>
            </Link>
          ))
          )}
        </div>
        
        {conversations.length === 0 && !loading && !searchQuery && (
          <p className="text-muted-foreground text-center py-8">No conversations found in this project</p>
        )}
      </div>
    </div>
  );
}