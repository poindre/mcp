"use client";

import dynamic from "next/dynamic";

const McpClient = dynamic(() => import("@/components/McpClient"), {
  ssr: false,
  loading: () => <p className="text-center p-8">Loading MCP Client...</p>,
});

// ホームページコンポーネント - アプリケーションのメインページ
export default function Home() {
  return (
    <div>
      <McpClient />
    </div>
  );
}
