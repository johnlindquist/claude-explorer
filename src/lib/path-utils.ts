/**
 * Decode a project ID (encoded path) back to the original file system path
 * @param encodedPath - The encoded path like "-Users-johnlindquist-dev-claude-hooks"
 * @returns The decoded path like "/Users/johnlindquist/dev/claude-hooks"
 */
export function decodeProjectPath(encodedPath: string): string {
  // Deprecated: returning input unchanged to avoid corrupting IDs that legitimately contain '-'
  return encodedPath;
}

/**
 * Encode a file system path to a project ID
 * @param path - The file system path like "/Users/johnlindquist/dev/claude-hooks"
 * @returns The encoded path like "-Users-johnlindquist-dev-claude-hooks"
 */
export function encodeProjectPath(path: string): string {
  // Deprecated: pass-through to avoid lossy transforms
  return path;
}