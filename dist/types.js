"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryTier = void 0;
// 2. 记忆层级 (Memory Tier) - 高速缓存与冷热数据分层模型
var MemoryTier;
(function (MemoryTier) {
    MemoryTier["WORKING"] = "working";
    MemoryTier["LONG_TERM"] = "long_term";
    MemoryTier["GRAPH"] = "graph"; // 图记忆：面向复杂逻辑、实体关系及多跳推理的结构化图谱层
})(MemoryTier || (exports.MemoryTier = MemoryTier = {}));
