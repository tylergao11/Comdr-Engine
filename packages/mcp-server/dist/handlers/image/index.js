"use strict";
// ============================================================
// Comdr Image 能力组 — 统一入口
// server.ts 只引这一个文件，内部消化所有图片处理工具
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGenerateImage = exports.GENERATE_IMAGE_TOOL = exports.handleSliceImage = exports.SLICE_IMAGE_TOOL = exports.handleReadImage = exports.READ_IMAGE_TOOL = void 0;
var read_1 = require("./read");
Object.defineProperty(exports, "READ_IMAGE_TOOL", { enumerable: true, get: function () { return read_1.READ_IMAGE_TOOL; } });
Object.defineProperty(exports, "handleReadImage", { enumerable: true, get: function () { return read_1.handleReadImage; } });
var slice_1 = require("./slice");
Object.defineProperty(exports, "SLICE_IMAGE_TOOL", { enumerable: true, get: function () { return slice_1.SLICE_IMAGE_TOOL; } });
Object.defineProperty(exports, "handleSliceImage", { enumerable: true, get: function () { return slice_1.handleSliceImage; } });
var generate_1 = require("./generate");
Object.defineProperty(exports, "GENERATE_IMAGE_TOOL", { enumerable: true, get: function () { return generate_1.GENERATE_IMAGE_TOOL; } });
Object.defineProperty(exports, "handleGenerateImage", { enumerable: true, get: function () { return generate_1.handleGenerateImage; } });
//# sourceMappingURL=index.js.map