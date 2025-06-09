import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "roll_dice",
      "Rolls an N-sided die",
      { sides: z.number().int().min(2) },
      async ({ sides }) => {
        const value = 1 + Math.floor(Math.random() * sides);
        return {
          content: [{ type: "text", text: `🎲 You rolled a ${value}!` }],
        };
      },
    );
    server.tool(
      "fetch_weather",
      "Fetch Wether",
      { city: z.string() },
      async ({ city }) => {
        const response = await fetch(
          `https://weather.tsukumijima.net/api/forecast/city/${city}`,
        );
        const data = await response.text();
        return {
          content: [{ type: "text", text: data }],
        };
      },
    );
  },
  {},
  {
    basePath: "/api/",
    verboseLogs: true,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
