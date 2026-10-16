
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method tidak diizinkan." });
  }

  try {
    const data = await request.json();

    const fields = [
      "name",
      "hobby",
      "food",
      "color",
      "drink",
      "lastAnswer",
    ];

    for (const field of fields) {
      if (
        typeof data[field] !== "string" ||
        !data[field].trim()
      ) {
        return json(400, {
          error: "Semua pertanyaan wajib diisi.",
        });
      }

      const maxLength = field === "lastAnswer" ? 1000 : 180;

      if (data[field].length > maxLength) {
        return json(400, {
          error: "Ada jawaban yang terlalu panjang.",
        });
      }
    }

    // Validasi CAPTCHA dari server
    const token = data.captchaToken;
    const typed = data.captchaInput;

    if (
      typeof token !== "string" ||
      typeof typed !== "string"
    ) {
      return json(400, {
        error: "CAPTCHA tidak valid.",
      });
    }

    const captchaStore = getStore("cakaang-captcha");
    const captcha = await captchaStore.get(token, {
      type: "json",
    });

    if (!captcha) {
      return json(400, {
        error: "CAPTCHA kedaluwarsa. Silakan coba lagi.",
      });
    }

    // Token hanya boleh digunakan sekali
    await captchaStore.delete(token);

    if (Date.now() - captcha.createdAt > 5 * 60 * 1000) {
      return json(400, {
        error: "CAPTCHA kedaluwarsa. Silakan coba lagi.",
      });
    }

    if (typed.trim().toUpperCase() !== captcha.code) {
      return json(400, {
        error: "CAPTCHA salah. Silakan coba lagi.",
      });
    }

    const store = getStore("cakaang-answers");

    const answer = {
      name: data.name.trim(),
      hobby: data.hobby.trim(),
      food: data.food.trim(),
      color: data.color.trim(),
      drink: data.drink.trim(),
      lastAnswer: data.lastAnswer.trim(),
      createdAt: new Date().toISOString(),
    };

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
