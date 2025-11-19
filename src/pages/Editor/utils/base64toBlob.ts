function base64ToUint8Array(base64) {
  const dataURLRegex = /^data:.+;base64,/;
  if (dataURLRegex.test(base64)) {
    base64 = base64.replace(dataURLRegex, "");
  }

  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }

  return bytes;
}

async function base64ToBlob(ffmpeg, base64) {
  const input = base64ToUint8Array(base64);
  ffmpeg.FS("writeFile", "input.webm", input);

  await ffmpeg.run(
    "-i",
    "input.webm",
    "-max_muxing_queue_size",
    "512",
    "-preset",
    "superfast",
    "-threads",
    "0",
    "-r",
    "30",
    "-tune",
    "fastdecode",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");
  const videoBlob = new Blob([data.buffer], { type: "video/mp4" });

  return videoBlob;
}

export default base64ToBlob;
