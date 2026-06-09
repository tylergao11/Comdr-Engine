"use strict";
// ============================================================
// ProjectContext — Cocos Creator 项目自动发现
// 从 Comdr 移植的评分算法
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreCocosProjectPath = scoreCocosProjectPath;
exports.discoverCandidates = discoverCandidates;
exports.resolveProjectContext = resolveProjectContext;
exports.isSpecializedProjectContext = isSpecializedProjectContext;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const value_kit_1 = require("../foundation/value-kit");
const SCHEMA = 'Comdr.project-context.v1';
// ===== 评分 =====
const MARKER_FILES = {
    'project.json': 50,
    'assets/': 40,
    'settings/': 20,
    'packages/': 8,
    'local/': 5,
};
/** 对给定路径进行 Cocos 项目评分 */
function scoreCocosProjectPath(projectPath) {
    const markers = [];
    let score = 0;
    for (const [file, points] of Object.entries(MARKER_FILES)) {
        const fullPath = path.join(projectPath, file);
        if (fs.existsSync(fullPath)) {
            markers.push(file);
            score += points;
        }
    }
    // 如果存在 .meta 文件额外加分
    try {
        const entries = fs.readdirSync(path.join(projectPath, 'assets'));
        const hasMeta = entries.some((e) => e.endsWith('.meta'));
        if (hasMeta) {
            markers.push('*.meta');
            score += 10;
        }
    }
    catch {
        // assets 不存在
    }
    const parts = (0, value_kit_1.normalizeSlash)(projectPath).split('/');
    return {
        schema: SCHEMA,
        projectPath: (0, value_kit_1.normalizeSlash)(projectPath),
        projectName: parts[parts.length - 1] || projectPath,
        score,
        markers,
        source: 'scored',
    };
}
// ===== 发现候选 =====
function discoverCandidates(input = {}) {
    const cwd = input.cwd || process.cwd();
    const roots = input.roots || [cwd];
    const maxDepth = input.maxDepth || 3;
    const candidates = [];
    for (const root of roots) {
        // 向上搜索
        let current = (0, value_kit_1.normalizeSlash)(root);
        for (let i = 0; i < 5; i++) {
            const candidate = scoreCocosProjectPath(current);
            if (candidate.score >= 50) {
                // 有 project.json 就是强信号
                candidates.push(candidate);
                break;
            }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = (0, value_kit_1.normalizeSlash)(parent);
        }
        // 向下搜索（最多 maxDepth 层）
        try {
            const entries = fs.readdirSync(root, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }
                const subPath = (0, value_kit_1.normalizeSlash)(path.join(root, entry.name));
                _scanDir(subPath, maxDepth, candidates);
            }
        }
        catch {
            // 不可读目录
        }
    }
    // 按分数降序排序
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}
function _scanDir(dir, depth, candidates) {
    if (depth <= 0)
        return;
    const candidate = scoreCocosProjectPath(dir);
    if (candidate.score >= 70) {
        candidates.push(candidate);
        return; // 找到就停止深入
    }
    // 继续深入子目录
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.'))
                continue;
            _scanDir(path.join(dir, entry.name), depth - 1, candidates);
        }
    }
    catch {
        // ignore
    }
}
// ===== 主入口 =====
function resolveProjectContext(input = {}) {
    const mode = input.mode || 'discover';
    // 验证模式
    if (mode === 'validate' && input.projectPath) {
        const candidate = scoreCocosProjectPath(input.projectPath);
        const specialized = candidate.score >= 70;
        return {
            schema: SCHEMA,
            status: specialized ? 'specialized_project_selected' : 'general_workspace',
            kind: specialized ? 'cocos_project' : 'general',
            specialized,
            source: 'validated',
            projectPath: (0, value_kit_1.normalizeSlash)(input.projectPath),
            projectName: candidate.projectName,
            reason: specialized
                ? `Found Cocos project: ${candidate.projectName} (score: ${candidate.score})`
                : `Not a Cocos project (score: ${candidate.score}). Running in general mode.`,
            checkedPath: (0, value_kit_1.normalizeSlash)(input.projectPath),
            score: candidate.score,
            markers: candidate.markers,
            candidates: [candidate],
            role: specialized
                ? 'Cocos Creator project — Comdr can operate scenes and prefabs.'
                : 'General workspace — provide a Cocos project path to enable Comdr.',
            instruction: specialized
                ? 'Use Comdr to create/edit UI, manage assets, operate the Cocos editor.'
                : 'Specify a Cocos project path to enable full Comdr capabilities.',
        };
    }
    // 发现模式
    const cwd = input.cwd || process.cwd();
    const candidates = discoverCandidates({ ...input, cwd });
    const best = candidates[0];
    if (best && best.score >= 70) {
        return {
            schema: SCHEMA,
            status: 'specialized_project_selected',
            kind: 'cocos_project',
            specialized: true,
            source: 'discovered',
            projectPath: best.projectPath,
            projectName: best.projectName,
            reason: `Auto-discovered Cocos project: ${best.projectName} (score: ${best.score})`,
            checkedPath: (0, value_kit_1.normalizeSlash)(cwd),
            score: best.score,
            markers: best.markers,
            candidates,
            role: 'Cocos Creator project — Comdr can operate scenes and prefabs.',
            instruction: 'Use Comdr to create/edit UI, manage assets, operate the Cocos editor.',
        };
    }
    return {
        schema: SCHEMA,
        status: 'general_workspace',
        kind: 'general',
        specialized: false,
        source: 'discovered',
        projectPath: (0, value_kit_1.normalizeSlash)(cwd),
        projectName: path.basename(cwd),
        reason: 'No Cocos project found. Running in general mode.',
        checkedPath: (0, value_kit_1.normalizeSlash)(cwd),
        score: best?.score || 0,
        markers: best?.markers || [],
        candidates,
        role: 'General workspace.',
        instruction: 'Specify a Cocos project path to enable Comdr.',
    };
}
function isSpecializedProjectContext(ctx) {
    return ctx.specialized;
}
//# sourceMappingURL=project-context.js.map