const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/products?${query}`);
  },
  
  getProduct(id) {
    return request(`/api/products/${id}`);
  },
  
  createProduct(data) {
    return request('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  updateProduct(id, data) {
    return request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  deleteProduct(id) {
    return request(`/api/products/${id}`, {
      method: 'DELETE',
    });
  },

  getProductTags(id) {
    return request(`/api/products/${id}/tags`);
  },

  attachProductTags(id, tagIds) {
    return request(`/api/products/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagIds }),
    });
  },

  replaceProductTags(id, tagIds) {
    return request(`/api/products/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tagIds }),
    });
  },

  getTags() {
    return request('/api/tags');
  },

  createTag(name) {
    return request('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
};
