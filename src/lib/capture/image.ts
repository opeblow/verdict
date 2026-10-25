"use client";

import type { AnalysisMode } from "../domain/concerns";

/**
 * Browser-side photo preparation to match YouCam's input rules:
 *   HD: short side at least 1080 px. SD: short side at least 480 px.
 *   The face must be wider than 60% of the image, so every photo is cropped
 *   to a centred 3:4 portrait. That also keeps framing identical between a
 *   laptop webcam and a phone. Long side is capped at 2560 px, files at 10 MB.
 */

export const LONG_SIDE_MAX = 2560;
export const SHORT_SIDE_MIN: Record<AnalysisMode, number> = { hd: 1080, sd: 480 };
export const PORTRAIT = 3 / 4;

export function bestModeFor(width: number, height: number): AnalysisMode | null {
  const short = Math.min(width, height);
  if (short >= SHORT_SIDE_MIN.hd) return "hd";
  if (short >= SHORT_SIDE_MIN.sd) return "sd";
  return null;
}

/** Centred 3:4 portrait crop of a source frame. */
export function portraitCrop(width: number, height: number): { sx: number; sy: number; sw: number; sh: number } {
  if (width / height > PORTRAIT) {
    const sw = Math.round(height * PORTRAIT);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / PORTRAIT);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

export function outputSize(sw: number, sh: number): { width: number; height: number } {
  const long = Math.max(sw, sh);
  if (long <= LONG_SIDE_MAX) return { width: sw, height: sh };
  const s = LONG_SIDE_MAX / long;
  return { width: Math.round(sw * s), height: Math.round(sh * s) };
}

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

export type Drawable = HTMLVideoElement | HTMLImageElement | ImageBitmap | HTMLCanvasElement;

export function sourceSize(src: Drawable): { width: number; height: number } {
  if (typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement) return { width: src.videoWidth, height: src.videoHeight };
  if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
  return { width: src.width, height: src.height };
}

/** The size a photo from this source will have after cropping. */
export function croppedSize(src: Drawable): { width: number; height: number } {
  const { width, height } = sourceSize(src);
  const c = portraitCrop(width, height);
  return outputSize(c.sw, c.sh);
}

/** Crop and encode a frame as a JPEG YouCam accepts. Video frames are not mirrored. */
export async function preparePhoto(src: Drawable): Promise<PreparedPhoto> {
  const { width: w0, height: h0 } = sourceSize(src);
  const crop = portraitCrop(w0, h0);
  const { width, height } = outputSize(crop.sw, crop.sh);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  for (const q of [0.92, 0.85, 0.75]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size < 9.5 * 1024 * 1024) return { blob, width, height };
  }
  throw new Error("Couldn't compress the photo under 10 MB");
}

/** Read the cropped pixels into a small frame for quality checks. */
export function sampleFrame(src: Drawable, canvas: HTMLCanvasElement, sampleWidth = 150) {
  const { width, height } = sourceSize(src);
  if (!width || !height) return null;
  const crop = portraitCrop(width, height);
  const w = sampleWidth;
  const h = Math.round(w / PORTRAIT);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  return { frame: { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }, full: outputSize(crop.sw, crop.sh) };
}

/** Decode an uploaded file, applying its EXIF orientation. */
export async function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}
