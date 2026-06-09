// ============================================================
// @comdr/core — 公开 API
// ============================================================

// 类型
export * from './types';

// 基础
export { VERSION } from './foundation/constants';
export * as valueKit from './foundation/value-kit';
export * as errorCodes from './errors/error-codes';

// 统一模型（全系统唯一真相源）
// CompileSpec/NodeSpec/ComponentSpec/AssemblyStats 由 types.ts 重新导出，避免重复
export {
  CocosVec2, CocosVec3, CocosVec4, CocosSize, CocosColor, CocosQuat, CocosRect,
  CocosMathType, CocosReference, CocosValue,
  ComponentIdentity, PropertySchema,
  CocosComponent, CocosNode, CocosAsset,
  SerializedComponent, SerializedNode, SerializedPrefab, SerializedPrefabInfo,
  SerializedCompPrefabInfo, SerializedObject, PrefabJson,
  BuiltNode, BuiltPrefab,
  VALUE_TYPE_TEMPLATES, VALUE_TYPE_NAMES, NODE_TEMPLATE,
  PREFAB_WRAPPER_TEMPLATE, PREFAB_INFO_TEMPLATE, COMP_PREFAB_INFO_TEMPLATE,
  PREFAB_INSTANCE_TEMPLATE, TARGET_INFO_TEMPLATE, PROPERTY_OVERRIDE_INFO_TEMPLATE,
  generateComponentTemplate, minimalComponentTemplate,
  isCompressedUuidType, isValueType, isInfraType, isEngineComponentType,
  parseComponentIdentity,
  AssemblerResult,
  RefResolver, NOOP_RESOLVER,
} from './model/cocos-world';
export { ComponentCatalog, createRefResolver } from './model/component-catalog';
export type { ComponentEntry, ComponentKnowledge, KnowledgeChildNode } from './model/component-catalog';
export type { ProbeRequest, ProbeResponse, ProbeKind } from './model/probe-protocol';

// 记忆层
export { CommanderState, SessionMemory } from './memory/session-memory';
export { AssetCache } from './memory/asset-cache';
export { DocumentState } from './memory/document-state';
export { SnapshotManager, UndoManager } from './memory/undo-manager';
export type { BackupData, BackupInfo, SnapshotEntry } from './memory/undo-manager';
export { loadSession, saveSession, recordCreated, recordModified, recordOpenDocument, buildSummary, type CommanderSnapshot, type Session } from './memory/session-store';

// 翻译层
export { assemble, assembleSubtree, generateFileId } from './translation/assembler';
export { validate } from './translation/assembler/validate';
export { enrich } from './translation/assembler/enrich';
export { clean, computeStats } from './translation/assembler/clean';

// 上下文层
export { resolveProjectContext, discoverCandidates, scoreCocosProjectPath, isSpecializedProjectContext } from './context/project-context';

// 项目感知
export { ProjectSnapshot, NodeEntry, PrefabEntry, SceneEntry, ScriptEntry, ResourceEntry, EMPTY_SNAPSHOT, buildFromAssetsProbe, buildFromScriptsProbe, buildNodeEntriesFromCtx, findNodeByName, collectNodeNames } from './perception/project-snapshot';
export { resolveNames, NameResolution, ResolvedName } from './perception/name-resolver';
export { diffPrefab, diffAllSnapshots, formatDiffResults } from './perception/prefab-diff';
export type { DiffEntry, PrefabDiffResult } from './perception/prefab-diff';

// 配置层
export { loadGatewayConfig, getActiveProvider, resolveCommanderModel, MODEL_TIERS } from './config/config-store';

// DSL
export { parseDslOutput } from './dsl/parser';
export { formatCommandResults } from './dsl/formatter';

// Gateway
export { AssemblyGateway, runAssemblyProcess } from './gateway/assembly-gateway';
export { callCommander } from './gateway/commander';
export { generateSystemPrompt } from './gateway/prompt';
export { ExecutionLogger } from './gateway/execution-logger';

// ToolCenter
export { ToolCenter } from './tool-center/tool-center';
