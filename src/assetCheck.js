import { invoke } from "@tauri-apps/api/core";

export function reportAssetFail(context, filePath) {
  const path = filePath
    ? decodeURIComponent(
        filePath
          .replace(/^https?:\/\/asset\.localhost\//, "")
          .replace(/\//g, "\\")
      )
    : "";
  console.warn(`[ASSET_FAIL] ${context}: ${path}`);
  if (path) {
    invoke("check_asset_path", { path }).catch(() => {});
  }
}
