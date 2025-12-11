async function toWebM(ffmpeg, blob) {
  const inputData = new Uint8Array(await blob.arrayBuffer());
  ffmpeg.FS("writeFile", "input.mp4", inputData);

  const output = "output.webm";

  await ffmpeg.run(
    "-i",
    "input.mp4",
    "-c:v",
    "libvpx", // VP8 (much faster)
    "-b:v",
    "2M", // higher bitrate = fewer CPU cycles
    "-crf",
    "10", // low compression work
    "-speed",
    "8", // EXTREMELY important for WASM
    "-threads",
    "0",
    "-auto-alt-ref",
    "0", // turn off slow filtering
    output
  );

  const data = ffmpeg.FS("readFile", output);
  return new Blob([data.buffer], { type: "video/webm" });
}
