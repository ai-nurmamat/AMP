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
  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof z.ZodError) {
      errorMessage = `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
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
