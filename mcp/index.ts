#!/usr/bin/env node --experimental-modules
/**
 * AMP MCP (Model Context Protocol) Server
 * 颠覆性创新：让任何支持 MCP 的客户端 (Cursor, Claude Desktop 等) 都可以直接连接全局记忆。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AMPCore, MemoryTier } from "../dist/index.js"; 
import express from "express";
import cors from "cors";

const amp = new AMPCore({
  redisUrl: process.env.REDIS_URL // 支持通过环境变量开启 Redis 持久化
});

const server = new Server(
  {
    name: "amp-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Zod Schemas for robust validation
const StoreMemorySchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  tier: z.nativeEnum(MemoryTier).optional().default(MemoryTier.LONG_TERM),
  importance: z.number().min(0).max(1).optional().default(0.5),
  tags: z.array(z.string()).optional().default([]),
});

const RetrieveMemorySchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  limit: z.number().int().min(1).max(100).optional().default(5),
});

// 暴露 AMP 的记忆管理能力为 MCP Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: amp.getMemoryTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "amp_store_memory") {
      const parsedArgs = StoreMemorySchema.parse(args);

      const result = await amp.store({
        tier: parsedArgs.tier,
        scope: { userId: "global-mcp-user" }, // MCP 模式下默认全局用户
        content: parsedArgs.content,
        metadata: { importance: parsedArgs.importance, tags: parsedArgs.tags },
      });

      return {
        content: [{ type: "text", text: `Memory stored successfully! ID: ${result.id}` }],
      };
    } 
    
    if (name === "amp_retrieve_memory") {
      const parsedArgs = RetrieveMemorySchema.parse(args);

      const results = await amp.retrieve({ query: parsedArgs.query, limit: parsedArgs.limit });
      
      const responseText = results.length > 0
        ? results.map((r, i) => `${i + 1}. [${r.tier}] ${r.content} (Score: ${r.score.toFixed(2)})`).join("\n")
        : "No relevant memories found.";

      return {
        content: [{ type: "text", text: responseText }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof z.ZodError) {
      errorMessage = `Invalid parameters: ${(error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// 启动 StdIO 传输 (MCP 标准通信协议)
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);

// 启动 Express 服务器，为 Chrome 扩展等提供 HTTP 安全接口
const app = express();
app.use(cors());
app.use(express.json());

const API_TOKEN = process.env.AMP_API_TOKEN || "default-dev-token";

// HTTP Token 认证中间件
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// REST API: 存储记忆
app.post("/memory", async (req, res) => {
  try {
    const parsedArgs = StoreMemorySchema.parse(req.body);

    const result = await amp.store({
      tier: parsedArgs.tier,
      scope: { userId: req.body.userId || "api-user" },
      content: parsedArgs.content,
      metadata: { importance: parsedArgs.importance, tags: parsedArgs.tags },
    });

    res.json({ success: true, id: result.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid parameters", details: (error as any).errors });
    } else {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});

// REST API: 检索记忆
app.post("/retrieve", async (req, res) => {
  try {
    const parsedArgs = RetrieveMemorySchema.parse(req.body);
    const results = await amp.retrieve({ query: parsedArgs.query, limit: parsedArgs.limit });
    res.json({ success: true, data: results });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid parameters", details: (error as any).errors });
    } else {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});

// REST API: 更新记忆
app.put("/memory/:id", async (req, res) => {
  try {
    const result = await amp.update(req.params.id, req.body);
    if (!result) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// REST API: 删除记忆
app.delete("/memory/:id", async (req, res) => {
  try {
    const result = await amp.delete(req.params.id);
    res.json({ success: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.error(`[AMP HTTP] Server listening on port ${PORT} for REST APIs`);
});

