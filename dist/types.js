"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryTier = void 0;
// 2. 记忆层级 (Tier) - 独家的高速缓存与冷热数据分层模型
var MemoryTier;
(function (MemoryTier) {
    MemoryTier["WORKING"] = "working";
    MemoryTier["LONG_TERM"] = "long_term";
    MemoryTier["GRAPH"] = "graph"; // 图记忆 (实体关系、复杂的逻辑多跳推理)
})(MemoryTier || (exports.MemoryTier = MemoryTier = {}));
