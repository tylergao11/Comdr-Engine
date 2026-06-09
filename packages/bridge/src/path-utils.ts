// ============================================================
// Path utilities — shared across AssetProbe, Document, AssetWriter
// Normalizes asset paths from various formats to filesystem & db:// forms
// ============================================================

export interface NormalizedPath {
  /** Filesystem path relative to project root (always uses assets/ prefix, forward slashes) */
  fsPath: string;
  /** db:// URL form for Cocos asset-db API */
  dbUrl: string;
}

/**
 * Normalize an asset path from any supported input format.
 *
 * Input                          → fsPath                            → dbUrl
 * model/helloWorld/sky.png       → assets/model/helloWorld/sky.png   → db://assets/model/helloWorld/sky.png
 * assets/model/helloWorld/sky.png→ assets/model/helloWorld/sky.png   → db://assets/model/helloWorld/sky.png
 * db://assets/model/helloWorld/sky.png → assets/model/helloWorld/sky.png → db://assets/model/helloWorld/sky.png
 */
export function normalizeAssetPath(raw: string): NormalizedPath {
  // Strip db:// prefix, normalize slashes
  let clean = raw.replace(/^db:\/\//, '').replace(/\\/g, '/');

  // Ensure assets/ prefix
  if (!clean.startsWith('assets/')) {
    clean = 'assets/' + clean;
  }

  return {
    fsPath: clean,
    dbUrl: 'db://' + clean,
  };
}
