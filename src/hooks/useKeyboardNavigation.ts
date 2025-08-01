import { useEffect, useState, useCallback, RefObject } from 'react';

interface UseKeyboardNavigationOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  onEnter?: (index: number) => void;
  isActive?: boolean;
  wrapAround?: boolean;
  containerRef?: RefObject<HTMLElement>;
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEnter,
  isActive = true,
  wrapAround = true,
  containerRef
}: UseKeyboardNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive || itemCount === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          let next = prev + 1;
          if (next >= itemCount) {
            next = wrapAround ? 0 : itemCount - 1;
          }
          if (prev === -1) next = 0; // Start from first item
          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          let next = prev - 1;
          if (next < 0) {
            next = wrapAround ? itemCount - 1 : 0;
          }
          if (prev === -1) next = itemCount - 1; // Start from last item
          return next;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < itemCount) {
          if (onEnter) {
            onEnter(selectedIndex);
          } else {
            onSelect(selectedIndex);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        setSelectedIndex(-1);
        break;
    }
  }, [isActive, itemCount, selectedIndex, onSelect, onEnter, wrapAround]);

  // Update onSelect when index changes
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < itemCount) {
      onSelect(selectedIndex);
      
      // Scroll into view if containerRef is provided
      if (containerRef?.current) {
        const items = containerRef.current.querySelectorAll('[data-keyboard-item]');
        const selectedItem = items[selectedIndex] as HTMLElement;
        if (selectedItem) {
          selectedItem.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'nearest'
          });
        }
      }
    }
  }, [selectedIndex, itemCount, onSelect, containerRef]);

  // Add keyboard event listener
  useEffect(() => {
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, isActive]);

  // Reset selection when item count changes
  useEffect(() => {
    if (selectedIndex >= itemCount) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount, selectedIndex]);

  const reset = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  return {
    selectedIndex,
    setSelectedIndex,
    reset
  };
}