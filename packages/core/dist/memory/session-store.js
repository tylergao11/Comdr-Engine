"use strict";
// ============================================================
// SessionStore — 跨调用会话持久化
// 存储位置: ~/.comdr/sessions/{id}.json
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
exports.loadSession = loadSession;
exports.saveSession = saveSession;
exports.recordCreated = recordCreated;
exports.recordModified = recordModified;
exports.recordOpenDocument = recordOpenDocument;
exports.buildSummary = buildSummary;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const value_kit_1 = require("../foundation/value-kit");
const constants_1 = require("../foundation/constants");
const SESSION_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.comdr', 'sessions');
const OLD_SESSION_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.cmdr', 'sessions');
/** 解析会话存储目录 */
function sessionPath(sessionId) {
    return path.join(SESSION_DIR, `${sessionId}.json`);
}
function oldSessionPath(sessionId) {
    return path.join(OLD_SESSION_DIR, `${sessionId}.json`);
}
/** 加载会话，不存在则创建新的 */
function loadSession(sessionId) {
    const filePath = sessionPath(sessionId);
    let data = (0, value_kit_1.readJsonUtf8)(filePath);
    // 迁移：新路径无会话时尝试旧路径 (cmdr → comdr 重命名兼容)
    if (!data) {
        const oldPath = oldSessionPath(sessionId);
        const oldData = (0, value_kit_1.readJsonUtf8)(oldPath);
        if (oldData && oldData.sessionId === sessionId) {
            data = oldData;
            // 写入新位置
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            (0, value_kit_1.writeJsonAtomic)(filePath, data, true);
        }
    }
    if (data && data.sessionId === sessionId) {
        return data;
    }
    return {
        sessionId,
        projectPath: '',
        createdAt: (0, value_kit_1.nowISO)(),
        modifiedAt: (0, value_kit_1.nowISO)(),
        createdAssets: [],
        modifiedAssets: [],
        openDocument: null,
    };
}
/** 保存会话到磁盘 */
function saveSession(session) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    session.modifiedAt = (0, value_kit_1.nowISO)();
    const filePath = sessionPath(session.sessionId);
    (0, value_kit_1.writeJsonAtomic)(filePath, session, true);
}
/** 记录创建的资产 */
function recordCreated(session, assetPath, uuid, purpose) {
    session.createdAssets.push({
        path: assetPath,
        uuid,
        purpose,
        at: (0, value_kit_1.nowISO)(),
    });
    session.modifiedAt = (0, value_kit_1.nowISO)();
}
/** 记录修改的资产 */
function recordModified(session, assetPath) {
    if (!session.modifiedAssets.includes(assetPath)) {
        session.modifiedAssets.push(assetPath);
    }
    session.modifiedAt = (0, value_kit_1.nowISO)();
}
/** 记录打开的文档 */
function recordOpenDocument(session, kind, filePath) {
    session.openDocument = { kind, path: filePath };
    session.modifiedAt = (0, value_kit_1.nowISO)();
}
/** 生成会话摘要（给 Commander 用） */
function buildSummary(session) {
    return {
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        createdCount: session.createdAssets.length,
        modifiedCount: session.modifiedAssets.length,
        openDocument: session.openDocument,
        recentCreations: session.createdAssets.slice(-constants_1.SESSION_RECENT_CREATIONS).map((a) => ({
            path: a.path,
            purpose: a.purpose,
        })),
    };
}
//# sourceMappingURL=session-store.js.map