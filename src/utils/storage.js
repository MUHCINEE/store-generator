async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the local store server. Start it with npm run dev and check your connection.');
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error || `The server returned an unexpected response (${response.status}).`);
    error.status = response.status;
    error.code = result?.code;
    throw error;
  }
  return result;
}

function subscribe(path, onData, onError, interval = 0) {
  let active = true;
  let pending = false;
  const controller = new AbortController();

  async function refresh() {
    if (!active || pending) return;
    pending = true;
    try {
      const result = await request(path, { signal: controller.signal });
      if (active) onData(result);
    } catch (error) {
      if (active && error.name !== 'AbortError') onError(error);
    } finally {
      pending = false;
    }
  }

  refresh();
  const timer = interval ? window.setInterval(refresh, interval) : null;
  return () => {
    active = false;
    controller.abort();
    if (timer !== null) window.clearInterval(timer);
  };
}

export async function getCurrentUser() {
  const result = await request('/api/auth/me');
  return result.user;
}

export async function signIn(identifier, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { identifier, password }
  });
  return result.user;
}

export async function signOutAccount() {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function createAccount(profile) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: profile
  });
  return result.user;
}

export async function isUsernameAvailable(username) {
  const result = await request(`/api/auth/username-available?username=${encodeURIComponent(username)}`);
  return result.available;
}

export function subscribeToProducts(onProducts, onError, ownerId = '', storeSlug = '') {
  const path = ownerId
    ? '/api/products'
    : `/api/stores/${encodeURIComponent(storeSlug || import.meta.env.VITE_STORE_SLUG || 'maison-verde')}/products`;
  return subscribe(path, onProducts, onError, 10000);
}

export function subscribeToOrders(_ownerId, onOrders, onError) {
  return subscribe('/api/orders', onOrders, onError, 5000);
}

export function subscribeToUserProfile(_userId, onProfile, onError) {
  return subscribe('/api/users/me', onProfile, onError);
}

export async function getPublicStore(storeSlug) {
  try {
    return await request(`/api/stores/${encodeURIComponent(storeSlug)}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function createOrder({ customerName, phoneNumber, location, items, storeSlug }) {
  const result = await request('/api/orders', {
    method: 'POST',
    body: {
      customerName,
      phoneNumber,
      location,
      storeSlug,
      items: items.map(({ product, quantity }) => ({
        productId: product.id,
        quantity
      }))
    }
  });
  return result.id;
}

export async function completeOrder(orderId) {
  await request(`/api/orders/${encodeURIComponent(orderId)}/complete`, { method: 'PATCH' });
}

export async function deleteOrder(orderId) {
  await request(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
}

export async function createProduct(product) {
  const result = await request('/api/products', {
    method: 'POST',
    body: product
  });
  return result.product;
}

export async function updateProduct(productId, product) {
  await request(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: product
  });
}

export async function deleteProduct(productId) {
  await request(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}

export function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function compressCanvas(canvas) {
  for (const quality of [0.78, 0.68, 0.58, 0.48]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= 900_000) return dataUrl;
  }
  throw new Error('That image is too large. Choose a smaller image.');
}
