import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method tidak diizinkan." });
  try {
    const data = JSON.parse(request.body || "{}");
    const fields = ["name", "hobby", "food", "color", "drink", "lastAnswer"];
    for (const field of fields) {
      if (typeof data[field] !== "string" || !data[field].trim()) {
        return json(400, { error: "Semua pertanyaan wajib diisi." });
      }
      if (data[field].length > (field === "lastAnswer" ? 1000 : 180)) {
        return json(400, { error: "Ada jawaban yang terlalu panjang." });
      }
    }
    // Server-side CAPTCHA validation; this is intentionally a lightweight demo, not anti-bot security.
    if (typeof data.captchaInput !== "string" || data.captchaInput.trim().toLowerCase() !== "xyzkk") {
      return json(400, { error: "CAPTCHA salah. Silakan ulangi." });
    }
    const store = getStore("cakaang-answers");
    const answer = {
      name: data.name.trim(), hobby: data.hobby.trim(), food: data.food.trim(),
      color: data.color.trim(), drink: data.drink.trim(), lastAnswer: data.lastAnswer.trim(),
      createdAt: new Date().toISOString(),
    };
    await store.setJSON(randomUUID(), answer);
    return json(200, { ok: true });
  } catch {
    return json(500, { error: "Terjadi kesalahan server. Coba lagi nanti." });
  }
};

export const config = { path: "/.netlify/functions/submit" };

