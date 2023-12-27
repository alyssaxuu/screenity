async function fetchFile(url) {
  const response = await fetch(url);
  return new Uint8Array(await response.arrayBuffer());
}

export default fetchFile;
