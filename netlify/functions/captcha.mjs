
import { getStore } from "@netlify/blobs";
import { randomBytes, randomUUID } from "node:crypto";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export default async (request) => {
  if (request.method !== "GET") {
    return json(405, { error: "Method tidak diizinkan." });
  }

  try {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(5);
    const code = Array.from(
      bytes,
      (b) => chars[b % chars.length]
    ).join("");

    const token = randomUUID();
    const store = getStore("cakaang-captcha");

    await store.setJSON(token, {
      code,
      createdAt: Date.now(),
    });

    return json(200, { code, token });
  } catch (error) {
    console.error("CAPTCHA error:", error);
    return json(500, { error: "Gagal membuat CAPTCHA." });
  }
};

export const config = {
  path: "/.netlify/functions/captcha",
};
