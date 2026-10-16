
import { getStore } from "@netlify/blobs";
import { randomInt, randomUUID } from "node:crypto";
import { PNG } from "pngjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const FONT = {
  A:["01110","10001","10001","11111","10001","10001","10001"],
  B:["11110","10001","10001","11110","10001","10001","11110"],
  C:["01111","10000","10000","10000","10000","10000","01111"],
  D:["11110","10001","10001","10001","10001","10001","11110"],
  E:["11111","10000","10000","11110","10000","10000","11111"],
  F:["11111","10000","10000","11110","10000","10000","10000"],
  G:["01111","10000","10000","10111","10001","10001","01111"],
  H:["10001","10001","10001","11111","10001","10001","10001"],
  J:["00111","00010","00010","00010","10010","10010","01100"],
  K:["10001","10010","10100","11000","10100","10010","10001"],
  L:["10000","10000","10000","10000","10000","10000","11111"],
  M:["10001","11011","10101","10101","10001","10001","10001"],
  N:["10001","11001","11001","10101","10011","10011","10001"],
  P:["11110","10001","10001","11110","10000","10000","10000"],
  Q:["01110","10001","10001","10001","10101","10010","01101"],
  R:["11110","10001","10001","11110","10100","10010","10001"],
  S:["01111","10000","10000","01110","00001","00001","11110"],
  T:["11111","00100","00100","00100","00100","00100","00100"],
  U:["10001","10001","10001","10001","10001","10001","01110"],
  V:["10001","10001","10001","10001","10001","01010","00100"],
  W:["10001","10001","10001","10101","10101","10101","01010"],
  X:["10001","10001","01010","00100","01010","10001","10001"],
  Y:["10001","10001","01010","00100","00100","00100","00100"],
  Z:["11111","00001","00010","00100","01000","10000","11111"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],
  "3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],
  "5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],
  "7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],
  "9":["01110","10001","10001","01111","00001","00001","01110"]
};

function drawChar(png, char, x, y, scale, color) {
  const glyph = FONT[char];

  for (let row = 0; row < glyph.length; row++) {
    for (let col = 0; col < glyph[row].length; col++) {
      if (glyph[row][col] !== "1") continue;

      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = x + col * scale + dx;
          const py = y + row * scale + dy;

          if (
            px >= 0 && px < png.width &&
            py >= 0 && py < png.height
          ) {
            const i = (png.width * py + px) * 4;
            png.data[i] = color[0];
            png.data[i + 1] = color[1];
            png.data[i + 2] = color[2];
            png.data[i + 3] = 255;
          }
        }
      }
    }
  }
}

function makeCaptcha(code) {
  const png = new PNG({ width: 240, height: 84 });

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) * 4;
      const shade = 239 + randomInt(0, 12);

      png.data[i] = shade;
      png.data[i + 1] = Math.max(0, shade - 5);
      png.data[i + 2] = Math.max(0, shade - 15);
      png.data[i + 3] = 255;
    }
  }

  for (let n = 0; n < 14; n++) {
    const x1 = randomInt(0, png.width);
    const y1 = randomInt(0, png.height);
    const x2 = randomInt(0, png.width);
    const y2 = randomInt(0, png.height);
    const steps = Math.max(
      Math.abs(x2 - x1),
      Math.abs(y2 - y1),
      1
    );

    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x1 + (x2 - x1) * s / steps);
      const y = Math.round(y1 + (y2 - y1) * s / steps);

      if (x < 0 || x >= png.width || y < 0 || y >= png.height) {
        continue;
      }

      const i = (png.width * y + x) * 4;
      png.data[i] = 170;
      png.data[i + 1] = 155;
      png.data[i + 2] = 145;
      png.data[i + 3] = 255;
    }
  }

  for (let i = 0; i < code.length; i++) {
    drawChar(
      png,
      code[i],
      20 + i * 42 + randomInt(-3, 4),
      20 + randomInt(-4, 5),
      5,
      [35, 35, 35]
    );
  }

  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

export default async (request) => {
  if (request.method !== "GET") {
    return json(405, { error: "Method tidak diizinkan." });
  }

  try {
    const code = Array.from(
      { length: 5 },
      () => CHARS[randomInt(0, CHARS.length)]
    ).join("");

    const token = randomUUID();
    const store = getStore("cakaang-captcha");

    await store.setJSON(token, {
      code,
      createdAt: Date.now()
    });

    return json(200, {
      token,
      image: makeCaptcha(code)
    });
  } catch (error) {
    console.error("CAPTCHA error:", error);
    return json(500, {
      error: "Gagal membuat CAPTCHA."
    });
  }
};

export const config = {
  path: "/.netlify/functions/captcha"
};
