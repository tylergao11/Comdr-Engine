"use strict";
// ============================================================
// @comdr/core — 公开 API
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.findNodeByName = exports.buildNodeEntriesFromCtx = exports.buildFromScriptsProbe = exports.buildFromAssetsProbe = exports.EMPTY_SNAPSHOT = exports.isSpecializedProjectContext = exports.scoreCocosProjectPath = exports.discoverCandidates = exports.resolveProjectContext = exports.computeStats = exports.clean = exports.enrich = exports.validate = exports.generateFileId = exports.assembleSubtree = exports.assemble = exports.buildSummary = exports.recordOpenDocument = exports.recordModified = exports.recordCreated = exports.saveSession = exports.loadSession = exports.UndoManager = exports.SnapshotManager = exports.DocumentState = exports.AssetCache = exports.SessionMemory = exports.CommanderState = exports.createRefResolver = exports.ComponentCatalog = exports.NOOP_RESOLVER = exports.parseComponentIdentity = exports.isEngineComponentType = exports.isInfraType = exports.isValueType = exports.isCompressedUuidType = exports.minimalComponentTemplate = exports.generateComponentTemplate = exports.PROPERTY_OVERRIDE_INFO_TEMPLATE = exports.TARGET_INFO_TEMPLATE = exports.PREFAB_INSTANCE_TEMPLATE = exports.COMP_PREFAB_INFO_TEMPLATE = exports.PREFAB_INFO_TEMPLATE = exports.PREFAB_WRAPPER_TEMPLATE = exports.NODE_TEMPLATE = exports.VALUE_TYPE_NAMES = exports.VALUE_TYPE_TEMPLATES = exports.errorCodes = exports.valueKit = exports.VERSION = void 0;
exports.ToolCenter = exports.ExecutionLogger = exports.generateSystemPrompt = exports.callCommander = exports.runAssemblyProcess = exports.AssemblyGateway = exports.formatCommandResults = exports.parseDslOutput = exports.MODEL_TIERS = exports.resolveCommanderModel = exports.getActiveProvider = exports.loadGatewayConfig = exports.formatDiffResults = exports.diffAllSnapshots = exports.diffPrefab = exports.resolveNames = exports.collectNodeNames = void 0;
// 类型
__exportStar(require("./types"), exports);
// 基础
var constants_1 = require("./foundation/constants");
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return constants_1.VERSION; } });
exports.valueKit = __importStar(require("./foundation/value-kit"));
exports.errorCodes = __importStar(require("./errors/error-codes"));
// 统一模型（全系统唯一真相源）
// CompileSpec/NodeSpec/ComponentSpec/AssemblyStats 由 types.ts 重新导出，避免重复
var cocos_world_1 = require("./model/cocos-world");
Object.defineProperty(exports, "VALUE_TYPE_TEMPLATES", { enumerable: true, get: function () { return cocos_world_1.VALUE_TYPE_TEMPLATES; } });
Object.defineProperty(exports, "VALUE_TYPE_NAMES", { enumerable: true, get: function () { return cocos_world_1.VALUE_TYPE_NAMES; } });
Object.defineProperty(exports, "NODE_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.NODE_TEMPLATE; } });
Object.defineProperty(exports, "PREFAB_WRAPPER_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.PREFAB_WRAPPER_TEMPLATE; } });
Object.defineProperty(exports, "PREFAB_INFO_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.PREFAB_INFO_TEMPLATE; } });
Object.defineProperty(exports, "COMP_PREFAB_INFO_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.COMP_PREFAB_INFO_TEMPLATE; } });
Object.defineProperty(exports, "PREFAB_INSTANCE_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.PREFAB_INSTANCE_TEMPLATE; } });
Object.defineProperty(exports, "TARGET_INFO_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.TARGET_INFO_TEMPLATE; } });
Object.defineProperty(exports, "PROPERTY_OVERRIDE_INFO_TEMPLATE", { enumerable: true, get: function () { return cocos_world_1.PROPERTY_OVERRIDE_INFO_TEMPLATE; } });
Object.defineProperty(exports, "generateComponentTemplate", { enumerable: true, get: function () { return cocos_world_1.generateComponentTemplate; } });
Object.defineProperty(exports, "minimalComponentTemplate", { enumerable: true, get: function () { return cocos_world_1.minimalComponentTemplate; } });
Object.defineProperty(exports, "isCompressedUuidType", { enumerable: true, get: function () { return cocos_world_1.isCompressedUuidType; } });
Object.defineProperty(exports, "isValueType", { enumerable: true, get: function () { return cocos_world_1.isValueType; } });
Object.defineProperty(exports, "isInfraType", { enumerable: true, get: function () { return cocos_world_1.isInfraType; } });
Object.defineProperty(exports, "isEngineComponentType", { enumerable: true, get: function () { return cocos_world_1.isEngineComponentType; } });
Object.defineProperty(exports, "parseComponentIdentity", { enumerable: true, get: function () { return cocos_world_1.parseComponentIdentity; } });
Object.defineProperty(exports, "NOOP_RESOLVER", { enumerable: true, get: function () { return cocos_world_1.NOOP_RESOLVER; } });
var component_catalog_1 = require("./model/component-catalog");
Object.defineProperty(exports, "ComponentCatalog", { enumerable: true, get: function () { return component_catalog_1.ComponentCatalog; } });
Object.defineProperty(exports, "createRefResolver", { enumerable: true, get: function () { return component_catalog_1.createRefResolver; } });
// 记忆层
var session_memory_1 = require("./memory/session-memory");
Object.defineProperty(exports, "CommanderState", { enumerable: true, get: function () { return session_memory_1.CommanderState; } });
Object.defineProperty(exports, "SessionMemory", { enumerable: true, get: function () { return session_memory_1.SessionMemory; } });
var asset_cache_1 = require("./memory/asset-cache");
Object.defineProperty(exports, "AssetCache", { enumerable: true, get: function () { return asset_cache_1.AssetCache; } });
var document_state_1 = require("./memory/document-state");
Object.defineProperty(exports, "DocumentState", { enumerable: true, get: function () { return document_state_1.DocumentState; } });
var undo_manager_1 = require("./memory/undo-manager");
Object.defineProperty(exports, "SnapshotManager", { enumerable: true, get: function () { return undo_manager_1.SnapshotManager; } });
Object.defineProperty(exports, "UndoManager", { enumerable: true, get: function () { return undo_manager_1.UndoManager; } });
var session_store_1 = require("./memory/session-store");
Object.defineProperty(exports, "loadSession", { enumerable: true, get: function () { return session_store_1.loadSession; } });
Object.defineProperty(exports, "saveSession", { enumerable: true, get: function () { return session_store_1.saveSession; } });
Object.defineProperty(exports, "recordCreated", { enumerable: true, get: function () { return session_store_1.recordCreated; } });
Object.defineProperty(exports, "recordModified", { enumerable: true, get: function () { return session_store_1.recordModified; } });
Object.defineProperty(exports, "recordOpenDocument", { enumerable: true, get: function () { return session_store_1.recordOpenDocument; } });
Object.defineProperty(exports, "buildSummary", { enumerable: true, get: function () { return session_store_1.buildSummary; } });
// 翻译层
var assembler_1 = require("./translation/assembler");
Object.defineProperty(exports, "assemble", { enumerable: true, get: function () { return assembler_1.assemble; } });
Object.defineProperty(exports, "assembleSubtree", { enumerable: true, get: function () { return assembler_1.assembleSubtree; } });
Object.defineProperty(exports, "generateFileId", { enumerable: true, get: function () { return assembler_1.generateFileId; } });
var validate_1 = require("./translation/assembler/validate");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return validate_1.validate; } });
var enrich_1 = require("./translation/assembler/enrich");
Object.defineProperty(exports, "enrich", { enumerable: true, get: function () { return enrich_1.enrich; } });
var clean_1 = require("./translation/assembler/clean");
Object.defineProperty(exports, "clean", { enumerable: true, get: function () { return clean_1.clean; } });
Object.defineProperty(exports, "computeStats", { enumerable: true, get: function () { return clean_1.computeStats; } });
// 上下文层
var project_context_1 = require("./context/project-context");
Object.defineProperty(exports, "resolveProjectContext", { enumerable: true, get: function () { return project_context_1.resolveProjectContext; } });
Object.defineProperty(exports, "discoverCandidates", { enumerable: true, get: function () { return project_context_1.discoverCandidates; } });
Object.defineProperty(exports, "scoreCocosProjectPath", { enumerable: true, get: function () { return project_context_1.scoreCocosProjectPath; } });
Object.defineProperty(exports, "isSpecializedProjectContext", { enumerable: true, get: function () { return project_context_1.isSpecializedProjectContext; } });
// 项目感知
var project_snapshot_1 = require("./perception/project-snapshot");
Object.defineProperty(exports, "EMPTY_SNAPSHOT", { enumerable: true, get: function () { return project_snapshot_1.EMPTY_SNAPSHOT; } });
Object.defineProperty(exports, "buildFromAssetsProbe", { enumerable: true, get: function () { return project_snapshot_1.buildFromAssetsProbe; } });
Object.defineProperty(exports, "buildFromScriptsProbe", { enumerable: true, get: function () { return project_snapshot_1.buildFromScriptsProbe; } });
Object.defineProperty(exports, "buildNodeEntriesFromCtx", { enumerable: true, get: function () { return project_snapshot_1.buildNodeEntriesFromCtx; } });
Object.defineProperty(exports, "findNodeByName", { enumerable: true, get: function () { return project_snapshot_1.findNodeByName; } });
Object.defineProperty(exports, "collectNodeNames", { enumerable: true, get: function () { return project_snapshot_1.collectNodeNames; } });
var name_resolver_1 = require("./perception/name-resolver");
Object.defineProperty(exports, "resolveNames", { enumerable: true, get: function () { return name_resolver_1.resolveNames; } });
var prefab_diff_1 = require("./perception/prefab-diff");
Object.defineProperty(exports, "diffPrefab", { enumerable: true, get: function () { return prefab_diff_1.diffPrefab; } });
Object.defineProperty(exports, "diffAllSnapshots", { enumerable: true, get: function () { return prefab_diff_1.diffAllSnapshots; } });
Object.defineProperty(exports, "formatDiffResults", { enumerable: true, get: function () { return prefab_diff_1.formatDiffResults; } });
// 配置层
var config_store_1 = require("./config/config-store");
Object.defineProperty(exports, "loadGatewayConfig", { enumerable: true, get: function () { return config_store_1.loadGatewayConfig; } });
Object.defineProperty(exports, "getActiveProvider", { enumerable: true, get: function () { return config_store_1.getActiveProvider; } });
Object.defineProperty(exports, "resolveCommanderModel", { enumerable: true, get: function () { return config_store_1.resolveCommanderModel; } });
Object.defineProperty(exports, "MODEL_TIERS", { enumerable: true, get: function () { return config_store_1.MODEL_TIERS; } });
// DSL
var parser_1 = require("./dsl/parser");
Object.defineProperty(exports, "parseDslOutput", { enumerable: true, get: function () { return parser_1.parseDslOutput; } });
var formatter_1 = require("./dsl/formatter");
Object.defineProperty(exports, "formatCommandResults", { enumerable: true, get: function () { return formatter_1.formatCommandResults; } });
// Gateway
var assembly_gateway_1 = require("./gateway/assembly-gateway");
Object.defineProperty(exports, "AssemblyGateway", { enumerable: true, get: function () { return assembly_gateway_1.AssemblyGateway; } });
Object.defineProperty(exports, "runAssemblyProcess", { enumerable: true, get: function () { return assembly_gateway_1.runAssemblyProcess; } });
var commander_1 = require("./gateway/commander");
Object.defineProperty(exports, "callCommander", { enumerable: true, get: function () { return commander_1.callCommander; } });
var prompt_1 = require("./gateway/prompt");
Object.defineProperty(exports, "generateSystemPrompt", { enumerable: true, get: function () { return prompt_1.generateSystemPrompt; } });
var execution_logger_1 = require("./gateway/execution-logger");
Object.defineProperty(exports, "ExecutionLogger", { enumerable: true, get: function () { return execution_logger_1.ExecutionLogger; } });
// ToolCenter
var tool_center_1 = require("./tool-center/tool-center");
Object.defineProperty(exports, "ToolCenter", { enumerable: true, get: function () { return tool_center_1.ToolCenter; } });
//# sourceMappingURL=index.js.map