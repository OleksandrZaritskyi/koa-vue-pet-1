<template>
  <div>
    <div style="margin-bottom: 1rem;">
      <router-link to="/" class="btn btn-secondary">← Back to Products</router-link>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="product">
      <div class="card">
        <h2>{{ product.name }}</h2>
        <p><strong>Price:</strong> ${{ (product.price_cents / 100).toFixed(2) }}</p>
        <p><strong>ID:</strong> {{ product.id }}</p>
        <p><strong>Created:</strong> {{ new Date(product.created_at).toLocaleString() }}</p>
        <p><strong>Updated:</strong> {{ new Date(product.updated_at).toLocaleString() }}</p>
      </div>

      <!-- Tags Section -->
      <div class="card">
        <h3>Tags</h3>

        <div v-if="loadingTags" class="loading">Loading tags...</div>
        <div v-else>
          <div v-if="productTags.length === 0" style="color: #7f8c8d; margin-bottom: 1rem;">
            No tags assigned
          </div>
          <div v-else style="margin-bottom: 1rem;">
            <span 
              v-for="tag in productTags" 
              :key="tag.id"
              style="display: inline-block; background: #e3f2fd; padding: 0.25rem 0.75rem; border-radius: 16px; margin-right: 0.5rem; margin-bottom: 0.5rem;"
            >
              {{ tag.name }}
            </span>
          </div>

          <!-- Tag Management -->
          <div style="border-top: 1px solid #eee; padding-top: 1rem;">
            <h4>Manage Tags</h4>
            
            <div v-if="loadingAllTags" class="loading">Loading available tags...</div>
            <div v-else-if="allTags.length === 0" style="color: #7f8c8d;">
              No tags available. Create tags first in the database.
            </div>
            <div v-else>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Select tags to assign:</label>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  <label 
                    v-for="tag in allTags" 
                    :key="tag.id"
                    style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;"
                  >
                    <input 
                      type="checkbox" 
                      :value="tag.id" 
                      v-model="selectedTagIds"
                    />
                    {{ tag.name }}
                  </label>
                </div>
              </div>

              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" @click="replaceTags">
                  Replace Tags
                </button>
                <button class="btn btn-secondary" @click="attachTags">
                  Add Tags
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const productId = route.params.id;

const product = ref(null);
const productTags = ref([]);
const allTags = ref([]);
const selectedTagIds = ref([]);

const loading = ref(false);
const loadingTags = ref(false);
const loadingAllTags = ref(false);
const error = ref(null);

async function loadProduct() {
  loading.value = true;
  error.value = null;
  try {
    const data = await api.getProduct(productId);
    product.value = data.product;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadProductTags() {
  loadingTags.value = true;
  try {
    const data = await api.getProductTags(productId);
    productTags.value = data.tags;
    selectedTagIds.value = data.tags.map(t => t.id);
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingTags.value = false;
  }
}

async function loadAllTags() {
  loadingAllTags.value = true;
  try {
    const data = await api.getTags();
    allTags.value = data.tags;
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingAllTags.value = false;
  }
}

async function replaceTags() {
  error.value = null;
  try {
    await api.replaceProductTags(productId, selectedTagIds.value);
    await loadProductTags();
  } catch (err) {
    error.value = err.message;
  }
}

async function attachTags() {
  error.value = null;
  try {
    const newTagIds = selectedTagIds.value.filter(
      id => !productTags.value.some(t => t.id === id)
    );
    if (newTagIds.length === 0) {
      alert('No new tags to attach');
      return;
    }
    await api.attachProductTags(productId, newTagIds);
    await loadProductTags();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(async () => {
  await loadProduct();
  await loadProductTags();
  await loadAllTags();
});
</script>
