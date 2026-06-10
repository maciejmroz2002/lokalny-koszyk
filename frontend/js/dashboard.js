// dashboard.js
// Depends on app.js (getCurrentUser, apiFetch, clearToken, getToken)

let currentUser = null;
let catalogueProducts = [];   // cache for order form selects
let currentOrderId = null;    // for order detail modal

// ==============================
// INIT
// ==============================
(function init() {
  currentUser = getCurrentUser();
  if (!currentUser) { window.location.href = 'login.html'; return; }

  setupSidebar();
  setupHtmxCatalogueTransform();
  loadCatalogue();

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    window.location.href = 'index.html';
  });

  // Nav item clicks
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
})();

// ==============================
// SIDEBAR / ROLE SETUP
// ==============================
function setupSidebar() {
  const u = currentUser;
  document.getElementById('sidebarUsername').textContent = u.username;
  const badge = document.getElementById('sidebarRoleBadge');
  badge.textContent = roleName(u.role);
  badge.className = `badge badge-${u.role}`;

  const show = (...ids) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });

  if (u.role === 'admin' || u.role === 'magazynier') {
    show('labelInventory','navInventory','navMove','navDeliveries');
  }
  if (u.role === 'admin') {
    show('labelAdmin','navOrdersAdmin','navSuppliers','navClients');
  }
  if (u.role === 'supplier') {
    show('labelSupplier','navMyDeliveries','navNewDelivery','navSupplierProfile');
  }
  if (u.role === 'client') {
    show('labelClient','navMyOrders','navNewOrder','navClientProfile');
  }
}

function roleName(r) {
  return { admin: 'Admin', magazynier: 'Magazynier', supplier: 'Dostawca', client: 'Klient' }[r] || r;
}

// ==============================
// VIEW SWITCHING
// ==============================
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  const btn = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (btn) btn.classList.add('active');

  // Lazy-load data when switching
  const loaders = {
    inventory:       loadInventory,
    moveItem:        loadMoveItemSelect,
    deliveries:      loadDeliveries,
    orders:          loadAllOrders,
    suppliers:       loadSuppliers,
    clients:         loadClients,
    myDeliveries:    loadMyDeliveries,
    myOrders:        loadMyOrders,
    supplierProfile: loadSupplierProfile,
    clientProfile:   loadClientProfile,
    newOrder:        initNewOrder,
  };
  if (loaders[name]) loaders[name]();
}

// ==============================
// HTMX — CATALOGUE CARD RENDER
// ==============================
function setupHtmxCatalogueTransform() {
  document.body.addEventListener('htmx:afterRequest', e => {
    const el = e.detail.elt;
    if (!['catGrid'].includes(el.id)) return;
    if (!e.detail.successful) { el.innerHTML = '<p style="color:var(--danger);padding:2rem">Błąd wczytywania katalogu.</p>'; return; }
    try {
      const products = JSON.parse(e.detail.xhr.responseText) || [];
      catalogueProducts = products;
      if (!products.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:2rem">Brak produktów.</p>'; return; }
      el.innerHTML = products.map(p => `
        <div class="product-card">
          <h3>${esc(p.product_name)}</h3>
          <div class="product-meta"><span>📍 ${esc(p.product_location)}</span></div>
          <div class="product-price">${p.product_price.toFixed(2)} zł</div>
        </div>
      `).join('');
    } catch { /* ignore */ }
  });
}

function loadCatalogue() {
  const grid = document.getElementById('catGrid');
  if (grid && !catalogueProducts.length) {
    apiFetch('/api/catalogue').then(async res => {
      catalogueProducts = (await res.json()) || [];
      renderCatalogueGrid();
    });
  }
}

function renderCatalogueGrid() {
  const grid = document.getElementById('catGrid');
  if (!grid) return;
  if (!catalogueProducts.length) { grid.innerHTML = '<p style="color:var(--text-muted)">Brak produktów.</p>'; return; }
  grid.innerHTML = catalogueProducts.map(p => `
    <div class="product-card">
      <h3>${esc(p.product_name)}</h3>
      <div class="product-meta"><span>📍 ${esc(p.product_location)}</span></div>
      <div class="product-price">${p.product_price.toFixed(2)} zł</div>
    </div>
  `).join('');
}

// ==============================
// INVENTORY
// ==============================
async function loadInventory() {
  const tbody = document.getElementById('invBody');
  tbody.innerHTML = loadingRow(6);
  try {
    const res = await apiFetch('/api/inventory');
    const items = (await res.json()) || [];
    if (!items.length) { tbody.innerHTML = emptyRow(6, 'Brak produktów w magazynie.'); return; }
    tbody.innerHTML = items.map(i => `
      <tr>
        <td>${i.product_id}</td>
        <td>${esc(i.product_name)}</td>
        <td>${esc(i.product_location)}</td>
        <td>${Number(i.product_price).toFixed(2)} zł</td>
        <td>${i.product_count}</td>
        <td class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEditProduct(${i.product_id})">Edytuj</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct(${i.product_id})">Usuń</button>
        </td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = emptyRow(6, 'Błąd wczytywania.');
  }
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

async function openEditProduct(id) {
  try {
    const res = await apiFetch(`/api/inventory/${id}`);
    const p = await res.json();
    document.getElementById('modalProductTitle').textContent = 'Edytuj produkt';
    document.getElementById('editProductId').value = p.product_id;
    document.getElementById('mpName').value = p.product_name;
    document.getElementById('mpLocation').value = p.product_location;
    document.getElementById('mpPrice').value = p.product_price;
    document.getElementById('mpCount').value = p.product_count;
    hideEl('mpError');
    openModal('modalAddProduct');
  } catch { alert('Nie udało się wczytać produktu.'); }
}

// Reset modal to "add" state when opened via button
function openAddProductModal() {
  document.getElementById('modalProductTitle').textContent = 'Dodaj produkt';
  document.getElementById('editProductId').value = '';
  document.getElementById('mpName').value = '';
  document.getElementById('mpLocation').value = '';
  document.getElementById('mpPrice').value = '';
  document.getElementById('mpCount').value = '';
  hideEl('mpError');
  openModal('modalAddProduct');
}
// Override the onclick on the button
document.querySelector('[onclick="openModal(\'modalAddProduct\')"]')
  && (document.querySelector('[onclick="openModal(\'modalAddProduct\')"]').onclick = openAddProductModal);

async function saveProduct() {
  const id = document.getElementById('editProductId').value;
  const body = {
    product_name:     document.getElementById('mpName').value.trim(),
    product_location: document.getElementById('mpLocation').value.trim(),
    product_price:    parseFloat(document.getElementById('mpPrice').value),
    product_count:    parseInt(document.getElementById('mpCount').value),
  };
  if (!body.product_name || !body.product_location || isNaN(body.product_price) || isNaN(body.product_count)) {
    showEl('mpError', 'Uzupełnij wszystkie pola.'); return;
  }
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/inventory/${id}` : '/api/inventory';
  try {
    const res = await apiFetch(url, { method, body: JSON.stringify(body) });
    if (!res.ok) { showEl('mpError', await res.text()); return; }
    closeModal('modalAddProduct');
    loadInventory();
    // refresh catalogue cache
    catalogueProducts = [];
    loadCatalogue();
  } catch { showEl('mpError', 'Błąd połączenia.'); }
}

async function deleteProduct(id) {
  if (!confirm('Usunąć produkt?')) return;
  await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
  loadInventory();
}

// ==============================
// MOVE ITEM
// ==============================
async function loadMoveItemSelect() {
  const sel = document.getElementById('moveProductId');
  sel.innerHTML = '<option>Wczytywanie…</option>';
  const res = await apiFetch('/api/inventory');
  const items = (await res.json()) || [];
  sel.innerHTML = items.map(i =>
    `<option value="${i.product_id}">${esc(i.product_name)} (${esc(i.product_location)})</option>`
  ).join('');
}

async function doMoveItem() {
  hideEl('moveError'); hideEl('moveSuccess');
  const body = {
    product_id:   parseInt(document.getElementById('moveProductId').value),
    new_location: document.getElementById('moveLocation').value.trim(),
    quantity:     parseInt(document.getElementById('moveQty').value) || 0,
  };
  if (!body.new_location) { showEl('moveError', 'Podaj lokalizację.'); return; }
  try {
    const res = await apiFetch('/api/inventory/move', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { showEl('moveError', await res.text()); return; }
    showEl('moveSuccess', 'Towar przesunięty.');
    document.getElementById('moveLocation').value = '';
  } catch { showEl('moveError', 'Błąd połączenia.'); }
}

// ==============================
// DELIVERIES (admin + magazynier)
// ==============================
async function loadDeliveries() {
  const tbody = document.getElementById('deliveriesBody');
  tbody.innerHTML = loadingRow(7);
  try {
    const res = await apiFetch('/api/deliveries');
    const items = (await res.json()) || [];
    if (!items.length) { tbody.innerHTML = emptyRow(7, 'Brak dostaw.'); return; }
    tbody.innerHTML = items.map(d => `
      <tr>
        <td>${d.delivery_id}</td>
        <td>${esc(d.supplier_username)}</td>
        <td>${esc(d.product_name)}</td>
        <td>${d.quantity}</td>
        <td>${Number(d.proposed_price).toFixed(2)} zł</td>
        <td><span class="status-badge status-${d.status}">${statusLabel(d.status)}</span></td>
        <td class="td-actions">
          ${d.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="openDeliveryStatus(${d.delivery_id})">Zmień status</button>` : '—'}
        </td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = emptyRow(7, 'Błąd wczytywania.');
  }
}

function openDeliveryStatus(id) {
  document.getElementById('dsDeliveryId').value = id;
  document.getElementById('dsStatus').value = 'accepted';
  document.getElementById('dsNotes').value = '';
  document.getElementById('dsLocation').value = '';
  hideEl('dsError');
  toggleLocationField();
  openModal('modalDeliveryStatus');
}

function toggleLocationField() {
  const status = document.getElementById('dsStatus').value;
  document.getElementById('dsLocationGroup').style.display = status === 'completed' ? '' : 'none';
}

async function saveDeliveryStatus() {
  const id = document.getElementById('dsDeliveryId').value;
  const body = {
    status: document.getElementById('dsStatus').value,
    notes:  document.getElementById('dsNotes').value,
    location: document.getElementById('dsLocation').value.trim(),
  };
  if (body.status === 'completed' && !body.location) { showEl('dsError', 'Lokalizacja jest wymagana przy realizacji.'); return; }
  try {
    const res = await apiFetch(`/api/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) { showEl('dsError', await res.text()); return; }
    closeModal('modalDeliveryStatus');
    loadDeliveries();
    // Refresh inventory if completed
    if (body.status === 'completed') {
      catalogueProducts = [];
      loadCatalogue();
    }
  } catch { showEl('dsError', 'Błąd połączenia.'); }
}

// ==============================
// ALL ORDERS (admin + magazynier)
// ==============================
async function loadAllOrders() {
  const tbody = document.getElementById('ordersBody');
  tbody.innerHTML = loadingRow(6);
  const status = document.getElementById('orderStatusFilter').value;
  const qs = status ? `?status=${status}` : '';
  try {
    const res = await apiFetch('/api/orders' + qs);
    const orders = (await res.json()) || [];
    if (!orders.length) { tbody.innerHTML = emptyRow(6, 'Brak zamówień.'); return; }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.order_id}</td>
        <td>${esc(o.client_username)}</td>
        <td><span class="status-badge status-${o.status}">${statusLabel(o.status)}</span></td>
        <td>${Number(o.total_price).toFixed(2)} zł</td>
        <td>${fmtDate(o.created_at)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="openOrderDetail(${o.order_id}, 'staff')">Szczegóły</button></td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = emptyRow(6, 'Błąd wczytywania.');
  }
}

// ==============================
// SUPPLIERS (admin)
// ==============================
async function loadSuppliers() {
  const tbody = document.getElementById('suppliersBody');
  tbody.innerHTML = loadingRow(4);
  try {
    const res = await apiFetch('/api/suppliers');
    const items = (await res.json()) || [];
    if (!items.length) { tbody.innerHTML = emptyRow(4, 'Brak dostawców.'); return; }
    tbody.innerHTML = items.map(s => `
      <tr>
        <td>${esc(s.username)}</td>
        <td>${esc(s.company_name || '—')}</td>
        <td>${esc(s.phone || '—')}</td>
        <td>${esc(s.email || '—')}</td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = emptyRow(4, 'Błąd.'); }
}

// ==============================
// CLIENTS (admin)
// ==============================
async function loadClients() {
  const tbody = document.getElementById('clientsBody');
  tbody.innerHTML = loadingRow(5);
  try {
    const res = await apiFetch('/api/clients');
    const items = (await res.json()) || [];
    if (!items.length) { tbody.innerHTML = emptyRow(5, 'Brak klientów.'); return; }
    tbody.innerHTML = items.map(c => `
      <tr>
        <td>${esc(c.username)}</td>
        <td>${esc(c.full_name || '—')}</td>
        <td>${esc(c.email || '—')}</td>
        <td>${esc(c.phone || '—')}</td>
        <td>${esc(c.address || '—')}</td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = emptyRow(5, 'Błąd.'); }
}

// ==============================
// MY DELIVERIES (supplier)
// ==============================
async function loadMyDeliveries() {
  const tbody = document.getElementById('myDeliveriesBody');
  tbody.innerHTML = loadingRow(7);
  try {
    const res = await apiFetch('/api/deliveries');
    const items = (await res.json()) || [];
    if (!items.length) { tbody.innerHTML = emptyRow(7, 'Brak Twoich dostaw.'); return; }
    tbody.innerHTML = items.map(d => `
      <tr>
        <td>${d.delivery_id}</td>
        <td>${esc(d.product_name)}</td>
        <td>${d.quantity}</td>
        <td>${Number(d.proposed_price).toFixed(2)} zł</td>
        <td><span class="status-badge status-${d.status}">${statusLabel(d.status)}</span></td>
        <td>${esc(d.notes || '—')}</td>
        <td>${fmtDate(d.created_at)}</td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = emptyRow(7, 'Błąd.'); }
}

// ==============================
// NEW DELIVERY (supplier)
// ==============================
async function doCreateDelivery() {
  hideEl('ndError'); hideEl('ndSuccess');
  const body = {
    product_name:   document.getElementById('ndProductName').value.trim(),
    quantity:       parseInt(document.getElementById('ndQuantity').value),
    proposed_price: parseFloat(document.getElementById('ndPrice').value),
    notes:          document.getElementById('ndNotes').value.trim(),
  };
  if (!body.product_name || isNaN(body.quantity) || isNaN(body.proposed_price)) {
    showEl('ndError', 'Uzupełnij wymagane pola.'); return;
  }
  try {
    const res = await apiFetch('/api/deliveries', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { showEl('ndError', await res.text()); return; }
    showEl('ndSuccess', 'Zgłoszenie dostawy wysłane!');
    document.getElementById('ndProductName').value = '';
    document.getElementById('ndQuantity').value = '1';
    document.getElementById('ndPrice').value = '';
    document.getElementById('ndNotes').value = '';
    setTimeout(() => switchView('myDeliveries'), 1200);
  } catch { showEl('ndError', 'Błąd połączenia.'); }
}

// ==============================
// SUPPLIER PROFILE
// ==============================
async function loadSupplierProfile() {
  try {
    const res = await apiFetch('/api/supplier/profile');
    const p = await res.json();
    document.getElementById('spCompany').textContent = p.company_name || '—';
    document.getElementById('spPhone').textContent = p.phone || '—';
    document.getElementById('spEmail').textContent = p.email || '—';
    // pre-fill edit fields
    document.getElementById('spEditCompany').value = p.company_name || '';
    document.getElementById('spEditPhone').value = p.phone || '';
    document.getElementById('spEditEmail').value = p.email || '';
  } catch { /* ignore */ }
}

function toggleSupplierEdit(on) {
  document.getElementById('supplierProfileView').style.display = on ? 'none' : '';
  document.getElementById('supplierProfileEdit').style.display = on ? 'flex' : 'none';
  document.getElementById('editSupplierBtn').style.display = on ? 'none' : '';
  hideEl('spError');
}

async function saveSupplierProfile() {
  hideEl('spError');
  const body = {
    company_name: document.getElementById('spEditCompany').value.trim(),
    phone:        document.getElementById('spEditPhone').value.trim(),
    email:        document.getElementById('spEditEmail').value.trim(),
  };
  try {
    const res = await apiFetch('/api/supplier/profile', { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) { showEl('spError', await res.text()); return; }
    toggleSupplierEdit(false);
    loadSupplierProfile();
  } catch { showEl('spError', 'Błąd połączenia.'); }
}

// ==============================
// CLIENT PROFILE
// ==============================
async function loadClientProfile() {
  try {
    const res = await apiFetch('/api/client/profile');
    const p = await res.json();
    document.getElementById('cpFullName').textContent = p.full_name || '—';
    document.getElementById('cpEmail').textContent = p.email || '—';
    document.getElementById('cpPhone').textContent = p.phone || '—';
    document.getElementById('cpAddress').textContent = p.address || '—';
    document.getElementById('cpEditFullName').value = p.full_name || '';
    document.getElementById('cpEditEmail').value = p.email || '';
    document.getElementById('cpEditPhone').value = p.phone || '';
    document.getElementById('cpEditAddress').value = p.address || '';
  } catch { /* ignore */ }
}

function toggleClientEdit(on) {
  document.getElementById('clientProfileView').style.display = on ? 'none' : '';
  document.getElementById('clientProfileEdit').style.display = on ? 'flex' : 'none';
  hideEl('cpError');
}

async function saveClientProfile() {
  hideEl('cpError');
  const body = {
    full_name: document.getElementById('cpEditFullName').value.trim(),
    email:     document.getElementById('cpEditEmail').value.trim(),
    phone:     document.getElementById('cpEditPhone').value.trim(),
    address:   document.getElementById('cpEditAddress').value.trim(),
  };
  try {
    const res = await apiFetch('/api/client/profile', { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) { showEl('cpError', await res.text()); return; }
    toggleClientEdit(false);
    loadClientProfile();
  } catch { showEl('cpError', 'Błąd połączenia.'); }
}

// ==============================
// MY ORDERS (client)
// ==============================
async function loadMyOrders() {
  const tbody = document.getElementById('myOrdersBody');
  tbody.innerHTML = loadingRow(6);
  try {
    const res = await apiFetch('/api/orders');
    const orders = (await res.json()) || [];
    if (!orders.length) { tbody.innerHTML = emptyRow(6, 'Nie masz jeszcze zamówień.'); return; }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.order_id}</td>
        <td><span class="status-badge status-${o.status}">${statusLabel(o.status)}</span></td>
        <td>${Number(o.total_price).toFixed(2)} zł</td>
        <td>${esc(o.delivery_address)}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="openOrderDetail(${o.order_id}, 'client')">Szczegóły</button></td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = emptyRow(6, 'Błąd.'); }
}

// ==============================
// NEW ORDER (client)
// ==============================
let orderItemCount = 0;

function initNewOrder() {
  // Prefill address from profile
  apiFetch('/api/client/profile').then(async r => {
    const p = await r.json();
    if (p.address) document.getElementById('noAddress').value = p.address;
  }).catch(() => {});

  // Load catalogue for selects
  if (!catalogueProducts.length) {
    apiFetch('/api/catalogue').then(async r => {
      catalogueProducts = (await r.json()) || [];
      renderCatalogueGrid();
    });
  }
  // Reset
  document.getElementById('orderItemsList').innerHTML = '';
  document.getElementById('noNotes').value = '';
  document.getElementById('orderTotal').textContent = '';
  hideEl('noError'); hideEl('noSuccess');
  orderItemCount = 0;
  addOrderItemRow();
}

function addOrderItemRow() {
  const idx = orderItemCount++;
  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.id = `oir-${idx}`;
  row.innerHTML = `
    <div class="form-group" style="margin:0;">
      <select id="oiProd-${idx}" onchange="recalcOrderTotal()">
        <option value="">— wybierz produkt —</option>
        ${catalogueProducts.map(p => `<option value="${p.product_id}" data-price="${p.product_price}">${esc(p.product_name)} (${Number(p.product_price).toFixed(2)} zł)</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin:0;">
      <input type="number" id="oiQty-${idx}" min="1" value="1" placeholder="Ilość" oninput="recalcOrderTotal()">
    </div>
    <button class="btn btn-ghost btn-icon" onclick="removeOrderItemRow(${idx})" title="Usuń">✕</button>
  `;
  document.getElementById('orderItemsList').appendChild(row);
}

function removeOrderItemRow(idx) {
  document.getElementById(`oir-${idx}`)?.remove();
  recalcOrderTotal();
}

function recalcOrderTotal() {
  let total = 0;
  document.querySelectorAll('.order-item-row').forEach(row => {
    const sel = row.querySelector('select');
    const qty = row.querySelector('input[type="number"]');
    if (sel && qty) {
      const opt = sel.options[sel.selectedIndex];
      const price = opt ? parseFloat(opt.dataset.price || 0) : 0;
      total += price * (parseInt(qty.value) || 0);
    }
  });
  document.getElementById('orderTotal').textContent = total > 0 ? `Łączna kwota: ${total.toFixed(2)} zł` : '';
}

async function doCreateOrder() {
  hideEl('noError'); hideEl('noSuccess');
  const address = document.getElementById('noAddress').value.trim();
  if (!address) { showEl('noError', 'Podaj adres dostawy.'); return; }

  const items = [];
  let valid = true;
  document.querySelectorAll('.order-item-row').forEach(row => {
    const sel = row.querySelector('select');
    const qty = row.querySelector('input[type="number"]');
    if (!sel || !qty) return;
    const productId = parseInt(sel.value);
    const quantity = parseInt(qty.value);
    if (!productId || quantity < 1) { valid = false; return; }
    items.push({ product_id: productId, quantity });
  });

  if (!valid || !items.length) { showEl('noError', 'Dodaj przynajmniej jeden produkt i uzupełnij pola.'); return; }

  const body = {
    delivery_address: address,
    notes: document.getElementById('noNotes').value.trim(),
    items,
  };
  try {
    const res = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { showEl('noError', await res.text()); return; }
    showEl('noSuccess', 'Zamówienie złożone!');
    setTimeout(() => switchView('myOrders'), 1200);
  } catch { showEl('noError', 'Błąd połączenia.'); }
}

// ==============================
// ORDER DETAIL MODAL
// ==============================
async function openOrderDetail(id, mode) {
  currentOrderId = id;
  document.getElementById('odTitle').textContent = `Zamówienie #${id}`;
  document.getElementById('odMeta').innerHTML = '<span style="color:var(--text-muted)">Wczytywanie…</span>';
  document.getElementById('odItemsBody').innerHTML = '';
  document.getElementById('odStatusSection').style.display = 'none';
  document.getElementById('odClientCancelSection').style.display = 'none';
  hideEl('odError');
  openModal('modalOrderDetail');

  try {
    const res = await apiFetch(`/api/orders/${id}`);
    const o = await res.json();

    document.getElementById('odMeta').innerHTML = `
      <div class="profile-field"><label>Status</label><span><span class="status-badge status-${o.status}">${statusLabel(o.status)}</span></span></div>
      <div class="profile-field"><label>Klient</label><span>${esc(o.client_username)}</span></div>
      <div class="profile-field"><label>Adres dostawy</label><span>${esc(o.delivery_address)}</span></div>
      <div class="profile-field"><label>Łączna kwota</label><span>${Number(o.total_price).toFixed(2)} zł</span></div>
      ${o.notes ? `<div class="profile-field" style="grid-column:1/-1"><label>Uwagi</label><span>${esc(o.notes)}</span></div>` : ''}
    `;

    const items = o.items || [];
    document.getElementById('odItemsBody').innerHTML = items.length
      ? items.map(it => `
          <tr>
            <td>${esc(it.product_name)}</td>
            <td>${it.quantity}</td>
            <td>${Number(it.unit_price).toFixed(2)} zł</td>
            <td>${(it.quantity * it.unit_price).toFixed(2)} zł</td>
          </tr>
        `).join('')
      : `<tr class="empty-row"><td colspan="4">Brak pozycji.</td></tr>`;

    // Status controls
    if (mode === 'staff') {
      const cancellable = o.status === 'pending' || o.status === 'confirmed';
      const progressable = ['pending','confirmed','shipped'].includes(o.status);
      if (cancellable || progressable) {
        document.getElementById('odStatusSection').style.display = '';
        // Limit options to valid transitions
        const sel = document.getElementById('odNewStatus');
        const transitions = { pending: ['confirmed','cancelled'], confirmed: ['shipped','cancelled'], shipped: ['delivered'] };
        const opts = transitions[o.status] || [];
        sel.innerHTML = opts.map(s => `<option value="${s}">${statusLabel(s)}</option>`).join('');
      }
    }
    if (mode === 'client') {
      const cancellable = o.status === 'pending' || o.status === 'confirmed';
      if (cancellable) document.getElementById('odClientCancelSection').style.display = '';
    }
  } catch { showEl('odError', 'Błąd wczytywania.'); }
}

async function saveOrderStatus() {
  hideEl('odError');
  const body = {
    status: document.getElementById('odNewStatus').value,
    notes:  document.getElementById('odStatusNote').value.trim(),
  };
  try {
    const res = await apiFetch(`/api/orders/${currentOrderId}/status`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) { showEl('odError', await res.text()); return; }
    closeModal('modalOrderDetail');
    // Refresh whichever list is active
    if (document.getElementById('view-orders').classList.contains('active')) loadAllOrders();
    if (document.getElementById('view-myOrders').classList.contains('active')) loadMyOrders();
  } catch { showEl('odError', 'Błąd połączenia.'); }
}

async function doCancelMyOrder() {
  if (!confirm('Anulować zamówienie?')) return;
  hideEl('odError');
  try {
    const res = await apiFetch(`/api/orders/${currentOrderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', notes: '' })
    });
    if (!res.ok) { showEl('odError', await res.text()); return; }
    closeModal('modalOrderDetail');
    loadMyOrders();
  } catch { showEl('odError', 'Błąd połączenia.'); }
}

// ==============================
// UTILITIES
// ==============================
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function loadingRow(cols) {
  return `<tr class="loading-row"><td colspan="${cols}">Wczytywanie…</td></tr>`;
}

function emptyRow(cols, msg) {
  return `<tr class="empty-row"><td colspan="${cols}">${msg}</td></tr>`;
}

function showEl(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg !== undefined) el.textContent = msg;
  el.style.display = '';
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
}

function statusLabel(s) {
  const m = {
    pending: 'Oczekujące', accepted: 'Zaakceptowana', rejected: 'Odrzucona',
    completed: 'Zrealizowana', confirmed: 'Potwierdzone', shipped: 'Wysłane',
    delivered: 'Dostarczone', cancelled: 'Anulowane',
  };
  return m[s] || s;
}