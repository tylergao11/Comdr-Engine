"use strict";
// ============================================================
// @comdr/bridge — 集中式错误码
// 与 @comdr/core/errors/error-codes.ts 保持一致的 ERR_ 前缀约定
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSG_NO_DOCUMENT_OPEN = exports.ERR_BR_NO_DOC = exports.ERR_DOC_AMBIGUOUS_NODE = exports.ERR_DOC_TREE_BUILD_ERROR = exports.ERR_DOC_ROOT_NOT_FOUND = exports.ERR_DOC_CYCLE_DETECTED = exports.ERR_DOC_DUPLICATE_COMPONENT = exports.ERR_DOC_UNKNOWN_COMPONENT = exports.ERR_DOC_EDIT_ERROR = exports.ERR_DOC_TREE_REBUILD_ERROR = exports.ERR_DOC_INVALID_EDIT_TYPE = exports.ERR_DOC_COMPONENT_NOT_FOUND = exports.ERR_DOC_NODE_NOT_FOUND = exports.ERR_DOC_INVALID_FORMAT = exports.ERR_DOC_PARSE_ERROR = exports.ERR_DOC_ASSET_NOT_FOUND = void 0;
// ----- Document (DOC) -----
exports.ERR_DOC_ASSET_NOT_FOUND = 'DOC_ASSET_NOT_FOUND';
exports.ERR_DOC_PARSE_ERROR = 'DOC_PARSE_ERROR';
exports.ERR_DOC_INVALID_FORMAT = 'DOC_INVALID_FORMAT';
exports.ERR_DOC_NODE_NOT_FOUND = 'DOC_NODE_NOT_FOUND';
exports.ERR_DOC_COMPONENT_NOT_FOUND = 'DOC_COMPONENT_NOT_FOUND';
exports.ERR_DOC_INVALID_EDIT_TYPE = 'DOC_INVALID_EDIT_TYPE';
exports.ERR_DOC_TREE_REBUILD_ERROR = 'DOC_TREE_REBUILD_ERROR';
exports.ERR_DOC_EDIT_ERROR = 'DOC_EDIT_ERROR';
exports.ERR_DOC_UNKNOWN_COMPONENT = 'DOC_UNKNOWN_COMPONENT';
exports.ERR_DOC_DUPLICATE_COMPONENT = 'DOC_DUPLICATE_COMPONENT';
exports.ERR_DOC_CYCLE_DETECTED = 'DOC_CYCLE_DETECTED';
exports.ERR_DOC_ROOT_NOT_FOUND = 'DOC_ROOT_NOT_FOUND';
exports.ERR_DOC_TREE_BUILD_ERROR = 'DOC_TREE_BUILD_ERROR';
exports.ERR_DOC_AMBIGUOUS_NODE = 'DOC_AMBIGUOUS_NODE';
// ----- General (BR) -----
exports.ERR_BR_NO_DOC = 'BR_NO_DOC';
// ----- 通用消息（非错误码，集中管理避免字符串散落）-----
exports.MSG_NO_DOCUMENT_OPEN = 'No document open';
//# sourceMappingURL=error-codes.js.map