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
import { AMPCore, MemoryTier } from "../dist/index.js"; // 引用构建后的 JS 产物

const amp = new AMPCore();

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
      const content = String(args.content);
      const tier = (args.tier as MemoryTier) || MemoryTier.LONG_TERM;
      const importance = typeof args.importance === "number" ? args.importance : 0.5;
      const tags = Array.isArray(args.tags) ? args.tags : [];

      const result = await amp.store({
        tier,
        scope: { userId: "global-mcp-user" }, // MCP 模式下默认全局用户
        content,
        metadata: { importance, tags },
      });

      return {
        content: [{ type: "text", text: `Memory stored successfully! ID: ${result.id}` }],
      };
    } 
    
    if (name === "amp_retrieve_memory") {
      const query = String(args.query);
      const limit = typeof args.limit === "number" ? args.limit : 5;

      const results = await amp.retrieve({ query, limit });
      
      const responseText = results.length > 0
        ? results.map((r, i) => `${i + 1}. [${r.tier}] ${r.content} (Score: ${r.score.toFixed(2)})`).join("\n")
        : "No relevant memories found.";

      return {
        content: [{ type: "text", text: responseText }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// 启动 StdIO 传输 (MCP 标准通信协议)
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
