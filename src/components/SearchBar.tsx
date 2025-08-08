"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { WholeWord, Regex, X } from "lucide-react";

export type SearchMode = 'exact' | 'regex';

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  placeholder?: string;
  className?: string;
  defaultQuery?: string;
  defaultMode?: SearchMode;
  // Notify parent immediately on keystrokes so it can show loading indicators early
  onQueryChange?: (query: string) => void;
}

export default function SearchBar({ onSearch, placeholder = "Search messages...", className, defaultQuery, defaultMode, onQueryChange }: SearchBarProps) {
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(defaultQuery ?? "");
  const [searchMode, setSearchMode] = useState<SearchMode>(defaultMode ?? 'exact');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSlashFocusRef = useRef<number>(0);
  const suppressNextSlashRef = useRef<boolean>(false);
  const queryRef = useRef<string>(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

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
    // Avoid clobbering user typing: only sync from defaults when input isn't focused
    const isFocused = document.activeElement === inputRef.current;
    if (!isFocused) {
      setQuery(defaultQuery ?? "");
      setDebouncedQuery(defaultQuery ?? "");
    }
  }, [defaultQuery]);

  useEffect(() => {
    setSearchMode(defaultMode ?? 'exact');
  }, [defaultMode]);

  // Only handle Escape locally; global "/" shortcut lives in GlobalSearchShortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (queryRef.current) {
          setQuery("");
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        onKeyDown={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          if (e.key === '/' || e.code === 'Slash') {
            const suppressUntilStr = (document.documentElement as any)?.dataset?.suppressSlashUntil ?? '0';
            const suppressUntil = Number(suppressUntilStr) || 0;
            if (el.dataset.skipNextSlash === '1' || Date.now() < suppressUntil) {
              e.preventDefault();
              e.stopPropagation();
              try { delete el.dataset.skipNextSlash; } catch {}
            }
          }
        }}
        onBeforeInput={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          const native = (e as unknown as { nativeEvent?: InputEvent }).nativeEvent;
          const data = native?.data ?? null;
          if (data === '/') {
            const suppressUntilStr = (document.documentElement as any)?.dataset?.suppressSlashUntil ?? '0';
            const suppressUntil = Number(suppressUntilStr) || 0;
            if (el.dataset.skipNextSlash === '1' || Date.now() < suppressUntil) {
              e.preventDefault();
              try { delete el.dataset.skipNextSlash; } catch {}
            }
          }
        }}
        onChange={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          const native = (e as unknown as { nativeEvent?: InputEvent }).nativeEvent;
          const inserted = native?.data ?? null;
          const suppressUntilStr = (document.documentElement as any)?.dataset?.suppressSlashUntil ?? '0';
          const suppressUntil = Number(suppressUntilStr) || 0;
          if (inserted === '/' && (el.dataset.skipNextSlash === '1' || Date.now() < suppressUntil)) {
            try { delete el.dataset.skipNextSlash; } catch {}
            // Revert controlled value to previous without '/'
            setQuery(queryRef.current);
            onQueryChange?.(queryRef.current);
            return;
          }
          let next = e.target.value;
          // Hard safeguard: do not allow leading '/'
          if (next.startsWith('/')) {
            next = next.replace(/^\/+/, '');
          }
          setQuery(next);
          onQueryChange?.(next);
        }}
        placeholder={placeholder}
        ref={inputRef}
        data-search-input="true"
        className="w-full px-4 py-2.5 pr-36 text-sm border rounded-md bg-background/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <span className="hidden md:inline-flex items-center rounded bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] leading-none mr-1">
          /
        </span>
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