"use client";

import { useState, useEffect } from "react";
import {
  initializeClient,
  getSessionId,
  terminateSession,
  listTools,
  rollDice,
  getWether,
  getTransport,
} from "@/libs/mcp-client";

export default function McpClient() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tools, setTools] = useState<any[]>([]);
  const [diceResult, setDiceResult] = useState<string | null>(null);
  const [wetherResult, setWetherResult] = useState<string | null>(null);
  const [sides, setSides] = useState(6);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setError(null);
      try {
        await initializeClient();
        console.log(getSessionId());
        setSessionId(getSessionId());
      } catch (err) {
        setError(
          `初期化エラー: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const handleListTools = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(getTransport());
      const toolsList = await listTools();
      setTools(toolsList);
    } catch (err) {
      setError(
        `ツール一覧取得エラー: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRollDice = async () => {
    if (isNaN(sides) || sides < 1) {
      setError("有効な数値を入力してください");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await rollDice(sides);
      setDiceResult(result);
    } catch (err) {
      setError(
        `サイコロエラー: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  async function handleGetWether() {
    if (city == null && city === "") {
      setError("有効な値を入力してください");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getWether(city);
      setWetherResult(result);
    } catch (err) {
      setError(
        `天気取得エラー: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }

  const handleTerminateSession = async () => {
    setLoading(true);
    setError(null);
    try {
      await terminateSession();
      updateSessionStatus();
    } catch (err) {
      setError(
        `セッション終了エラー: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <p>セッション情報</p>
        <p>
          {sessionId
            ? `アクティブなセッション: ${sessionId}`
            : "セッションなし"}
        </p>
        <button
          onClick={handleTerminateSession}
          disabled={!sessionId || loading}
        >
          セッションを終了
        </button>
      </div>

      <div>
        <p>ツール一覧</p>
        <button onClick={handleListTools} disabled={loading}>
          ツール一覧を取得
        </button>
        <div>
          {loading && <p>ロード中...</p>}{" "}
          {!loading && tools.length === 0 && <p>ツールはありません</p>}
          {!loading && tools.length > 0 && (
            <ul>
              {tools.map((tool, index) => (
                <li key={index}>
                  {tool.name}：{tool.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <hr />

      <div>
        <p>サイコロツール</p>
        <div>
          <label htmlFor="sides">サイコロの面の数:</label>
          <input
            type="number"
            id="sides"
            min="1"
            value={sides}
            onChange={(e) => setSides(parseInt(e.target.value))}
          />
        </div>
        <button onClick={handleRollDice} disabled={loading}>
          サイコロを振る
        </button>
        <div>
          {loading && <p>ロード中...</p>}
          {!loading && !diceResult && <p>サイコロを振ってください</p>}
          {!loading && diceResult && <div>{diceResult}</div>}
        </div>
      </div>

      <hr />

      <div>
        <p>天気予報取得ツール</p>
        <div>
          <label htmlFor="city">取得対象の都市：</label>
          <input
            type="text"
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <button onClick={handleGetWether} disabled={loading}>
          天気を取得する
        </button>
        <div>
          {loading && <p>ロード中...</p>}
          {!loading && !wetherResult && <p>天気を取得してください</p>}
          {!loading && wetherResult && <div>{wetherResult}</div>}
        </div>
      </div>

      {error && (
        <div>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
