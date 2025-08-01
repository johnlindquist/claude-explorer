/**
 * Highlights search terms in text by wrapping them in <mark> tags
 */
export function highlightSearchTerms(text: string, searchQuery: string): string {
  if (!searchQuery.trim() || !text) return text;
  
  // Tokenize the search query
  const searchTerms = searchQuery.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 0);
  
  // Create a regex pattern that matches any of the search terms
  const pattern = searchTerms
    .map(term => escapeRegExp(term))
    .join('|');
  
  if (!pattern) return text;
  
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  // Replace matches with highlighted version
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900 text-inherit rounded px-0.5">$1</mark>');
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract text content from a message for preview
 */
export function extractMessageText(message: any): string {
  // Handle direct content (from search API)
  if (typeof message.content === 'string') {
    return message.content;
  }
  
  // Handle structured message content
  const content = message.message?.content || message.content || '';
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    const textContent = content.find(c => c.type === 'text');
    return textContent?.text || '';
  }
  
  return '';
}