"use client";

import { useEffect } from "react";

export default function GlobalSearchShortcut() {
  useEffect(() => {
    let suppressUntil = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore IME composition and modifier combos
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;

      // Do not interfere when already typing in an input-like element
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;

      if ((e.key === '/' || e.code === 'Slash') && !isTypingContext) {
        e.preventDefault();
        e.stopPropagation();
        suppressUntil = Date.now() + 300;
        try {
          (document.documentElement as any).dataset.suppressSlashUntil = String(suppressUntil);
        } catch {}

        // Find a visible search input annotated with data-search-input
        const searchInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-search-input="true"]'));
        const visibleInput = searchInputs.find((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        });

        if (visibleInput) {
          // Mark to skip a single slash insertion on this input
          try {
            visibleInput.dataset.skipNextSlash = '1';
            setTimeout(() => {
              delete visibleInput.dataset.skipNextSlash;
            }, 300);
          } catch {}
          // Defer focusing to the next frame to avoid any residual slash insertion
          requestAnimationFrame(() => {
            visibleInput.focus();
          });
        }
      }
    };

    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      const data = (ie as any)?.data ?? null;
      if (data === '/' && Date.now() < suppressUntil) {
        ie.preventDefault();
        suppressUntil = 0;
      }
    };

    const onKeyPress = (e: KeyboardEvent) => {
      if ((e.key === '/' || e.code === 'Slash') && Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
        suppressUntil = 0;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('beforeinput', onBeforeInput, true);
    window.addEventListener('keypress', onKeyPress, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('beforeinput', onBeforeInput, true);
      window.removeEventListener('keypress', onKeyPress, true);
      try {
        delete (document.documentElement as any).dataset.suppressSlashUntil;
      } catch {}
    };
  }, []);

  return null;
}


