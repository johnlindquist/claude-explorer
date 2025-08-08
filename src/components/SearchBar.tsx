"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { WholeWord, Regex, X } from "lucide-react";

export type SearchMode = 'exact' | 'regex';

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  placeholder?: string;
  className?: string;
  defaultQuery?: string;
  defaultMode?: SearchMode;
}

export default function SearchBar({ onSearch, placeholder = "Search messages...", className, defaultQuery, defaultMode }: SearchBarProps) {
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(defaultQuery ?? "");
  const [searchMode, setSearchMode] = useState<SearchMode>(defaultMode ?? 'exact');

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

  // Sync internal state when defaults change (e.g., URL params update)
  useEffect(() => {
    setQuery(defaultQuery ?? "");
    setDebouncedQuery(defaultQuery ?? "");
  }, [defaultQuery]);

  useEffect(() => {
    setSearchMode(defaultMode ?? 'exact');
  }, [defaultMode]);

  // Handle Escape to clear
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && query) {
        setQuery("");
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [query]);

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 pr-32 text-sm border rounded-md bg-background/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          onClick={() => setSearchMode('exact')}
          className={cn(
            "p-1.5 rounded transition-all",
            searchMode === 'exact' 
              ? "text-primary bg-primary/10 ring-1 ring-primary/20" 
              : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted"
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
              ? "text-primary bg-primary/10 ring-1 ring-primary/20" 
              : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted"
          )}
          title="Use Regular Expression"
          aria-label="Use regular expression"
        >
          <Regex className="w-4 h-4" />
        </button>
        <button
          onClick={() => setQuery("")}
          className={cn(
            "p-1.5 rounded transition-colors",
            query ? "text-muted-foreground hover:text-foreground hover:bg-muted" : "invisible"
          )}
          title="Clear search (Esc)"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}