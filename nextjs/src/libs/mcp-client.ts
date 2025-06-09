import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolRequest,
  CallToolResultSchema,
  ListToolsRequest,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;
let sessionId: string | undefined;

const SERVER_URL = "http://localhost:3000/api/mcp";

export async function initializeClient() {
  if (client && transport) return client;

  try {
    console.log("Initializing MCP client...");
    console.log("Server URL:", SERVER_URL);

    // MCPクライアントインスタンスの作成 - サーバーとの通信を管理する中心的なオブジェクト
    // client = new Client({
    //   name: "stateful-frontend", // クライアントの名前を指定 - サーバー側でクライアントを識別するために使用
    //   version: "1.0.0", // クライアントのバージョンを指定 - 互換性確認やログ記録に役立つ
    // });
    client = new Client({
      name: "stateful",
      version: "1.0.0",
    });

    client.onerror = (error) => {
      console.error("Client error:", error);
    };

    const transportOptions: StreamableHTTPClientTransportOptions = {
      requestInit: {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
      },
    };

    if (sessionId) {
      transportOptions["sessionId"] = sessionId;
    }

    // Streamable HTTP トランスポートを初期化 - MCPサーバーとの通信チャネルを確立
    transport = new StreamableHTTPClientTransport(
      new URL(SERVER_URL),
      transportOptions,
    );

    console.log("Connecting to server...");
    await client.connect(transport);
    console.log("Connected to server");

    console.log(transport);
    if (transport.sessionId) {
      sessionId = transport.sessionId;
      console.log("Session initialized with ID:", sessionId);
    } else {
      console.warn("No session ID received from server");
    }

    return client;
  } catch (error) {
    console.error("Error initializing client:", error);
    throw error;
  }
}

/**
 * 現在のセッションIDを取得する関数
 * @returns 現在のセッションID、未初期化の場合はundefined
 */
export function getSessionId() {
  return sessionId;
}

export function getTransport() {
  return transport;
}

/**
 * セッションを終了する非同期関数 - ステートフルサーバーとの接続を明示的に終了する
 * @throws セッション終了処理中にエラーが発生した場合
 */
export async function terminateSession() {
  if (!transport) {
    console.log("No active transport to terminate");
    return;
  }

  try {
    await transport.terminateSession();
    console.log("Session terminated");
    sessionId = undefined;

    await closeClient();
  } catch (error) {
    console.error("Error terminating session:", error);
    throw error;
  }
}

/**
 * クライアントとトランスポートを閉じる非同期関数 - リソースを適切に解放するためのクリーンアップ処理
 * @throws クライアントまたはトランスポートの終了処理中にエラーが発生した場合
 */
export async function closeClient() {
  try {
    if (transport) {
      await transport.close();
      console.log("Transport closed");
    }

    if (client) {
      await client.close();
      console.log("Client closed");
    }

    client = null;
    transport = null;
  } catch (error) {
    console.error("Error closing client:", error);
    throw error;
  }
}

/**
 * ツール一覧を取得する非同期関数 - サーバーから利用可能なツールの一覧を取得
 * @returns ツール一覧の配列
 * @throws ツール一覧取得中にエラーが発生した場合
 */
export async function listTools() {
  const mcpClient = await initializeClient();

  try {
    const req: ListToolsRequest = {
      method: "tools/list",
      params: {},
    };

    const res = await mcpClient.request(req, ListToolsResultSchema);
    return res.tools;
  } catch (error) {
    console.error("Error listing tools:", error);
    throw error;
  }
}

export async function rollDice(sides: number) {
  if (isNaN(sides) || sides <= 0) {
    throw new Error("Invalid number of sides");
  }

  const mcpClient = await initializeClient();

  try {
    const req: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "roll_dice",
        arguments: { sides },
      },
    };

    const res = await mcpClient.request(req, CallToolResultSchema);

    const textContent = res.content.find((item) => item.type === "text");
    if (textContent) {
      return textContent.text;
    } else {
      throw new Error("No text content in response");
    }
  } catch (error) {
    console.error("Error rolling dice:", error);
    throw error;
  }
}

export async function getWether(city: string) {
  if (city == null && city === "") {
    throw new Error("Invalid value of cities");
  }

  const mcpClient = await initializeClient();

  try {
    const req: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "fetch_weather",
        arguments: { city },
      },
    };

    const res = await mcpClient.request(req, CallToolResultSchema);

    const textContent = res.content.find((item) => item.type === "text");
    if (textContent) {
      return textContent.text;
    } else {
      throw new Error("No text content in response");
    }
  } catch (error) {
    console.error("Error rolling dice:", error);
    throw error;
  }
}
