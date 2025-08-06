"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { WholeWord, Regex, X } from "lucide-react";

export type SearchMode = 'exact' | 'regex';

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({ onSearch, placeholder = "Search messages...", className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>('exact');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query or mode changes
  useEffect(() => {
    onSearch(debouncedQuery, searchMode);
  }, [debouncedQuery, searchMode, onSearch]);

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pr-28 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          onClick={() => setSearchMode('exact')}
          className={cn(
            "p-1.5 rounded transition-all",
            searchMode === 'exact' 
              ? "text-primary bg-primary/10" 
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
          )}
          title="Match Whole Word"
          aria-label="Match whole word"
        >
          <WholeWord className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSearchMode('regex')}
          className={cn(
            "p-1.5 rounded transition-all",
            searchMode === 'regex' 
              ? "text-primary bg-primary/10" 
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
          )}
          title="Use Regular Expression"
          aria-label="Use regular expression"
        >
          <Regex className="w-4 h-4" />
        </button>
        {query && (
          <button
            onClick={() => setQuery("")}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Clear search (Esc)"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}