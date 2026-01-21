<template>
  <div>
    <h2>Products</h2>

    <div v-if="error" class="error">{{ error }}</div>

    <!-- Create Product Form -->
    <div class="card">
      <h3>{{ editing ? 'Edit Product' : 'Create Product' }}</h3>
      <form @submit.prevent="editing ? saveEdit() : createProduct()">
        <div class="form-group">
          <label>Product Name</label>
          <input v-model="form.name" required />
        </div>
        <div class="form-group">
          <label>Price (cents)</label>
          <input v-model.number="form.price_cents" type="number" min="0" required />
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button type="submit" class="btn btn-primary">
            {{ editing ? 'Save' : 'Create' }}
          </button>
          <button v-if="editing" type="button" class="btn btn-secondary" @click="cancelEdit">
            Cancel
          </button>
        </div>
      </form>
    </div>

    <!-- Filters -->
    <div class="card">
      <div style="display: flex; gap: 1rem; align-items: flex-end;">
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
          <label>Search by name</label>
          <input v-model="filters.name" @input="loadProducts" />
        </div>
        <div class="form-group" style="min-width: 200px; margin-bottom: 0;">
          <label>Sort by</label>
          <select v-model="filters.sort" @change="loadProducts">
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="price_asc">Price Low-High</option>
            <option value="price_desc">Price High-Low</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">Loading...</div>

    <!-- Product List -->
    <div v-else class="grid grid-2">
      <div v-for="product in products" :key="product.id" class="card">
        <h3>{{ product.name }}</h3>
        <p><strong>Price:</strong> ${{ (product.price_cents / 100).toFixed(2) }}</p>
        <p><small>Created: {{ new Date(product.created_at).toLocaleDateString() }}</small></p>
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <router-link :to="`/products/${product.id}`" class="btn btn-primary">
            View Details
          </router-link>
          <button class="btn btn-secondary" @click="editProduct(product)">
            Edit
          </button>
          <button class="btn btn-danger" @click="deleteProduct(product.id)">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading" class="card" style="margin-top: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          Showing {{ products.length }} of {{ pagination.total }} products
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button 
            class="btn btn-secondary" 
            @click="prevPage" 
            :disabled="pagination.offset === 0"
          >
            Previous
          </button>
          <button 
            class="btn btn-secondary" 
            @click="nextPage" 
            :disabled="pagination.offset + pagination.limit >= pagination.total"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const products = ref([]);
const loading = ref(false);
const error = ref(null);
const editing = ref(false);

const form = ref({
  name: '',
  price_cents: 0,
});

const filters = ref({
  name: '',
  sort: 'created_at_desc',
});

const pagination = ref({
  limit: 20,
  offset: 0,
  total: 0,
});

async function loadProducts() {
  loading.value = true;
  error.value = null;
  try {
    const params = {
      limit: pagination.value.limit,
      offset: pagination.value.offset,
      sort: filters.value.sort,
    };
    if (filters.value.name) {
      params.name = filters.value.name;
    }
    const data = await api.getProducts(params);
    products.value = data.products;
    pagination.value = data.pagination;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createProduct() {
  error.value = null;
  try {
    await api.createProduct(form.value);
    form.value = { name: '', price_cents: 0 };
    await loadProducts();
  } catch (err) {
    error.value = err.message;
  }
}

function editProduct(product) {
  editing.value = product.id;
  form.value = {
    name: product.name,
    price_cents: product.price_cents,
  };
}

async function saveEdit() {
  error.value = null;
  try {
    await api.updateProduct(editing.value, form.value);
    editing.value = false;
    form.value = { name: '', price_cents: 0 };
    await loadProducts();
  } catch (err) {
    error.value = err.message;
  }
}

function cancelEdit() {
  editing.value = false;
  form.value = { name: '', price_cents: 0 };
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  error.value = null;
  try {
    await api.deleteProduct(id);
    await loadProducts();
  } catch (err) {
    error.value = err.message;
  }
}

function prevPage() {
  if (pagination.value.offset > 0) {
    pagination.value.offset = Math.max(0, pagination.value.offset - pagination.value.limit);
    loadProducts();
  }
}

function nextPage() {
  if (pagination.value.offset + pagination.value.limit < pagination.value.total) {
    pagination.value.offset += pagination.value.limit;
    loadProducts();
  }
}

onMounted(() => {
  loadProducts();
});
</script>
