
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const MAX_BODY_SIZE = 8192;
const CAPTCHA_TTL = 5 * 60 * 1000;

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method tidak diizinkan." });
  }

  // Batasi ukuran body jika Content-Length tersedia.
  const contentLength = Number(request.headers.get("content-length"));

  if (
    request.headers.get("content-length") &&
    (!Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_BODY_SIZE)
  ) {
    return json(413, { error: "Data terlalu besar." });
  }

  try {
    // Baca body sebagai teks agar ukuran aktual juga diperiksa.
    const rawBody = await request.text();

    if (rawBody.length > MAX_BODY_SIZE) {
      return json(413, { error: "Data terlalu besar." });
    }

    let data;

    try {
      data = JSON.parse(rawBody);
    } catch {
      return json(400, { error: "Format data tidak valid." });
    }

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return json(400, { error: "Format data tidak valid." });
    }

    const fields = [
      "name",
      "hobby",
      "food",
      "color",
      "drink",
      "lastAnswer",
    ];

    const answer = {};

    for (const field of fields) {
      const value = data[field];

      if (typeof value !== "string" || !value.trim()) {
        return json(400, {
          error: "Semua pertanyaan wajib diisi.",
        });
      }

      const maxLength = field === "lastAnswer" ? 1000 : 180;
      const cleaned = value.trim();

      if (cleaned.length > maxLength) {
        return json(400, {
          error: "Ada jawaban yang terlalu panjang.",
        });
      }

      answer[field] = cleaned;
    }

    const token = data.captchaToken;
    const typed = data.captchaInput;

    if (
      typeof token !== "string" ||
      token.length > 100 ||
      !/^[a-f0-9-]{36}$/i.test(token) ||
      typeof typed !== "string" ||
      typed.length > 20
    ) {
      return json(400, { error: "CAPTCHA tidak valid." });
    }

    const captchaStore = getStore("cakaang-captcha");
    const captcha = await captchaStore.get(token, {
      type: "json",
    });

    if (
      !captcha ||
      typeof captcha.code !== "string" ||
      typeof captcha.createdAt !== "number" ||
      !Number.isFinite(captcha.createdAt)
    ) {
      return json(400, {
        error: "CAPTCHA kedaluwarsa. Silakan coba lagi.",
      });
    }

    // Hapus token sebelum memeriksa jawaban.
    // Ini mengurangi peluang penggunaan ulang token.
    await captchaStore.delete(token);

    const age = Date.now() - captcha.createdAt;

    if (age < 0 || age > CAPTCHA_TTL) {
      return json(400, {
        error: "CAPTCHA kedaluwarsa. Silakan coba lagi.",
      });
    }

    if (!/^[A-Z0-9]{5}$/.test(captcha.code)) {
      return json(400, { error: "CAPTCHA tidak valid." });
    }

    if (typed.trim().toUpperCase() !== captcha.code) {
      return json(400, {
        error: "CAPTCHA salah. Silakan coba lagi.",
      });
    }

    answer.createdAt = new Date().toISOString();

    const store = getStore("cakaang-answers");
    await store.setJSON(randomUUID(), answer);

    return json(200, { ok: true });
  } catch (error) {
    console.error("Submit error:", error);

    return json(500, {
      error: "Terjadi kesalahan server. Coba lagi nanti.",
    });
  }
};

export const config = {
  path: "/.netlify/functions/submit",
};
