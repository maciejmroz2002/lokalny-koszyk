// Check if user is logged in
let currentUser = null;
let editingProductId = null;

window.addEventListener('load', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }
  
  // Decode JWT to get user info
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUser = {
      username: payload.username,
      role: payload.role
    };
    displayUserInfo();
    setupInventoryAccess();
    loadCatalogue();
  } catch (e) {
    console.error('Invalid token:', e);
    localStorage.removeItem('token');
    window.location.href = 'index.html';
  }
});

function displayUserInfo() {
  document.getElementById('username').textContent = `Użytkownik: ${currentUser.username}`;
  const roleBadge = document.getElementById('userRole');
  roleBadge.textContent = currentUser.role.toUpperCase();
  roleBadge.className = `role-badge role-${currentUser.role}`;
}

function setupInventoryAccess() {
  // Show inventory menu only for admin and magazynier
  if (currentUser.role === 'admin' || currentUser.role === 'magazynier') {
    document.getElementById('inventoryMenuBtn').style.display = 'flex';
  }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
});

// View switching
document.querySelectorAll('.menu-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const view = e.currentTarget.dataset.view;
    switchView(view, e.currentTarget);
  });
});

function switchView(view, button) {
  // Update menu
  document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
  
  // Update content
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.getElementById(view + '-view').classList.add('active');
  
  if (view === 'inventory') {
    loadInventory();
  }
}

// CATALOGUE VIEW
async function loadCatalogue() {
  try {
    const response = await fetch('http://localhost:8080/api/catalogue');
    if (!response.ok) throw new Error('Failed to load catalogue');
    const products = await response.json() || [];
    displayCatalogue(products);
  } catch (error) {
    console.error('Error loading catalogue:', error);
    document.getElementById('catalogueGrid').innerHTML = '<p class="error">Nie udało się wczytać katalogów</p>';
  }
}

function displayCatalogue(products) {
  const grid = document.getElementById('catalogueGrid');
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
      <button class="btn-detail-icon" onclick="viewCatalogueDetail(${product.product_id}, '${product.product_name}', '${product.product_location}', ${product.product_price})" title="Szczegóły">⋮</button>
    </div>
  `).join('');
}

function viewCatalogueDetail(id, name, location, price) {
  document.getElementById('catalogueDetailName').textContent = name;
  document.getElementById('catalogueDetailLocation').textContent = location;
  document.getElementById('catalogueDetailPrice').textContent = price.toFixed(2);
  document.getElementById('catalogueDetailModal').style.display = 'flex';
}

// INVENTORY MANAGEMENT
async function loadInventory() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:8080/api/inventory', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Failed to load inventory');
    const items = await response.json() || [];
    displayInventory(items);
  } catch (error) {
    console.error('Error loading inventory:', error);
    document.getElementById('inventoryBody').innerHTML = '<tr><td colspan="6" class="error">Nie udało się wczytać zapasów</td></tr>';
  }
}

function displayInventory(items) {
  const tbody = document.getElementById('inventoryBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Brak produktów w zapasach</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr>
      <td>${item.product_id}</td>
      <td>${item.product_name}</td>
      <td>${item.product_location}</td>
      <td>${item.product_price.toFixed(2)} zł</td>
      <td>${item.product_count}</td>
      <td class="actions">
        <button class="btn-small btn-edit" onclick="editProduct(${item.product_id})">Edytuj</button>
        <button class="btn-small btn-delete" onclick="deleteProduct(${item.product_id})">Usuń</button>
      </td>
    </tr>
  `).join('');
}

// Modal management
document.getElementById('addProductBtn').addEventListener('click', () => {
  editingProductId = null;
  document.getElementById('modalTitle').textContent = 'Dodaj Produkt';
  document.getElementById('productForm').reset();
  document.getElementById('productModal').style.display = 'block';
});

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('productModal').style.display = 'none';
  editingProductId = null;
}

window.addEventListener('click', (e) => {
  const modal = document.getElementById('productModal');
  if (e.target === modal) {
    closeModal();
  }
});

// Product operations
async function editProduct(productId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8080/api/inventory/${productId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load product');
    const product = await response.json();
    
    editingProductId = productId;
    document.getElementById('modalTitle').textContent = 'Edytuj Produkt';
    document.getElementById('productName').value = product.product_name;
    document.getElementById('productLocation').value = product.product_location;
    document.getElementById('productPrice').value = product.product_price;
    document.getElementById('productCount').value = product.product_count;
    document.getElementById('productModal').style.display = 'block';
  } catch (error) {
    alert('Błąd przy wczytywaniu produktu: ' + error.message);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Czy na pewno chcesz usunąć ten produkt?')) return;
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8080/api/inventory/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete product');
    loadInventory();
  } catch (error) {
    alert('Błąd przy usuwaniu produktu: ' + error.message);
  }
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productData = {
    product_name: document.getElementById('productName').value,
    product_location: document.getElementById('productLocation').value,
    product_price: parseFloat(document.getElementById('productPrice').value),
    product_count: parseInt(document.getElementById('productCount').value)
  };
  
  try {
    const token = localStorage.getItem('token');
    const method = editingProductId ? 'PUT' : 'POST';
    const url = editingProductId 
      ? `http://localhost:8080/api/inventory/${editingProductId}`
      : `http://localhost:8080/api/inventory`;
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    if (!response.ok) throw new Error('Failed to save product');
    
    closeModal();
    loadInventory();
    alert(editingProductId ? 'Produkt zaktualizowany' : 'Produkt dodany');
  } catch (error) {
    alert('Błąd: ' + error.message);
  }
});
