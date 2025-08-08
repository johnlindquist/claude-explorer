"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Project, Conversation } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchBar, { SearchMode } from "@/components/SearchBar";
import StatsDisplay from "@/components/StatsDisplay";
import { cn } from "@/lib/utils";
import { highlightSearchTerms, extractMessageText } from "@/lib/highlight-utils";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>('exact');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDuration, setSearchDuration] = useState<number | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const listContainerRef = useRef<HTMLDivElement>(null);

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

  // Initialize search state from URL on first load
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const modeParam = (searchParams.get("mode") as SearchMode | null) ?? "exact";
    if (q) {
      setSearchQuery(q);
      setSearchMode(modeParam);
      (async () => {
        setSearching(true);
        const startTime = performance.now();
        try {
          const response = await fetch(`/api/search-fast?q=${encodeURIComponent(q)}&mode=${modeParam}`);
          if (!response.ok) throw new Error("Search failed");
          const data = await response.json();
          setSearchResults(data.results || []);
          setSearchDuration(performance.now() - startTime);
        } catch (e) {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectSelect = (project: Project) => {
    router.push(`/project/${encodeURIComponent(project.id)}`);
  };

  // Determine which items are currently displayed
  const displayedItems = searchQuery && searchResults.length > 0 
    ? searchResults 
    : (!searchQuery && projects);

  // Keyboard navigation
  const { selectedIndex, reset: resetKeyboardNav } = useKeyboardNavigation({
    itemCount: displayedItems ? displayedItems.length : 0,
    isActive: !loading && !searching,
    containerRef: listContainerRef,
    onSelect: (index) => {
      setSelectedItemIndex(index);
    },
    onEnter: (index) => {
      if (searchQuery && searchResults.length > 0) {
        const result = searchResults[index];
        if (result) {
          const searchParams = new URLSearchParams({
            q: searchQuery,
            highlight: result.matchingMessages[0]?.uuid || ''
          });
          router.push(`/project/${result.project.id}/conversation/${result.conversation.id}?${searchParams.toString()}`);
        }
      } else if (projects[index]) {
        handleProjectSelect(projects[index]);
      }
    }
  });

  // Reset keyboard navigation when search results change
  useEffect(() => {
    resetKeyboardNav();
    setSelectedItemIndex(-1);
  }, [searchQuery, searchResults, resetKeyboardNav]);

  const handleSearch = useCallback(async (query: string, mode: SearchMode) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchDuration(null);
      setSearchQuery("");
      // Update URL to clear q but preserve mode
      const params = new URLSearchParams(searchParams.toString());
      params.delete("q");
      params.set("mode", mode);
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }

    setSearching(true);
    setSearchQuery(query);
    setSearchMode(mode);
    const startTime = performance.now();

    try {
      const response = await fetch(`/api/search-fast?q=${encodeURIComponent(query)}&mode=${mode}`);
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
    // Keep URL in sync for shareable searches
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", query);
    params.set("mode", mode);
    router.replace(`${pathname}?${params.toString()}`);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold whitespace-nowrap">Claude Explorer</h1>
              <div className="flex-1 max-w-3xl">
                <div className="opacity-70">
                  <SearchBar onSearch={handleSearch} placeholder="Search across all projects and conversations..." />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-10 text-center text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold whitespace-nowrap">Claude Explorer</h1>
              <div className="flex-1 max-w-3xl">
                <SearchBar onSearch={handleSearch} placeholder="Search across all projects and conversations..." />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-10 text-center text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Sticky Header with Search */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold whitespace-nowrap">Claude Explorer</h1>
            <div className="flex-1 max-w-3xl">
              <SearchBar 
                onSearch={handleSearch}
                placeholder="Search across all projects and conversations..."
                defaultQuery={searchParams.get('q') ?? undefined}
                defaultMode={(searchParams.get('mode') as SearchMode | null) ?? undefined}
              />
              <div className="text-xs text-muted-foreground mt-1 h-5 flex items-center">
                {searching ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                    Searching across all projects...
                  </span>
                ) : searchDuration !== null ? (
                  <>
                    {searchResults.reduce((sum, r) => sum + r.matchCount, 0)} matches across {searchResults.length} conversations ({searchDuration.toFixed(0)}ms)
                  </>
                ) : (
                  <span aria-hidden="true" className="opacity-0">placeholder</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {/* Search Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Search Results</h2>
              <div className="grid gap-4" ref={listContainerRef}>
              {searchResults.map((result, idx) => {
                const searchParams = new URLSearchParams({
                  q: searchQuery,
                  highlight: result.matchingMessages[0]?.uuid || ''
                });
                
                return (
                  <Link
                    key={`${result.project.id}-${result.conversation.id}-${idx}`}
                    href={`/project/${result.project.id}/conversation/${result.conversation.id}?${searchParams.toString()}`}
                    className={cn(
                      "bg-card rounded-lg shadow-sm hover:shadow-md transition-all p-6 block border",
                      selectedItemIndex === idx && "ring-2 ring-primary shadow-lg"
                    )}
                    data-keyboard-item
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
                            const highlightedPreview = highlightSearchTerms(preview, searchQuery, searchMode);
                            
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
                  <div className="grid gap-3" ref={!searchQuery ? listContainerRef : undefined}>
                    {projects.map((project, idx) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectSelect(project)}
                        className={cn(
                          "text-left p-4 rounded-lg border transition-all hover:shadow-md hover:border-primary/50 bg-card border-border",
                          !searchQuery && selectedItemIndex === idx && "ring-2 ring-primary shadow-lg"
                        )}
                        data-keyboard-item
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

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="bg-card border rounded-lg p-4">
              <StatsDisplay />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}