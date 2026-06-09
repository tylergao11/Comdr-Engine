"use strict";
// ============================================================
// Path utilities — shared across AssetProbe, Document, AssetWriter
// Normalizes asset paths from various formats to filesystem & db:// forms
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAssetPath = normalizeAssetPath;
/**
 * Normalize an asset path from any supported input format.
 *
 * Input                          → fsPath                            → dbUrl
 * model/helloWorld/sky.png       → assets/model/helloWorld/sky.png   → db://assets/model/helloWorld/sky.png
 * assets/model/helloWorld/sky.png→ assets/model/helloWorld/sky.png   → db://assets/model/helloWorld/sky.png
 * db://assets/model/helloWorld/sky.png → assets/model/helloWorld/sky.png → db://assets/model/helloWorld/sky.png
 */
function normalizeAssetPath(raw) {
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
//# sourceMappingURL=path-utils.js.map