// ==============================
// CATALOGUE CATEGORIES
// ==============================

let allCatalogueProducts = [];
let selectedCategory = null;

async function loadCatalogueWithCategories() {
  try {
    // Load all products
    const prodRes = await fetch('/api/catalogue');
    allCatalogueProducts = (await prodRes.json()) || [];

    // Load categories
    const catRes = await fetch('/api/warehouse/categories');
    let categories = (await catRes.json()) || [];

    // Render filters
    const filtersHtml = '<button class="btn btn-secondary" onclick="filterByCategory(null)" style="' + (selectedCategory === null ? 'background:#0066cc;color:#fff;' : '') + '">Wszystkie kategorie</button>' +
      categories.map(cat => `
        <button class="btn btn-secondary" onclick="filterByCategory('${esc(cat)}')" style="${selectedCategory === cat ? 'background:#0066cc;color:#fff;' : ''}">
          ${esc(cat)}
        </button>
      `).join('');
    document.getElementById('catalogueFilters').innerHTML = filtersHtml;

    renderProductsByCategory();
  } catch (err) {
    console.error('Error loading catalogue:', err);
  }
}

function filterByCategory(category) {
  selectedCategory = category;
  loadCatalogueWithCategories();
}

function renderProductsByCategory() {
  const container = document.getElementById('productsByCategory');

  if (!allCatalogueProducts.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:2rem;">Brak produktów w katalogu.</p>';
    return;
  }

  // Filter by selected category
  let filtered = allCatalogueProducts;
  if (selectedCategory) {
    filtered = filtered.filter(p => (p.category || 'Inne') === selectedCategory);
  }

  if (!filtered.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:2rem;">Brak produktów w wybranej kategorii.</p>';
    return;
  }

  // Group by category
  const byCategory = {};
  filtered.forEach(p => {
    const cat = p.category || 'Inne';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  // Render as accordion/sections
  const html = Object.entries(byCategory).map(([category, products]) => `
    <div style="margin-bottom:1.5rem;">
      <h3 style="margin-bottom:0.75rem;padding:0.75rem;background:#f5f5f5;border-radius:4px;cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? '' : 'none';">
        <i data-lucide="chevron-down" style="width:1.2em;height:1.2em;vertical-align:middle;margin-right:0.5em;"></i>${esc(category)} (${products.length})
      </h3>
      <div class="products-grid" style="margin-top:0.75rem;">
        ${products.map(p => `
          <div class="product-card" onclick="openDetail(${p.product_id},'${esc(p.product_name)}','${esc(p.product_location)}',${p.product_price})">
            <h3>${esc(p.product_name)}</h3>
            <div class="product-meta">
              <span><i data-lucide="map-pin" style="width:1em;height:1em;vertical-align:middle;"></i> ${esc(p.product_location)}</span>
            </div>
            <div class="product-price">${p.product_price.toFixed(2)} zł</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Load on page init
loadCatalogueWithCategories();
