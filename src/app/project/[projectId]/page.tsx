"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const queryParams = useSearchParams();
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSearching(false);
      const params = new URLSearchParams(queryParams.toString());
      params.delete('q');
      params.set('mode', mode);
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setSearching(true);
    const startTime = performance.now();
    
    try {
      const response = await fetch(`/api/projects/${params.projectId}/search?q=${encodeURIComponent(query)}&mode=${mode}`, { signal: controller.signal });
      const data = await response.json();
      if (requestId === requestIdRef.current) {
        setSearchResults(data.results);
      }
      
      const endTime = performance.now();
      if (requestId === requestIdRef.current) {
        setSearchDuration(endTime - startTime);
        setSearchQuery(query);
        setSearchMode(mode);
      }
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') {
        console.error("Search failed:", error);
        if (requestId === requestIdRef.current) {
          setSearchResults(null);
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setSearching(false);
      }
    }
    const params = new URLSearchParams(queryParams.toString());
    params.set('q', query);
    params.set('mode', mode);
    router.replace(`${pathname}?${params.toString()}`);
  }, [params.projectId]);

  const handleQueryChangeImmediate = useCallback((next: string) => {
    setSearchQuery(next);
    if (next.trim()) {
      setSearching(true);
    } else {
      setSearching(false);
      setSearchResults(null);
      setSearchDuration(null);
    }
  }, []);

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
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="text-sm text-muted-foreground hover:underline whitespace-nowrap">← Change Project</Link>
              <h1 className="text-2xl md:text-3xl font-semibold truncate flex-1 text-center">{project?.name || 'Claude Explorer'}</h1>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{conversations.length} convs</div>
            </div>
            {!loading && !error && conversations.length > 0 && (
              <div className="max-w-3xl mx-auto">
                <SearchBar 
                  onSearch={handleSearch}
                  onQueryChange={handleQueryChangeImmediate}
                  placeholder="Search across all conversations..."
                  defaultQuery={queryParams.get('q') ?? undefined}
                  defaultMode={(queryParams.get('mode') as SearchMode | null) ?? undefined}
                />
              </div>
            )}
          </div>
        </div>
      </div>
        
      <div className="max-w-7xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
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
                    "group bg-card rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-6 block border",
                    selectedItemIndex === idx && "ring-2 ring-primary shadow-lg"
                  )}
                  data-keyboard-item
                >
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold flex-1">
                      {result.conversation.summary.summary}
                    </h2>
                    <div className="text-sm text-muted-foreground ml-4 text-right">
                      <div className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                        {result.conversation.messageCount} msgs
                      </div>
                      <div className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium ml-2">
                        {result.matchCount} matches
                      </div>
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
                  "group relative bg-card rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-6 block border",
                !searchQuery && selectedItemIndex === idx && "ring-2 ring-primary shadow-lg"
              )}
              data-keyboard-item
            >
                <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l bg-transparent group-hover:bg-primary/40 transition-colors" />
                <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold flex-1">
                  {conv.summary.summary}
                </h2>
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium ml-4">
                    {conv.messageCount} msgs
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

        {/* Right sidebar duplicate stats for when header out of view */}
        {!loading && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <ProjectStatsDisplay 
                projectId={params.projectId as string}
                onConversationClick={(conversationId) => {
                  router.push(`/project/${params.projectId}/conversation/${conversationId}`);
                }}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}