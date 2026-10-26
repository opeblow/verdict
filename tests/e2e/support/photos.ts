import type { Page } from "@playwright/test";

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Draws an illustrated face in the browser and returns it as a JPEG. The suite
 * never commits or uploads a real person's photo. The capture checks only look
 * at light and sharpness, and YouCam itself is mocked, so a drawing is enough.
 *
 * `light` scales the whole image: 1 is even daylight, 0.3 is a dim room.
 * `seed` varies the skin texture so replicate photos are not byte-identical.
 */
export async function syntheticFace(page: Page, { light = 1, seed = 1 } = {}): Promise<FilePayload> {
  const base64 = await page.evaluate(
    async ({ light, seed }) => {
      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 1200;
      const g = c.getContext("2d")!;
      g.fillStyle = "#e4ddd2";
      g.fillRect(0, 0, 900, 1200);
      g.fillStyle = "#3a2f28";
      g.beginPath();
      g.ellipse(450, 470, 330, 420, 0, Math.PI, 2 * Math.PI);
      g.fill();
      g.fillStyle = "#dcae8c";
      g.beginPath();
      g.ellipse(450, 560, 300, 380, 0, 0, 2 * Math.PI);
      g.fill();
      g.fillRect(380, 900, 140, 300);

      // Fine skin texture, so the sharpness check sees real detail.
      let s = seed * 9301;
      const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 9000; i++) {
        const shade = Math.round(150 + rnd() * 70);
        g.fillStyle = `rgba(${shade},${Math.round(shade * 0.72)},${Math.round(shade * 0.58)},0.5)`;
        g.fillRect(170 + rnd() * 560, 200 + rnd() * 720, 2, 2);
      }

      g.fillStyle = "rgba(60,40,30,0.85)";
      for (const x of [340, 560]) {
        g.beginPath();
        g.ellipse(x, 520, 34, 16, 0, 0, 2 * Math.PI);
        g.fill();
      }
      g.strokeStyle = "rgba(120,60,50,0.8)";
      g.lineWidth = 8;
      g.beginPath();
      g.arc(450, 740, 70, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();

      if (light !== 1) {
        g.globalCompositeOperation = "multiply";
        const v = Math.round(255 * Math.min(1, light));
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(0, 0, 900, 1200);
      }

      const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin);
    },
    { light, seed },
  );
  return { name: `face-${seed}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}
