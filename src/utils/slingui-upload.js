export const UploadStrategyPathEnum = {
  AVATAR: 'avatar',
  RECORDING: 'recording',
  AUDIO_ANSWER: 'audioAnswer',
  CHAT: 'chat',
};

export async function getSignedUrl(data, token) {
  const API_BASE = 'https://api.slingui.com';
  const res = await fetch(`${API_BASE}/storage/upload`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error('Falha ao obter URL assinado para upload');
  }
  return await res.json();
}

export async function sendFile(uploadUrl, blob, contentType) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': contentType.split(';')[0],
      'Access-Control-Allow-Origin': '*',
      DISABLE_INTERCEPTORS: 'true',
    },
    body: blob,
  });
  if (!res.ok) {
    throw new Error('Falha ao enviar arquivo para a URL assinada');
  }
}

export async function upload(data, blob, token) {
  const result = await getSignedUrl(data, token);
  console.log('result', result);
  await sendFile(result.uploadURL, blob, result.contentType);
  return result;
}

export async function getDownloadUrlByName(fileName, token) {
  try {
    const API_BASE = import.meta.env.VITE_URL ?? 'https://api.slingui.com';
    const url = new URL(`${API_BASE}/storage/download`);
    url.searchParams.set('url', fileName);
    url.searchParams.set('strategy', 'chat');
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data.uploadUrl || data.url || null;
    }
    const text = await res.text();
    return text && /^https?:\/\//.test(text) ? text : null;
  } catch {
    return null;
  }
}
