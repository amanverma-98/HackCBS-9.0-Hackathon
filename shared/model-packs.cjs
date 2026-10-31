function packStatus({ code, inManifest, installed, downloading, paused, failed, downloadedBytes = 0, expectedBytes = 0 }) {
  let state = "unavailable";
  if (installed) state = "installed";
  else if (downloading) state = "downloading";
  else if (paused) state = "paused";
  else if (failed) state = "failed";
  else if (downloadedBytes > 0) state = "partial";
  else if (inManifest) state = "available";
  return { code, state, installed: state === "installed", downloadable: inManifest && state !== "installed", expectedBytes, downloadedBytes };
}

module.exports = { packStatus };
