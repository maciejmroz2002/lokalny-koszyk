// dashboard.js — depends on app.js

let currentUser = null;
let catalogueProducts = [];
let allCategories = [];
let currentOrderId = null;
let invItems = [];
let invCurrentView = 'table';

// Sortowanie i filtrowanie
let invSortBy = null;
let invSortOrder = 'asc'; // 'asc' or 'desc'
let invSearchTerm = '';
let invTableGrouping = 'none'; // 'none', 'category', 'location'
let invBoardGrouping = 'location'; // 'location', 'category'

// ==============================
// INIT
// ==============================
(function init() {
  currentUser = getCurrentUser();
  if (!currentUser) { window.location.replace('login.html'); return; }

  setupSidebar();
  loadCatalogue();

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    window.location.href = 'index.html';
  });

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
  badge.className = 'badge badge-' + u.role;

  const show = (...ids) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });

  if (u.role === 'admin' || u.role === 'magazynier') {
    show('labelInventory', 'navInventory', 'navMove', 'navDeliveries');
  }
  if (u.role === 'admin') {
    show('labelAdmin', 'navLocations', 'navCategories', 'navOrdersAdmin', 'navSuppliers', 'navClients');
  }
  if (u.role === 'supplier') {
    show('labelSupplier', 'navMyDeliveries', 'navNewDelivery', 'navSupplierProfile');
  }
  if (u.role === 'client') {
    show('labelClient', 'navMyOrders', 'navNewOrder', 'navClientProfile');
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
  const btn = document.querySelector('.nav-item[data-view="' + name + '"]');
  if (btn) btn.classList.add('active');

  const loaders = {
    inventory:       loadInventory,
    moveItem:        loadMoveItemSelect,
    locations:       loadLocationsView,
    categories:      loadCategories,
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
// CATALOGUE (dashboard widget)
// ==============================
function loadCatalogue() {
  apiFetch('/api/catalogue').then(async res => {
    catalogueProducts = (await res.json()) || [];
    renderCatalogueGrid();
  }).catch(() => {});
}

function renderCatalogueGrid() {
  const grid = document.getElementById('catGrid');
  if (!grid) return;
  if (!catalogueProducts.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Brak produktów.</p>';
    return;
  }
  grid.innerHTML = catalogueProducts.map(p => `
    <div class="product-card">
      <h3>${esc(p.product_name)}</h3>
      <div class="product-meta"><span><i data-lucide="map-pin" style="width:1em;height:1em;vertical-align:middle;"></i> ${esc(p.product_location)}</span><span>${esc(p.category || '')}</span></div>
      <div class="product-price">${Number(p.product_price).toFixed(2)} zł</div>
    </div>
  `).join('');
  reinitIcons();
}

// ==============================
// INVENTORY
// ==============================
function setInvView(mode) {
  invCurrentView = mode;
  document.querySelectorAll('#invViewToggle .view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.getElementById('invTableWrap').style.display = mode === 'table' ? '' : 'none';
  document.getElementById('invBoardWrap').style.display = mode === 'board' ? '' : 'none';
  document.getElementById('invMapWrap').style.display = mode === 'map' ? '' : 'none';
  if (mode === 'board' && invItems.length) renderInvBoard(invItems);
  if (mode === 'map' && typeof loadResourceMapView === 'function') {
    loadResourceMapView().then(() => {
      if (typeof renderResourceMap === 'function') renderResourceMap(false);
    });
  }
}

async function loadInventory() {
  const tbody = document.getElementById('invBody');
  if (tbody) tbody.innerHTML = loadingRow(6);
  const board = document.getElementById('invBoard');
  if (board) board.innerHTML = '<div class="inv-board-loading">Wczytywanie…</div>';

  try {
    const res = await apiFetch('/api/inventory');
    invItems = (await res.json()) || [];
    renderInventoryViews();
  } catch {
    if (tbody) tbody.innerHTML = emptyRow(6, 'Błąd wczytywania.');
  }
}

function renderInventoryViews() {
  updateInventoryDisplay();
  renderInvBoard(invItems);
  if (invCurrentView === 'map' && typeof renderResourceMap === 'function') {
    renderResourceMap(false);  // disable clicking/moving in inventory view
  }
}

function renderInvTable(items) {
  const tbody = document.getElementById('invBody');
  if (!tbody) return;
  if (!items.length) { tbody.innerHTML = emptyRow(6, 'Brak produktów w magazynie.'); return; }
  tbody.innerHTML = items.map(i => `
    <tr>
      <td>${i.product_id}</td>
      <td>${esc(i.product_name)}</td>
      <td>${esc(i.product_location)}</td>
      <td>${Number(i.product_price).toFixed(2)} zł</td>
      <td>${i.product_count}</td>
      <td class="td-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditProduct(${i.product_id})" title="Edytuj"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${i.product_id})" title="Usuń"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderInvBoard(items) {
  const board = document.getElementById('invBoard');
  if (!board) return;

  // Load all locations to show all columns (including empty ones)
  apiFetch('/api/locations').then(async locRes => {
    const allLocs = await locRes.json();
    if (!Array.isArray(allLocs)) allLocs = [];
    
    // Sort locations alphabetically
    allLocs.sort((a, b) => a.name.localeCompare(b.name));
    
    // Build products map by location
    const productsByLocation = {};
    allLocs.forEach(loc => {
      productsByLocation[loc.name] = [];
    });
    items.forEach(i => {
      const loc = i.product_location || 'Brak lokalizacji';
      if (!productsByLocation[loc]) productsByLocation[loc] = [];
      productsByLocation[loc].push(i);
    });
    
    if (allLocs.length === 0) {
      board.innerHTML = '<div class="inv-board-empty">Brak lokalizacji w magazynie.</div>';
      return;
    }

    const icon = 'map-pin';
    
    board.innerHTML = allLocs.map(loc => {
      const products = productsByLocation[loc.name] || [];
      return `
        <div class="inv-column"
             data-location="${esc(loc.name)}">
          <div class="inv-column-header">
            <span class="inv-column-title"><i data-lucide="${icon}" style="width:1em;height:1em;vertical-align:middle;display:inline;"></i> ${esc(loc.name)}</span>
            <span class="inv-column-count">${products.length} pozycji</span>
          </div>
          <div class="inv-column-body"
               ondrop="boardDrop(event, '${esc(loc.name)}')"
               ondragover="boardDragOver(event)"
               ondragleave="boardDragLeave(event)"
               style="min-height:300px;">
            ${products.map(p => `
              <div class="inv-card"
                   draggable="true"
                   ondragstart="boardDragStart(event, ${p.product_id})"
                   ondragend="boardDragEnd(event)"
                   data-id="${p.product_id}"
                   data-location="${esc(p.product_location)}"
                   style="cursor:grab;">
                <div class="inv-card-name">${esc(p.product_name)}</div>
                <div class="inv-card-meta">
                  <span class="inv-card-count">${p.product_count} szt.</span>
                  <span>${Number(p.product_price).toFixed(2)} zł</span>
                </div>
                <div class="inv-card-actions">
                  <button class="btn btn-secondary btn-sm" onclick="openEditProduct(${p.product_id})" title="Edytuj"><i data-lucide="edit-2"></i></button>
                  <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.product_id})" title="Usuń"><i data-lucide="trash-2"></i></button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
    
    reinitIcons();
  }).catch(() => {
    board.innerHTML = '<div class="inv-board-empty">Błąd wczytywania lokalizacji.</div>';
  });
}

function locationLabel(name) {
  return '<span class="location-label"><i data-lucide="map-pin"></i><span>' + esc(name) + '</span></span>';
}

// Drag & drop
let _dragId = null;

function boardDragStart(e, id) {
  _dragId = id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function boardDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.inv-column').forEach(col => col.classList.remove('drag-over'));
}

function boardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.closest('.inv-column')?.classList.add('drag-over');
}

function boardDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function boardDrop(e, newLocation) {
  e.preventDefault();
  const col = e.currentTarget.closest('.inv-column');
  col?.classList.remove('drag-over');
  if (!_dragId) return;

  const card = document.querySelector('.inv-card[data-id="' + _dragId + '"]');
  const oldLocation = card?.dataset.location;
  if (!oldLocation || oldLocation === newLocation) { _dragId = null; return; }

  // Optimistic update
  const targetBody = col?.querySelector('.inv-column-body');
  if (card && targetBody) {
    card.dataset.location = newLocation;
    targetBody.appendChild(card);
    updateColumnCount(oldLocation);
    updateColumnCount(newLocation);
  }

  try {
    const res = await apiFetch('/api/inventory/move', {
      method: 'POST',
      body: JSON.stringify({ product_id: _dragId, new_location: newLocation, quantity: 0 }),
    });
    if (!res.ok) {
      alert('Nie udało się przenieść: ' + await res.text());
      loadInventory();
    } else {
      const item = invItems.find(i => i.product_id === _dragId);
      if (item) item.product_location = newLocation;
      renderInventoryViews();
      if (typeof loadResourceMapView === 'function') loadResourceMapView({ keepSelection: true });
    }
  } catch {
    alert('Błąd połączenia.');
    loadInventory();
  }
  _dragId = null;
}

function updateColumnCount(location) {
  const col = document.querySelector('.inv-column[data-location="' + CSS.escape(location) + '"]');
  if (!col) return;
  const count = col.querySelectorAll('.inv-card').length;
  const el = col.querySelector('.inv-column-count');
  if (el) el.textContent = count + ' pozycji';
  if (count === 0) col.remove();
}

// Product modals
// ==============================
// PRODUCT MANAGEMENT HELPERS
// ==============================

async function populateProductFormDropdowns() {
  // Save current selections
  const currentLocation = document.getElementById('mpLocation')?.value || '';
  const currentCategory = document.getElementById('mpCategory')?.value || '';
  
  // Load locations for dropdown
  try {
    const locRes = await apiFetch('/api/locations');
    const locations = (await locRes.json()) || [];
    const locSelect = document.getElementById('mpLocation');
    if (locSelect) {
      locSelect.innerHTML = '<option value="">-- Wybierz lokalizację --</option>';
      locations.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.name || loc.location_id;
        opt.textContent = loc.name;
        locSelect.appendChild(opt);
      });
      // Restore selection
      if (currentLocation) locSelect.value = currentLocation;
    }
  } catch (err) {
    console.error('Error loading locations:', err);
  }
  
  // Populate categories dropdown
  const catSelect = document.getElementById('mpCategory');
  if (catSelect && allCategories && allCategories.length) {
    catSelect.innerHTML = '<option value="">-- Wybierz kategorię --</option>';
    allCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      catSelect.appendChild(opt);
    });
    // Restore selection
    if (currentCategory) catSelect.value = currentCategory;
  }
}

function openAddProductModal() {
  document.getElementById('modalProductTitle').textContent = 'Dodaj produkt';
  document.getElementById('editProductId').value = '';
  document.getElementById('mpName').value = '';
  document.getElementById('mpLocation').value = '';
  document.getElementById('mpPrice').value = '';
  document.getElementById('mpCount').value = '';
  document.getElementById('mpCategory').value = '';
  hideEl('mpError');
  populateProductFormDropdowns();
  openModal('modalAddProduct');
}

async function openEditProduct(id) {
  try {
    const res = await apiFetch('/api/inventory/' + id);
    if (!res.ok) throw new Error('failed');
    const p = await res.json();
    document.getElementById('modalProductTitle').textContent = 'Edytuj produkt';
    document.getElementById('editProductId').value = p.product_id;
    document.getElementById('mpName').value = p.product_name;
    document.getElementById('mpLocation').value = p.product_location;
    document.getElementById('mpPrice').value = p.product_price;
    document.getElementById('mpCount').value = p.product_count;
    document.getElementById('mpCategory').value = p.category || '';
    hideEl('mpError');
    await populateProductFormDropdowns();
    openModal('modalAddProduct');
  } catch { alert('Nie udało się wczytać produktu.'); }
}


async function saveProduct() {
  const id = document.getElementById('editProductId').value;
  const body = {
    product_name:     document.getElementById('mpName').value.trim(),
    product_location: document.getElementById('mpLocation').value.trim(),
    product_price:    parseFloat(document.getElementById('mpPrice').value),
    product_count:    parseInt(document.getElementById('mpCount').value),
    category:         document.getElementById('mpCategory').value.trim() || 'Inne',
  };
  if (!body.product_name || !body.product_location || isNaN(body.product_price) || isNaN(body.product_count)) {
    showEl('mpError', 'Uzupełnij wszystkie wymagane pola.'); return;
  }
  const method = id ? 'PUT' : 'POST';
  const url = id ? '/api/inventory/' + id : '/api/inventory';
  try {
    const res = await apiFetch(url, { method, body: JSON.stringify(body) });
    if (!res.ok) { showEl('mpError', await res.text()); return; }
    closeModal('modalAddProduct');
    loadInventory();
    catalogueProducts = [];
    loadCatalogue();
  } catch { showEl('mpError', 'Błąd połączenia.'); }
}

async function deleteProduct(id) {
  if (!confirm('Usunąć produkt?')) return;
  const res = await apiFetch('/api/inventory/' + id, { method: 'DELETE' });
  if (res.ok || res.status === 204) {
    loadInventory();
    catalogueProducts = [];
    loadCatalogue();
  } else {
    alert('Błąd usuwania: ' + await res.text());
  }
}

// ==============================
// MOVE ITEM
// ==============================
async function loadMoveItemSelect() {
  const sel = document.getElementById('moveProductId');
  if (!sel) return;
  sel.innerHTML = '<option>Wczytywanie…</option>';
  const res = await apiFetch('/api/inventory');
  const items = (await res.json()) || [];
  sel.innerHTML = items.map(i =>
    '<option value="' + i.product_id + '">' + esc(i.product_name) + ' (' + esc(i.product_location) + ') — ' + i.product_count + ' szt.</option>'
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
    showEl('moveSuccess', 'Towar przesunięty pomyślnie.');
    document.getElementById('moveLocation').value = '';
    loadMoveItemSelect();
  } catch { showEl('moveError', 'Błąd połączenia.'); }
}

// ==============================
// DELIVERIES (admin + magazynier)
// ==============================
async function loadDeliveries() {
  const tbody = document.getElementById('deliveriesBody');
  if (!tbody) return;
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
          ${d.status === 'pending' ? '<button class="btn btn-primary btn-sm" onclick="openDeliveryStatus(' + d.delivery_id + ')">Zmień status</button>' : '—'}
        </td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = emptyRow(7, 'Błąd wczytywania.'); }
}

function openDeliveryStatus(id) {
  document.getElementById('dsDeliveryId').value = id;
  document.getElementById('dsNotes').value = '';
  hideEl('dsError');
  
  // Load delivery data
  apiFetch('/api/deliveries/' + id).then(async res => {
    if (!res.ok) {
      showEl('dsError', 'Nie udało się wczytać dostawy');
      return;
    }
    const delivery = await res.json();
    const statusLabels = {
      'pending': 'Oczekuje',
      'accepted': 'Zaakceptowana',
      'ready_for_pickup': 'Do odbioru',
      'completed': 'Zrealizowana',
      'cancelled': 'Anulowana',
      'returned_to_supplier': 'Zwrot do dostawcy'
    };
    
    document.getElementById('dsCurrentStatus').textContent = statusLabels[delivery.status] || delivery.status;
    populateStatusOptions(delivery.status);
  }).catch(err => {
    showEl('dsError', 'Błąd połączenia: ' + err.message);
  });
  
  // Load locations for dropdown
  apiFetch('/api/locations').then(async locRes => {
    if (locRes.ok) {
      const locations = await locRes.json();
      const select = document.getElementById('dsLocation');
      select.innerHTML = '<option value="">-- Wybierz lokalizację --</option>';
      locations.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.name;
        opt.textContent = loc.name;
        select.appendChild(opt);
      });
    }
  }).catch(err => console.error('Error loading locations:', err));
  
  openModal('modalDeliveryStatus');
}

function populateStatusOptions(currentStatus) {
  const statusSelect = document.getElementById('dsStatus');
  const options = [];
  
  // Determine available transitions based on currentStatus and user role
  if (currentStatus === 'pending') {
    // Admin can accept or reject from pending
    if (currentUser?.role === 'admin') {
      options.push({ value: 'accepted', label: 'Zaakceptuj' });
      options.push({ value: 'cancelled', label: 'Odrzuć' });
    }
  } else if (currentStatus === 'accepted') {
    // Supplier can request pickup or cancel from accepted
    options.push({ value: 'ready_for_pickup', label: 'Do odbioru' });
    options.push({ value: 'cancelled', label: 'Anuluj' });
  } else if (currentStatus === 'ready_for_pickup') {
    // Admin/magazynier can complete or return from ready_for_pickup
    if (currentUser?.role === 'admin' || currentUser?.role === 'magazynier') {
      options.push({ value: 'completed', label: 'Zrealizuj (dodaj do magazynu)' });
      options.push({ value: 'returned_to_supplier', label: 'Zwrot do dostawcy' });
    }
  }
  
  statusSelect.innerHTML = options.map(opt => 
    `<option value="${opt.value}">${opt.label}</option>`
  ).join('');
}

function toggleLocationField() {
  const status = document.getElementById('dsStatus').value;
  document.getElementById('dsLocationGroup').style.display = status === 'completed' ? '' : 'none';
}

async function saveDeliveryStatus() {
  const id = document.getElementById('dsDeliveryId').value;
  const body = {
    status:   document.getElementById('dsStatus').value,
    notes:    document.getElementById('dsNotes').value,
    location: document.getElementById('dsLocation').value.trim(),
  };
  
  if (!body.status) {
    showEl('dsError', 'Wybierz nowy status.'); 
    return;
  }
  
  if (body.status === 'completed' && !body.location) {
    showEl('dsError', 'Lokalizacja jest wymagana przy realizacji.'); 
    return;
  }
  
  try {
    const res = await apiFetch('/api/deliveries/' + id + '/status', { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) { 
      const errMsg = await res.text();
      showEl('dsError', errMsg || 'Nie udało się zmienić statusu.'); 
      return; 
    }
    closeModal('modalDeliveryStatus');
    loadDeliveries();
    if (body.status === 'completed') { 
      catalogueProducts = []; 
      loadCatalogue(); 
    }
  } catch (err) { 
    showEl('dsError', 'Błąd połączenia: ' + err.message); 
  }
}

// ==============================
// ALL ORDERS (admin + magazynier)
// ==============================
async function loadAllOrders() {
  const tbody = document.getElementById('ordersBody');
  if (!tbody) return;
  tbody.innerHTML = loadingRow(6);
  const status = document.getElementById('orderStatusFilter')?.value || '';
  const qs = status ? '?status=' + status : '';
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
  } catch { tbody.innerHTML = emptyRow(6, 'Błąd wczytywania.'); }
}

// ==============================
// SUPPLIERS (admin)
// ==============================
async function loadSuppliers() {
  const tbody = document.getElementById('suppliersBody');
  if (!tbody) return;
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
  if (!tbody) return;
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
  if (!tbody) return;
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
  if (!body.product_name || isNaN(body.quantity) || body.quantity < 1 || isNaN(body.proposed_price) || body.proposed_price <= 0) {
    showEl('ndError', 'Uzupełnij wymagane pola poprawnie.'); return;
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
  if (!tbody) return;
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
  apiFetch('/api/client/profile').then(async r => {
    const p = await r.json();
    const addr = document.getElementById('noAddress');
    if (addr && p.address) addr.value = p.address;
  }).catch(() => {});

  if (!catalogueProducts.length) {
    apiFetch('/api/catalogue').then(async r => {
      catalogueProducts = (await r.json()) || [];
      renderCatalogueGrid();
    });
  }

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
  row.id = 'oir-' + idx;
  row.innerHTML = `
    <div class="form-group" style="margin:0;">
      <select id="oiProd-${idx}" onchange="recalcOrderTotal()">
        <option value="">— wybierz produkt —</option>
        ${catalogueProducts.map(p => `<option value="${p.product_id}" data-price="${p.product_price}">${esc(p.product_name)} (${Number(p.product_price).toFixed(2)} zł)</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin:0;">
      <input type="number" id="oiQty-${idx}" min="1" value="1" oninput="recalcOrderTotal()">
    </div>
    <button class="btn btn-ghost btn-icon" onclick="removeOrderItemRow(${idx})" title="Usuń">✕</button>
  `;
  document.getElementById('orderItemsList').appendChild(row);
}

function removeOrderItemRow(idx) {
  document.getElementById('oir-' + idx)?.remove();
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
  document.getElementById('orderTotal').textContent = total > 0 ? 'Łączna kwota: ' + total.toFixed(2) + ' zł' : '';
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

  if (!valid || !items.length) { showEl('noError', 'Dodaj przynajmniej jeden produkt poprawnie.'); return; }

  const body = { delivery_address: address, notes: document.getElementById('noNotes').value.trim(), items };
  try {
    const res = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { showEl('noError', await res.text()); return; }
    showEl('noSuccess', 'Zamówienie złożone pomyślnie!');
    setTimeout(() => switchView('myOrders'), 1200);
  } catch { showEl('noError', 'Błąd połączenia.'); }
}

// ==============================
// ORDER DETAIL MODAL
// ==============================
async function openOrderDetail(id, mode) {
  currentOrderId = id;
  document.getElementById('odTitle').textContent = 'Zamówienie #' + id;
  document.getElementById('odMeta').innerHTML = '<span style="color:var(--text-muted)">Wczytywanie…</span>';
  document.getElementById('odItemsBody').innerHTML = '';
  document.getElementById('odStatusSection').style.display = 'none';
  document.getElementById('odClientCancelSection').style.display = 'none';
  hideEl('odError');
  openModal('modalOrderDetail');

  try {
    const res = await apiFetch('/api/orders/' + id);
    if (!res.ok) throw new Error(await res.text());
    const o = await res.json();

    document.getElementById('odMeta').innerHTML = `
      <div class="profile-field"><label>Status</label><span><span class="status-badge status-${o.status}">${statusLabel(o.status)}</span></span></div>
      <div class="profile-field"><label>Klient</label><span>${esc(o.client_username)}</span></div>
      <div class="profile-field"><label>Adres dostawy</label><span>${esc(o.delivery_address)}</span></div>
      <div class="profile-field"><label>Łączna kwota</label><span>${Number(o.total_price).toFixed(2)} zł</span></div>
      ${o.notes ? '<div class="profile-field" style="grid-column:1/-1"><label>Uwagi</label><span>' + esc(o.notes) + '</span></div>' : ''}
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
      : '<tr class="empty-row"><td colspan="4">Brak pozycji.</td></tr>';

    if (mode === 'staff') {
      const transitions = {
        pending:   ['confirmed', 'cancelled'],
        confirmed: ['shipped', 'cancelled'],
        shipped:   ['delivered'],
      };
      const opts = transitions[o.status] || [];
      if (opts.length) {
        document.getElementById('odStatusSection').style.display = '';
        const sel = document.getElementById('odNewStatus');
        sel.innerHTML = opts.map(s => '<option value="' + s + '">' + statusLabel(s) + '</option>').join('');
      }
    }
    if (mode === 'client') {
      if (o.status === 'pending' || o.status === 'confirmed') {
        document.getElementById('odClientCancelSection').style.display = '';
      }
    }
  } catch (err) { showEl('odError', 'Błąd wczytywania: ' + err.message); }
}

async function saveOrderStatus() {
  hideEl('odError');
  const body = {
    status: document.getElementById('odNewStatus').value,
    notes:  document.getElementById('odStatusNote').value.trim(),
  };
  try {
    const res = await apiFetch('/api/orders/' + currentOrderId + '/status', { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) { showEl('odError', await res.text()); return; }
    closeModal('modalOrderDetail');
    if (document.getElementById('view-orders')?.classList.contains('active')) loadAllOrders();
    if (document.getElementById('view-myOrders')?.classList.contains('active')) loadMyOrders();
  } catch { showEl('odError', 'Błąd połączenia.'); }
}

async function doCancelMyOrder() {
  if (!confirm('Anulować zamówienie?')) return;
  hideEl('odError');
  try {
    const res = await apiFetch('/api/orders/' + currentOrderId + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', notes: '' })
    });
    if (!res.ok) { showEl('odError', await res.text()); return; }
    closeModal('modalOrderDetail');
    loadMyOrders();
  } catch { showEl('odError', 'Błąd połączenia.'); }
}

// ==============================
// MODAL HELPERS
// ==============================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    if (el.classList) el.classList.add('open');
  }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    if (el.classList) el.classList.remove('open');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  // Fix the "add product" button onclick
  const addBtn = document.querySelector('[onclick="openModal(\'modalAddProduct\')"]');
  if (addBtn) addBtn.setAttribute('onclick', 'openAddProductModal()');
});

// ==============================
// UTILITIES
// ==============================
function loadingRow(cols) {
  return '<tr class="loading-row"><td colspan="' + cols + '">Wczytywanie…</td></tr>';
}

function emptyRow(cols, msg) {
  return '<tr class="empty-row"><td colspan="' + cols + '">' + msg + '</td></tr>';
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

// ==============================
// INVENTORY TABLE: SORTING, FILTERING, GROUPING
// ==============================

function sortInventory(field) {
  // Toggle sort order if clicking same field, otherwise start with asc
  if (invSortBy === field) {
    invSortOrder = invSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    invSortBy = field;
    invSortOrder = 'asc';
  }
  updateInventoryDisplay();
}

function setInvTableGrouping(value) {
  invTableGrouping = value || 'none';
  updateInventoryDisplay();
}

function setInvBoardGrouping(value) {
  invBoardGrouping = value || 'location';
  renderInvBoard(invItems);
}

function updateInventoryDisplay() {
  // Get search input
  const searchInput = document.getElementById('invSearchInput');
  if (searchInput) invSearchTerm = searchInput.value.toLowerCase();

  // Filter items
  let filtered = invItems.filter(item => {
    if (!invSearchTerm) return true;
    return (item.product_id + '').includes(invSearchTerm) ||
           (item.product_name || '').toLowerCase().includes(invSearchTerm) ||
           (item.product_location || '').toLowerCase().includes(invSearchTerm);
  });

  // Sort items
  if (invSortBy) {
    filtered.sort((a, b) => {
      let aVal = a[invSortBy];
      let bVal = b[invSortBy];

      // Handle numeric values
      if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
      if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return invSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return invSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Render table based on grouping setting
  if (invTableGrouping === 'none') {
    renderInvTable(filtered);
  } else {
    renderInvTableGrouped(filtered, invTableGrouping);
  }
  updateSortArrows();
}

function updateSortArrows() {
  // Clear all arrows
  ['ID', 'Name', 'Loc', 'Price', 'Count'].forEach(name => {
    const arrow = document.getElementById('arrow' + name);
    if (arrow) arrow.textContent = '';
  });

  // Show current sort arrow
  if (invSortBy) {
    const fieldMap = {
      product_id: 'ID',
      product_name: 'Name',
      product_location: 'Loc',
      product_price: 'Price',
      product_count: 'Count'
    };
    const arrowName = fieldMap[invSortBy];
    if (arrowName) {
      const arrow = document.getElementById('arrow' + arrowName);
      if (arrow) arrow.textContent = invSortOrder === 'asc' ? ' ↑' : ' ↓';
    }
  }
}

function renderInvTableGrouped(items, groupBy) {
  const tbody = document.getElementById('invBody');
  if (!tbody) return;
  if (!items.length) { tbody.innerHTML = emptyRow(6, 'Brak produktów spełniających kryteria.'); return; }

  // Group by location or category
  const groups = {};
  items.forEach(i => {
    let groupKey;
    if (groupBy === 'category') {
      // Group by category field
      groupKey = i.category || 'Inne';
    } else {
      // Group by location
      groupKey = i.product_location || 'Brak lokalizacji';
    }
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(i);
  });

  let html = '';
  Object.entries(groups).forEach(([groupKey, products]) => {
    // Group header row
    const icon = groupBy === 'category' ? 'tag' : 'map-pin';
    html += `
      <tr style="background-color:var(--surface-alt,#f5f5f5);font-weight:bold;">
        <td colspan="6"><i data-lucide="${icon}" style="width:1em;height:1em;vertical-align:middle;display:inline;margin-right:0.5rem;"></i>${esc(groupKey)} (${products.length})</td>
      </tr>
    `;
    // Product rows
    html += products.map(i => `
      <tr>
        <td>${i.product_id}</td>
        <td>${esc(i.product_name)}</td>
        <td>${esc(i.product_location)}</td>
        <td>${Number(i.product_price).toFixed(2)} zł</td>
        <td>${i.product_count}</td>
        <td class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEditProduct(${i.product_id})" title="Edytuj"><i data-lucide="edit-2"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct(${i.product_id})" title="Usuń"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>
    `).join('');
  });

  tbody.innerHTML = html;
  reinitIcons();
}

// Hook into input to trigger filtering on every keystroke
(function() {
  setTimeout(() => {
    const searchInput = document.getElementById('invSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', updateInventoryDisplay);
    }
  }, 100);
})();

// ==============================
// CATEGORIES MANAGEMENT
// ==============================

let editingCategoryId = null;

async function loadCategories() {
  try {
    const res = await apiFetch('/api/warehouse/categories');
    allCategories = await res.json();
    renderCategoriesTable();
  } catch (err) {
    console.error('Error loading categories:', err);
    showEl('catError', 'Nie udało się wczytać kategorii');
  }
}

function renderCategoriesTable() {
  const board = document.getElementById('categoriesBoard');
  if (!board) return;
  
  if (!allCategories.length) {
    board.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--text-muted);">Brak kategorii.</div>';
    return;
  }
  
  board.innerHTML = allCategories.map(cat => `
    <div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;display:flex;flex-direction:column;gap:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div>
        <h3 style="margin:0 0 0.5rem 0;font-size:1.1rem;">${esc(cat.name)}</h3>
        <p style="margin:0;color:var(--text-muted);font-size:0.9rem;line-height:1.4;">${esc(cat.description || '(brak opisu)')}</p>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:auto;">
        <button class="btn btn-danger" onclick="deleteCategory(${cat.category_id})" style="width:100%;" title="Usuń"><i data-lucide="trash-2" style="margin-right:0.5rem;"></i>Usuń</button>
      </div>
    </div>
  `).join('');
  reinitIcons();
}

function openAddCategoryModal() {
  document.getElementById('modalCategoryTitle').textContent = 'Dodaj kategorię';
  document.getElementById('catName').value = '';
  document.getElementById('catDesc').value = '';
  document.getElementById('modalCategorySubmit').textContent = 'Dodaj';
  hideEl('modalCategoryError');
  openModal('modalCategory');
}

function saveCategoryModal() {
  const name = document.getElementById('catName').value.trim();
  const description = document.getElementById('catDesc').value.trim();
  
  if (!name) {
    document.getElementById('modalCategoryError').textContent = 'Nazwa kategorii jest wymagana';
    showEl('modalCategoryError');
    return;
  }
  
  // Check if name already exists
  if (allCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    document.getElementById('modalCategoryError').textContent = 'Kategoria z tą nazwą już istnieje';
    showEl('modalCategoryError');
    return;
  }
  
  const body = JSON.stringify({ name, description });
  
  apiFetch('/api/warehouse/categories', { method: 'POST', body }).then(() => {
    loadCategories();
    closeModal('modalCategory');
  }).catch(err => {
    document.getElementById('modalCategoryError').textContent = 'Błąd: ' + err.message;
    showEl('modalCategoryError');
  });
}

function deleteCategory(catId) {
  const cat = allCategories.find(c => c.category_id === catId);
  if (!cat) return;
  
  if (!confirm('Usunąć kategorię "' + cat.name + '"?\n\nJeśli w magazynie są produkty z tą kategorią, nie będzie można jej usunąć.')) return;
  
  apiFetch('/api/warehouse/categories/' + catId, {
    method: 'DELETE'
  }).then(async res => {
    if (!res.ok) {
      if (res.status === 409) {
        alert('Nie można usunąć tej kategorii.\n\nW magazynie są produkty przypisane do tej kategorii.');
      } else {
        alert('Nie udało się usunąć kategorii (błąd ' + res.status + ')');
      }
      return;
    }
    loadCategories();
  }).catch(err => {
    alert('Błąd połączenia: ' + err.message);
  });
}
