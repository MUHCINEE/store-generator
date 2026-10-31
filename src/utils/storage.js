export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...options.headers,
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
  } catch {
    throw new Error('Could not reach the store. Check your connection and try again.');
  }

  if (response.status === 204) return null;
  let responseText;
  try {
    responseText = await response.text();
  } catch {
    throw new Error('The store response could not be read. Please try again.');
  }
  let data;
  try {
    if (!responseText) throw new Error('Empty response');
    data = JSON.parse(responseText);
  } catch {
    if (response.ok) throw new Error('The store returned an invalid response. Please try again.');
    data = {};
  }
  if (response.status === 401 && path.startsWith('/api/admin/')) {
    window.dispatchEvent(new Event('atelier:session-expired'));
  }
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The store returned an invalid response. Please try again.');
  }
  return data;
}

export function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function compressCanvas(canvas) {
  for (const quality of [0.78, 0.68, 0.58, 0.48]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= 2_500_000) return dataUrl;
  }
  throw new Error('That image is too large after compression. Choose a smaller file.');
}
