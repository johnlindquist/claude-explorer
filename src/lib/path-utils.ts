/**
 * Decode a project ID (encoded path) back to the original file system path
 * @param encodedPath - The encoded path like "-Users-johnlindquist-dev-claude-hooks"
 * @returns The decoded path like "/Users/johnlindquist/dev/claude-hooks"
 */
export function decodeProjectPath(encodedPath: string): string {
  // Simply replace all dashes with forward slashes
  // The encoding is just replacing / with -
  return encodedPath.replace(/-/g, '/');
}

/**
 * Encode a file system path to a project ID
 * @param path - The file system path like "/Users/johnlindquist/dev/claude-hooks"
 * @returns The encoded path like "-Users-johnlindquist-dev-claude-hooks"
 */
export function encodeProjectPath(path: string): string {
  // Replace all forward slashes with dashes
  return path.replace(/\//g, '-');
}