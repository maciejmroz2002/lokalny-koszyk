// Fetch and display products from catalogue API
async function loadProducts() {
  try {
    const response = await fetch('http://localhost:8080/api/catalogue');
    if (!response.ok) {
      throw new Error('Failed to load products');
    }
    const products = await response.json() || [];
    displayProducts(products);
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('productsGrid').innerHTML = '<p class="error">Nie udało się wczytać produktów</p>';
  }
}

function displayProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products || products.length === 0) {
    grid.innerHTML = '<p>Brak produktów w katalogu</p>';
    return;
  }

  grid.innerHTML = products.map(product => `
    <div class="product-card">
      <h3>${product.product_name}</h3>
      <div class="product-info">
        <p><strong>Lokalizacja:</strong> ${product.product_location}</p>
        <p><strong>Cena:</strong> ${product.product_price.toFixed(2)} zł</p>
      </div>
      <button class="btn-detail-icon" onclick="viewProductDetail(${product.product_id}, '${product.product_name}', '${product.product_location}', ${product.product_price})" title="Szczegóły">⋮</button>
    </div>
  `).join('');
}

function viewProductDetail(productId, productName, productLocation, productPrice) {
  document.getElementById('modalProductName').textContent = productName;
  document.getElementById('modalProductContent').innerHTML = `
    <div class="product-details">
      <p><strong>ID:</strong> ${productId}</p>
      <p><strong>Nazwa:</strong> ${productName}</p>
      <p><strong>Lokalizacja:</strong> ${productLocation}</p>
      <p><strong>Cena:</strong> ${productPrice.toFixed(2)} zł</p>
    </div>
  `;
  document.getElementById('productModal').style.display = 'block';
}

// Modal close
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('productModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }
  
  window.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  loadProducts();
});

// Load products on page load (fallback)
window.addEventListener('load', function() {
  if (document.getElementById('productsGrid').innerHTML.includes('Wczytywanie')) {
    loadProducts();
  }
});
