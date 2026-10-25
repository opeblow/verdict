/**
 * YouCam engine errors and the plain-language fix for each.
 *
 * Live responses deliver the engine error as a stringified Python tuple,
 * for example "('The face area in the uploaded image is too small',
 * 'error_src_face_too_small')". Documentation shows a bare code. Both forms
 * are handled.
 */

export interface EngineError {
  code: string;
  message: string;
}

export function parseEngineError(raw: unknown): EngineError {
  if (raw == null) return { code: "unknown_internal_error", message: "Unknown error" };
  const text = String(raw);
  const tuple = /\(\s*['"](.+?)['"]\s*,\s*['"]([a-z0-9_]+)['"]\s*\)/i.exec(text);
  if (tuple) return { message: tuple[1]!, code: tuple[2]! };
  if (/^[a-z0-9_]+$/i.test(text)) return { code: text, message: text };
  return { code: "unknown_internal_error", message: text };
}

const GUIDANCE: Record<string, string> = {
  error_src_face_too_small: "Move closer. Your face should fill most of the oval, about two thirds of the photo's width.",
  error_face_position_too_small: "Move closer. Your face should fill most of the oval.",
  error_src_face_out_of_bound: "Centre your face in the oval, with your whole face in the frame.",
  error_face_position_out_of_boundary: "Centre your face in the oval, with your whole face in the frame.",
  error_face_position_invalid: "Centre your face in the oval and look straight at the camera.",
  error_lighting_dark: "It's too dark. Face a window or a bright light, and avoid light from behind you.",
  error_below_min_image_size: "This photo's resolution is too low. Use the rear camera or upload a larger photo.",
  error_exceed_max_image_size: "This photo is too large. Try again and Verdict will resize it.",
  exceed_max_filesize: "This photo is over 10 MB. Try again and Verdict will compress it.",
  error_no_face: "No face was found. Look straight at the camera with your face in the oval.",
  error_pose: "Face the camera straight on, chin level.",
  error_face_parsing: "Part of your face is hidden. Pull back hair and remove glasses.",
  error_face_not_forward_facing: "Face the camera straight on, chin level.",
  error_nsfw_content_detected: "This photo couldn't be analysed. Use a plain face photo.",
  error_decode_image: "This file couldn't be read. Use a JPG or PNG photo.",
  error_download_image: "The photo didn't upload properly. Check your connection and try again.",
  error_inference: "The analysis service had a problem. Try again in a minute.",
  unknown_internal_error: "The analysis service had a problem. Try again in a minute.",
};

export function guidanceFor(code: string): string {
  return GUIDANCE[code] ?? "The photo couldn't be analysed. Retake it facing the camera in even light.";
}

/** Errors the person can fix by retaking the photo, as opposed to service faults. */
export function isRetakeError(code: string): boolean {
  return /face|lighting|pose|image_size|filesize|nsfw|decode/.test(code);
}
