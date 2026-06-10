"use strict";
// ============================================================
// @comdr/core/errors — 集中式错误码
// 每个模块的错误码有唯一前缀，方便日志检索
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERR_SCH_CACHE_LOAD_FAILED = exports.ERR_SCH_COMPONENT_NOT_FOUND = exports.ERR_SCR_SCRIPT_NOT_FOUND = exports.ERR_SCR_METHOD_NOT_FOUND = exports.ERR_VAL_UNKNOWN_TYPE = exports.ERR_VAL_INVALID_ID_REF = exports.ERR_VAL_MISSING_TYPE = exports.ERR_VAL_NOT_ARRAY = exports.ERR_GW_UNRESOLVED_TEMPID = exports.ERR_GW_EXECUTION_ERROR = exports.ERR_ASM_WRAPPER_ID = exports.ERR_ASM_NO_COMPILED_JSON = exports.ERR_ASM_UNRESOLVED_REF = exports.ERR_ASM_UNKNOWN_COMPONENT = exports.ERR_ASM_INVALID_PARENT = exports.ERR_ASM_NO_ROOT = exports.ERR_ASM_MULTI_ROOT = exports.ERR_ASM_DUPLICATE_TEMPID = exports.ERR_ASM_MISSING_TEMPID = exports.ERR_ASM_INVALID_SPEC = exports.ERR_BR_INVALID_RESPONSE = exports.ERR_BR_TASK_TIMEOUT = exports.ERR_BR_TASK_FAILED = exports.ERR_BR_BRIDGE_OFFLINE = exports.ERR_DSL_UNKNOWN_CMD = exports.ERR_CMD_MAX_RETRIES = exports.ERR_CMD_SERVER_ERROR = exports.ERR_CMD_AUTH = exports.ERR_CMD_RATE_LIMIT = exports.ERR_CMD_NETWORK = exports.ERR_CFG_INVALID_CONFIG = exports.ERR_CFG_NO_PROVIDER = exports.ERR_CFG_NO_API_KEY = exports.ERR_PC_PATH_NOT_FOUND = exports.ERR_PC_WORKSPACE_NOT_COCOS = exports.ERR_PC_NO_COCOS_PROJECT = exports.ERR_INVALID_ARG = exports.ERR_CANCELLED = exports.ERR_UNKNOWN = void 0;
exports.makeError = makeError;
exports.toErrResult = toErrResult;
// ----- 通用 -----
exports.ERR_UNKNOWN = 'E_UNKNOWN';
exports.ERR_CANCELLED = 'E_CANCELLED';
exports.ERR_INVALID_ARG = 'E_INVALID_ARG';
// ----- 项目上下文 (PC) -----
exports.ERR_PC_NO_COCOS_PROJECT = 'PC_NO_COCOS_PROJECT';
exports.ERR_PC_WORKSPACE_NOT_COCOS = 'PC_WORKSPACE_NOT_COCOS';
exports.ERR_PC_PATH_NOT_FOUND = 'PC_PATH_NOT_FOUND';
// ----- 配置 (CFG) -----
exports.ERR_CFG_NO_API_KEY = 'CFG_NO_API_KEY';
exports.ERR_CFG_NO_PROVIDER = 'CFG_NO_PROVIDER';
exports.ERR_CFG_INVALID_CONFIG = 'CFG_INVALID_CONFIG';
// ----- Commander (CMD) -----
exports.ERR_CMD_NETWORK = 'CMD_NETWORK';
exports.ERR_CMD_RATE_LIMIT = 'CMD_RATE_LIMIT';
exports.ERR_CMD_AUTH = 'CMD_AUTH';
exports.ERR_CMD_SERVER_ERROR = 'CMD_SERVER_ERROR';
exports.ERR_CMD_MAX_RETRIES = 'CMD_MAX_RETRIES';
// ----- DSL (DSL) -----
exports.ERR_DSL_UNKNOWN_CMD = 'DSL_UNKNOWN_CMD';
// ----- ToolCenter / Bridge (BR) -----
exports.ERR_BR_BRIDGE_OFFLINE = 'BR_BRIDGE_OFFLINE';
exports.ERR_BR_TASK_FAILED = 'BR_TASK_FAILED';
exports.ERR_BR_TASK_TIMEOUT = 'BR_TASK_TIMEOUT';
exports.ERR_BR_INVALID_RESPONSE = 'BR_INVALID_RESPONSE';
// ----- Assembler (ASM) -----
exports.ERR_ASM_INVALID_SPEC = 'ASM_INVALID_SPEC';
exports.ERR_ASM_MISSING_TEMPID = 'ASM_MISSING_TEMPID';
exports.ERR_ASM_DUPLICATE_TEMPID = 'ASM_DUPLICATE_TEMPID';
exports.ERR_ASM_MULTI_ROOT = 'ASM_MULTI_ROOT';
exports.ERR_ASM_NO_ROOT = 'ASM_NO_ROOT';
exports.ERR_ASM_INVALID_PARENT = 'ASM_INVALID_PARENT';
exports.ERR_ASM_UNKNOWN_COMPONENT = 'ASM_UNKNOWN_COMPONENT';
exports.ERR_ASM_UNRESOLVED_REF = 'ASM_UNRESOLVED_REF';
exports.ERR_ASM_NO_COMPILED_JSON = 'ASM_NO_COMPILED_JSON';
exports.ERR_ASM_WRAPPER_ID = 'ASM_WRAPPER_ID';
// ----- Gateway (GW) -----
exports.ERR_GW_EXECUTION_ERROR = 'GW_EXECUTION_ERROR';
exports.ERR_GW_UNRESOLVED_TEMPID = 'GW_UNRESOLVED_TEMPID';
// ----- Validator (VAL) -----
exports.ERR_VAL_NOT_ARRAY = 'VAL_NOT_ARRAY';
exports.ERR_VAL_MISSING_TYPE = 'VAL_MISSING_TYPE';
exports.ERR_VAL_INVALID_ID_REF = 'VAL_INVALID_ID_REF';
exports.ERR_VAL_UNKNOWN_TYPE = 'VAL_UNKNOWN_TYPE';
// ----- Script (SCR) -----
exports.ERR_SCR_METHOD_NOT_FOUND = 'SCR_METHOD_NOT_FOUND';
exports.ERR_SCR_SCRIPT_NOT_FOUND = 'SCR_SCRIPT_NOT_FOUND';
// ----- Schema (SCH) -----
exports.ERR_SCH_COMPONENT_NOT_FOUND = 'SCH_COMPONENT_NOT_FOUND';
exports.ERR_SCH_CACHE_LOAD_FAILED = 'SCH_CACHE_LOAD_FAILED';
function makeError(code, message, opts) {
    return {
        code,
        message,
        needMoreContext: opts?.needMoreContext,
        fatal: opts?.fatal,
        detail: opts?.detail,
    };
}
function toErrResult(err) {
    return {
        ok: false,
        error: err.message,
        errorCode: err.code,
        needMoreContext: err.needMoreContext,
        fatal: err.fatal,
    };
}
//# sourceMappingURL=error-codes.js.map