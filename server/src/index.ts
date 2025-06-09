import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import axios from "axios";
import express from "express";
import { parseStringPromise } from "xml2js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const mcpServer = new McpServer({
  name: "stateful-server",
  version: "1.0.0",
});

mcpServer.tool(
  "roll_dice",
  "サイコロを振った結果を返します",
  {
    sides: z.number().min(1).default(6).describe("サイコロの面の数"),
  },
  async (input) => {
    const sides = input.sides ?? 6;
    const result = Math.floor(Math.random() * sides) + 1;
    return {
      content: [
        {
          type: "text",
          text: result.toString(),
        },
      ],
    };
  },
);

function transformAreanameToId(
  areaData: any,
  areaName: string,
): string | undefined {
  for (const prefecture of areaData.rss.channel[0]["ldWeather:source"][0]
    .pref) {
    for (const city of prefecture.city) {
      if (city.$.title === areaName) {
        return city.$.id;
      }
    }
  }
}

mcpServer.tool(
  "fetch_weather",
  "Fetch Wether",
  {
    city: z.string(),
  },
  async ({ city }) => {
    const url = "https://weather.tsukumijima.net/primary_area.xml";
    const feed = await axios.get(url, { responseType: "text" });
    const xml = feed.data;
    const areaData = await parseStringPromise(xml);
    const id = transformAreanameToId(areaData, city);

    if (!id) {
      return {
        content: [
          {
            type: "text",
            text: `指定された都市「${city}」は見つかりませんでした。`,
          },
        ],
      };
    }

    const response = await fetch(
      `https://weather.tsukumijima.net/api/forecast/city/${id}`,
    );
    const data = await response.text();
    console.log(data);
    const jsonData = JSON.parse(data);
    const result = [jsonData.title, jsonData.description.bodyText].join("\n");
    return {
      content: [{ type: "text", text: result }],
    };
  },
);

mcpServer.tool(
  "stream_chat",
  "ストリーミングでチャットレスポンスを返します",
  {
    prompt: z.string(),
  },
  async (input, ctx) => {
    const prompt = input.prompt;
    console.log(prompt);

    // ストリーミングレスポンスを作成
    return {
      content: [
        {
          type: "text",
          text: prompt,
        },
      ],
      // ストリーミング処理を設定
      stream: async function* () {
        // メッセージを単語単位で分割して少しずつ送信
        const words =
          `こんにちは！「${prompt}」についてお答えします。 これはストリーミングレスポンスのデモです。 少しずつテキストが表示されていきます。 モデルが考えているように見せることができます。 実際のAIモデルと連携する場合は、そのAPIからのストリームをここで処理します。`.split(
            " ",
          );

        let fullResponse = "";

        for (const word of words) {
          // 少し遅延を入れる（実際のAIレスポンスのようにするため）
          await new Promise((resolve) => setTimeout(resolve, 100));

          fullResponse += word + " ";

          // 現在までの完全な応答を含むコンテンツを返す
          yield {
            content: [
              {
                type: "text",
                text: fullResponse,
              },
            ],
          };
        }
      },
    };
  },
);

const app = express();
const cors = require("cors");

app.use(
  cors({
    origin: ["http://localhost:8080", "http://localhost:3000"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Mcp-Session-Id"],
    exposedHeaders: ["Mcp-Session-Id"],
    credentials: true,
    maxAge: 86400,
  }),
);

app.options("/mcp", (req, res) => {
  res.status(200).end();
});

app.use(express.json());

app.use((req, res, next) => {
  if (!req.headers.accept) {
    req.headers.accept = "application/json, text/event-stream";
  }
  next();
});

app.post("/mcp", async (req, res) => {
  console.log("Received POST MCP request");
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (
      // 新規セッション初期化の条件 - 以下のいずれかの場合に新しいセッションを作成
      // 1. セッションIDがなく、リクエストが初期化リクエスト
      // 2. セッションIDがなく、メソッドが'initialize'（フロントエンド用の特別対応）
      // 3. メソッドが'server/info'（サーバー情報取得リクエスト）
      ((isInitializeRequest(req.body) || req.body.method === "initialize") &&
        !sessionId) ||
      req.body.method === "server/info"
    ) {
      console.log("Initializing new session for request:", req.body);

      const eventStore = new InMemoryEventStore();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ID: ${sid}`);
          delete transports[sid];
        }
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res
      .status(400)
      .send(
        "Invalid or missing session ID. Please provide a valid session ID.",
      );
    return;
  }

  console.log(`Closing session for ID: ${sessionId}`);
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error closing transport:", error);
    if (!res.headersSent) {
      res.status(500).send("Error closing transport");
    }
  }
});

app.get("/mcp", async (req, res) => {
  console.log("Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
  );
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Stateful server is running on http://localhost:${PORT}/mcp`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  try {
    for (const sessionId in transports) {
      const transport = transports[sessionId];
      if (transport) {
        await transport.close();
        console.log(`Transport closed for session ID: ${sessionId}`);
      }
    }
  } catch (error) {
    console.error(`Error closing transport:`, error);
  }
  await mcpServer.close();
  console.log("Server shutdown complete");
  process.exit(0);
});
