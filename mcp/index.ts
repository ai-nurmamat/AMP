#!/usr/bin/env node
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
import * as crypto from "crypto";

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

// Fix 5: Schema for partial updates on PUT /memory/:id
const UpdateMemorySchema = StoreMemorySchema.partial();

const RetrieveMemorySchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  limit: z.number().int().min(1).max(100).optional().default(5),
});

// Fix 10: helper to extract human-readable details from a ZodError across Zod v3/v4
function formatZodError(error: any): string {
  const issues = error?.issues || error?.errors || [];
  return issues
    .map((i: any) => `${(i.path || []).join('.')}: ${i.message}`)
    .join('; ');
}

// Fix 6: constant-time string comparison to avoid timing attacks on the bearer token
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

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
      errorMessage = `Invalid parameters: ${formatZodError(error)}`;
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

// Fix 3: remove hardcoded default token; fail fast in production when AMP_API_TOKEN is missing
const API_TOKEN = process.env.AMP_API_TOKEN;
if (!API_TOKEN && process.env.NODE_ENV === 'production') {
  console.error('[AMP] FATAL: AMP_API_TOKEN environment variable is required in production');
  process.exit(1);
}
const EFFECTIVE_TOKEN = API_TOKEN || 'dev-token-not-for-production';

// Fix 9: userId is derived from a configured identity, NOT from the client-controlled request body.
// NOTE: For multi-tenant deployments, replace this bearer-token model with a real auth system
// (JWT / OAuth) that issues a verified identity per request.
const API_USER_ID = process.env.AMP_API_USER_ID || 'api-user';

// 启动 Express 服务器，为 Chrome 扩展等提供 HTTP 安全接口
const app = express();

// Fix 4: restrict CORS origins instead of leaving it wide open
const allowedOrigins = process.env.AMP_CORS_ORIGINS
  ? process.env.AMP_CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'chrome-extension://*'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  // allow same-origin / curl
    if (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  }
}));

// Fix 7: enforce a body size limit to mitigate large-payload abuse
app.use(express.json({ limit: '1mb' }));

// HTTP Token 认证中间件 (Fix 6: constant-time comparison)
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!safeEqual(token, EFFECTIVE_TOKEN)) {
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
      // Fix 9: scope.userId comes from the authenticated identity, not req.body
      scope: { userId: API_USER_ID, agentId: req.body.agentId },
      content: parsedArgs.content,
      metadata: { importance: parsedArgs.importance, tags: parsedArgs.tags },
    });

    res.json({ success: true, id: result.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: formatZodError(error) });
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
      res.status(400).json({ error: "Validation failed", details: formatZodError(error) });
    } else {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});

// REST API: 更新记忆 (Fix 5: validate req.body with Zod before passing to amp.update)
app.put("/memory/:id", async (req, res) => {
  try {
    const parsed = UpdateMemorySchema.parse(req.body);
    const result = await amp.update(req.params.id, parsed);
    if (!result) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: formatZodError(error) });
    } else {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
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

// Fix 8: handle server-level errors (e.g. EADDRINUSE) instead of crashing with a stack trace
const httpServer = app.listen(PORT, () => {
  console.error(`[AMP HTTP] Server listening on port ${PORT} for REST APIs`);
});
httpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[AMP] Port ${PORT} already in use. Set PORT=<other> to use a different port.`);
    process.exit(1);
  }
  console.error('[AMP] Server error:', err);
  process.exit(1);
});

// Fix 11: graceful shutdown — dispose AMPCore on process signals
async function shutdown(signal: string) {
  console.log(`[AMP] ${signal} received, shutting down`);
  try {
    await (amp as any).dispose?.();
  } catch (err) {
    console.error('[AMP] Error during dispose:', err);
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
