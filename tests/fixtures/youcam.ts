/**
 * Response shapes for YouCam AI Skin Analysis, following the official OpenAPI
 * description (docs.perfectcorp.com, AI Skin Analysis) and the error format
 * observed from the live API, where the engine error is a stringified tuple.
 * URLs are placeholders.
 */

export const fileRegistered = {
  status: 200,
  data: {
    files: [
      {
        content_type: "image/jpeg",
        file_name: "verdict.jpg",
        file_id: "SaGaqpDgKwFrVBgMpQMA3HY0LeqdT9/13W5TOD8/u/FfjK3xgCQ+hRt9MJXBFaud",
        requests: [
          {
            method: "PUT",
            url: "https://yce-us.s3-accelerate.amazonaws.com/demo/ttl30/upload-signature",
            headers: { "Content-Length": "4", "Content-Type": "image/jpeg" },
          },
        ],
      },
    ],
  },
};

export const taskCreated = { status: 200, data: { task_id: "SaGaqpDgKwFrVBgMpQMA3HY0LeqdT9_13W5TOD8_u_GPi6NqQ3dhlmN-6ntFwhzT" } };

export const taskRunning = { status: 200, data: { task_status: "running", results: null, error: null } };

export const hdSuccess = {
  status: 200,
  data: {
    task_status: "success",
    error: null,
    results: {
      output: [
        { type: "hd_wrinkle", region: "whole", raw_score: 49.64, ui_score: 65, mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/hd_wrinkle_all.png"] },
        { type: "hd_wrinkle", region: "crowfeet", raw_score: 83.43, ui_score: 78, mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/hd_wrinkle_crowfeet.png"] },
        { type: "hd_pore", region: "whole", raw_score: 49.23, ui_score: 67, mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/hd_pore_all.png"] },
        { type: "hd_pore", region: "nose", raw_score: 29.13, ui_score: 58, mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/hd_pore_nose.png"] },
        { type: "hd_redness", raw_score: 72.01, ui_score: 77, mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/hd_redness.png"] },
        { type: "hd_dark_circle", raw_score: 80.19, ui_score: 76, mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/hd_dark_circle.png"] },
        { type: "hd_skin_type", region: "t_zone", skin_type: "Oily", mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/t_zone.png"] },
        { type: "hd_skin_type", region: "whole", skin_type: "Combination", mask_urls: [] },
        { type: "skin_age", score: 29 },
        { type: "all", score: 75.75 },
        { type: "resize_image", mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/resized_image.jpg"] },
      ],
    },
  },
};

export const sdSuccess = {
  status: 200,
  data: {
    error: null,
    task_status: "success",
    results: {
      output: [
        { ui_score: 70, raw_score: 56.37, type: "oiliness", mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/oiliness_output.png"], url: null },
        { ui_score: 75, raw_score: 67.49, type: "redness", mask_urls: ["https://yce-us.s3-accelerate.amazonaws.com/r/redness_output.png"], url: null },
        { ui_score: 76, raw_score: 80.1, type: "dark_circle_v2", mask_urls: [], url: null },
        { score: 72.75, type: "all", url: null },
        { score: 48, type: "skin_age", url: null },
      ],
    },
  },
};

export const faceTooSmall = {
  status: 200,
  data: {
    error: "('The face area in the uploaded image is too small', 'error_src_face_too_small')",
    results: null,
    task_status: "error",
  },
};

export const mixedModes = { status: 400, error: "cannot mix HD and SD dst_actions", error_code: "InvalidParameters" };
export const noUnits = { status: 400, error: "The operation could not be completed", error_code: "CreditInsufficiency" };
