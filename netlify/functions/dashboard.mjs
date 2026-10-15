import { getStore } from "@netlify/blobs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method tidak diizinkan." });
  const expected = process.env.ADMIN_CODE;
  if (!expected) return json(500, { error: "ADMIN_CODE belum diatur di Netlify." });
  try {
    const { code } = JSON.parse(request.body || "{}");
    if (typeof code !== "string" || code !== expected) {
      return json(401, { error: "Kode salah. Akses ditolak." });
    }
    const store = getStore("cakaang-answers");
    const listing = await store.list();
    const answers = [];
    for (const item of listing.blobs || []) {
      const answer = await store.get(item.key, { type: "json" });
      if (answer) answers.push(answer);
    }
    answers.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json(200, { answers });
  } catch {
    return json(500, { error: "Gagal membaca data jawaban." });
  }
};

export const config = { path: "/.netlify/functions/dashboard" };

