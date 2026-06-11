// ==============================
// WAREHOUSE MAP VIEW
// ==============================

let warehouseMapData = null;
let allLocations = [];
let invUpdateCallback = null;

async function loadInventoryBoard() {
  try {
    // Load all inventory items grouped by location
    const invRes = await apiFetch('/api/inventory');
    const items = await invRes.json();

    // Load locations
    const locRes = await apiFetch('/api/locations');
    const locations = await locRes.json();

    renderInventoryBoard(items, locations);
  } catch (err) {
    console.error('Error loading inventory board:', err);
  }
}

function renderInventoryBoard(items, locations) {
  const board = document.getElementById('invBoard');
  board.innerHTML = '';
  board.style.display = 'grid';
  board.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
  board.style.gap = '1rem';

  // Group items by location
  const itemsByLocation = {};
  locations.forEach(loc => {
    itemsByLocation[loc.name] = [];
  });

  items.forEach(item => {
    const loc = item.product_location || 'Bez lokalizacji';
    if (!itemsByLocation[loc]) {
      itemsByLocation[loc] = [];
    }
    itemsByLocation[loc].push(item);
  });

  // Render columns
  Object.entries(itemsByLocation).forEach(([locName, locItems]) => {
    const column = document.createElement('div');
    column.style.border = '1px solid var(--border-strong)';
    column.style.borderRadius = 'var(--radius)';
    column.style.backgroundColor = '#f8f9fa';
    column.style.padding = '1rem';
    column.style.minHeight = '400px';

    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '1rem';
    header.style.paddingBottom = '0.75rem';
    header.style.borderBottom = '2px solid var(--border-strong)';
    header.textContent = locName;

    column.appendChild(header);

    locItems.forEach(item => {
      const card = document.createElement('div');
      card.style.backgroundColor = '#fff';
      card.style.border = '1px solid var(--border)';
      card.style.borderRadius = 'var(--radius)';
      card.style.padding = '0.75rem';
      card.style.marginBottom = '0.5rem';
      card.style.cursor = 'grab';
      card.style.fontSize = '0.875rem';

      card.innerHTML = `
        <div style="font-weight:500;margin-bottom:0.25rem;">${esc(item.product_name)}</div>
        <div style="color:var(--text-muted);font-size:0.8rem;">Ilość: ${item.product_count}</div>
        <div style="color:var(--text-muted);font-size:0.8rem;">Cena: ${item.product_price.toFixed(2)} zł</div>
      `;

      column.appendChild(card);
    });

    board.appendChild(column);
  });

  reinitIcons();
}

async function saveNewLocation() {
  const name = document.getElementById('alName').value.trim();
  const x = parseInt(document.getElementById('alX').value) || 0;
  const y = parseInt(document.getElementById('alY').value) || 0;
  const width = parseInt(document.getElementById('alWidth').value) || 100;
  const height = parseInt(document.getElementById('alHeight').value) || 100;
  const is_mapped = document.getElementById('alIsMapped').checked;

  if (!name) {
    showEl('alError', 'Nazwa lokalizacji jest wymagana');
    return;
  }

  try {
    const res = await apiFetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, x, y, width, height, is_mapped })
    });

    if (!res.ok) throw new Error('Failed to create location');
    closeModal('modalAddLocation');
    loadLocationsView();
    document.getElementById('alName').value = '';
    document.getElementById('alX').value = '0';
    document.getElementById('alY').value = '0';
    document.getElementById('alIsMapped').checked = false;
  } catch (err) {
    showEl('alError', err.message);
  }
}

// Re-initialize icons after map rendering
function reinitIcons() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// ==============================
// MOVE ITEM GRAPHIC MODE
// ==============================

let moveGraphicMapData = null;
let moveGraphicLocations = [];
let selectedMoveLocation = null;

function setMoveMode(mode) {
  // Always use text mode, graphic mode removed
  document.getElementById('moveTextMode').style.display = '';
  document.getElementById('moveGraphicMode').style.display = 'none';

  document.querySelectorAll('#view-moveItem .view-toggle-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`#view-moveItem .view-toggle-btn[data-mode="text"]`)?.classList.add('active');
}

async function loadMoveGraphicMap() {
  try {
    const mapRes = await apiFetch('/api/warehouse/map');
    const mapData = await mapRes.json();
    moveGraphicMapData = mapData.map_data;

    const locRes = await apiFetch('/api/locations');
    moveGraphicLocations = await locRes.json();

    // Load product select
    const prodRes = await apiFetch('/api/inventory');
    const products = await prodRes.json();
    const select = document.getElementById('moveGraphicProduct');
    select.innerHTML = '<option value="">Wybierz produkt...</option>' +
      products.map(p => `<option value="${p.product_id}">${esc(p.product_name)}</option>`).join('');

    renderMoveGraphicMap();
  } catch (err) {
    console.error('Error loading move graphic map:', err);
  }
}

function renderMoveGraphicMap() {
  const canvas = document.getElementById('moveMapCanvas');
  if (!moveGraphicMapData || !moveGraphicMapData.locations) {
    canvas.innerHTML = '<p style="padding:2rem;color:var(--text-muted);">Brak mapy.</p>';
    return;
  }

  const width = moveGraphicMapData.width || 800;
  const height = moveGraphicMapData.height || 600;

  canvas.innerHTML = '';
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Render clickable locations
  moveGraphicMapData.locations.forEach(loc => {
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = loc.x + 'px';
    box.style.top = loc.y + 'px';
    box.style.width = loc.width + 'px';
    box.style.height = loc.height + 'px';
    box.style.border = '2px solid #0066cc';
    box.style.backgroundColor = selectedMoveLocation === loc.name ? 'rgba(0,200,100,0.2)' : 'rgba(0,102,204,0.1)';
    box.style.borderRadius = '4px';
    box.style.cursor = 'pointer';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.fontSize = '12px';
    box.style.fontWeight = 'bold';
    box.style.color = '#0066cc';
    box.style.userSelect = 'none';
    box.textContent = loc.name;
    
    box.addEventListener('click', () => {
      selectedMoveLocation = loc.name;
      renderMoveGraphicMap();
    });

    canvas.appendChild(box);
  });
}

function updateMoveGraphicQty() {
  const prodId = document.getElementById('moveGraphicProduct').value;
  if (!prodId) return;

  // Find product and set qty to max available
  // Could auto-fill based on current inventory
}

async function doMoveGraphicItem() {
  const prodId = parseInt(document.getElementById('moveGraphicProduct').value);
  const qty = parseInt(document.getElementById('moveGraphicQty').value) || 0;
  const location = selectedMoveLocation;

  if (!prodId || !location) {
    showEl('moveGraphicError', 'Wybierz produkt i lokalizację');
    return;
  }

  try {
    const res = await apiFetch('/api/inventory/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: prodId, new_location: location, quantity: qty })
    });

    if (!res.ok) throw new Error('Move failed');
    showEl('moveGraphicSuccess', 'Towar przeniesiony pomyślnie');
    loadMoveItemSelect();
    setTimeout(() => hideEl('moveGraphicSuccess'), 3000);
  } catch (err) {
    showEl('moveGraphicError', err.message);
  }
}

// ==============================
// LOCATIONS MANAGEMENT VIEW
// ==============================

let locationsMapData = null;
let allLocationsForMap = [];
let editingLocationId = null;

async function loadLocationsView() {
  try {
    // Load map
    const mapRes = await apiFetch('/api/warehouse/map');
    const mapData = await mapRes.json();
    locationsMapData = mapData.map_data;

    // Set input values for canvas size
    const canvasWidthInput = document.getElementById('canvasWidth');
    const canvasHeightInput = document.getElementById('canvasHeight');
    if (canvasWidthInput) canvasWidthInput.value = locationsMapData?.width || 800;
    if (canvasHeightInput) canvasHeightInput.value = locationsMapData?.height || 600;

    // Load locations
    const locRes = await apiFetch('/api/locations');
    allLocationsForMap = await locRes.json();
    console.log('Loaded locations:', allLocationsForMap);

    renderLocationsMap();
    renderUnmappedLocationsForMap();
  } catch (err) {
    console.error('Error loading locations:', err);
  }
}

function renderLocationsMap() {
  const canvas = document.getElementById('locMapCanvas');
  if (!allLocationsForMap || !allLocationsForMap.length) {
    canvas.innerHTML = '<p style="padding:2rem;color:var(--text-muted);">Brak lokalizacji.</p>';
    return;
  }

  const width = locationsMapData?.width || 800;
  const height = locationsMapData?.height || 600;

  canvas.innerHTML = '';
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Render only locations marked as mapped (is_mapped === true)
  const mappedLocations = allLocationsForMap.filter(loc => loc.is_mapped === true);
  
  if (!mappedLocations.length) {
    canvas.innerHTML = '<p style="padding:2rem;color:var(--text-muted);">Brak lokalizacji na mapie.</p>';
    return;
  }

  // Render locations as draggable boxes (draggable in this view only)
  // Use DB data for all properties including coordinates
  mappedLocations.forEach(dbLoc => {
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = dbLoc.x + 'px';
    box.style.top = dbLoc.y + 'px';
    box.style.width = dbLoc.width + 'px';
    box.style.height = dbLoc.height + 'px';
    box.style.border = '2px solid #0066cc';
    box.style.backgroundColor = 'rgba(0,102,204,0.1)';
    box.style.borderRadius = '4px';
    box.style.cursor = 'move';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.fontSize = '12px';
    box.style.fontWeight = 'bold';
    box.style.color = '#0066cc';
    box.style.padding = '0.5rem';
    box.style.textAlign = 'center';
    box.style.flexDirection = 'column';
    box.style.overflow = 'hidden';

    const textDiv = document.createElement('div');
    textDiv.innerHTML = '<i data-lucide="map-pin" style="width:1.2em;height:1.2em;vertical-align:middle;display:inline;margin-right:0.25rem;"></i><span>' + esc(dbLoc.name) + '</span>';
    textDiv.style.marginBottom = '0.25rem';
    textDiv.style.display = 'flex';
    textDiv.style.alignItems = 'center';
    textDiv.style.justifyContent = 'center';
    textDiv.style.gap = '0.25rem';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm';
    editBtn.style.fontSize = '0.7rem';
    editBtn.style.padding = '0.2rem 0.4rem';
    editBtn.innerHTML = '<i data-lucide="edit-2" style="width:12px;height:12px;"></i> Edytuj';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      editLocationMap(dbLoc.name);
    };

    box.appendChild(textDiv);
    box.appendChild(editBtn);

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.width = '12px';
    resizeHandle.style.height = '12px';
    resizeHandle.style.bottom = '0';
    resizeHandle.style.right = '0';
    resizeHandle.style.backgroundColor = '#0066cc';
    resizeHandle.style.cursor = 'nwse-resize';
    resizeHandle.style.borderRadius = '4px 0 0 0';
    resizeHandle.onmousedown = (e) => startResize(e, box, dbLoc);
    box.appendChild(resizeHandle);

    // Use DB data directly (already has location_id and all coords)
    makeDraggable(box, dbLoc);
    canvas.appendChild(box);
  });
  reinitIcons();
}

function makeDraggable(element, location) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + 'px';
    element.style.left = (element.offsetLeft - pos1) + 'px';
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    // Update location coordinates
    location.x = parseInt(element.style.left);
    location.y = parseInt(element.style.top);
    
    // Check if location is outside map bounds
    const mapWidth = locationsMapData?.width || 800;
    const mapHeight = locationsMapData?.height || 600;
    const isOutsideMap = (location.x + location.width > mapWidth) || 
                         (location.y + location.height > mapHeight);
    
    // Disable is_mapped if location is outside map
    const shouldUnmap = isOutsideMap && location.is_mapped;
    const newIsMapped = shouldUnmap ? false : location.is_mapped;
    
    // Save to API
    apiFetch('/api/locations/' + location.location_id, {
      method: 'PUT',
      body: JSON.stringify({
        name: location.name,
        x: location.x,
        y: location.y,
        width: location.width,
        height: location.height,
        is_mapped: newIsMapped
      })
    }).catch(err => {
      console.error('Failed to save location:', err);
      alert('Nie udało się zapisać pozycji lokalizacji');
    });
  }
}

// Resize location box
let resizingBox = null;
let resizingLocation = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

function startResize(e, box, location) {
  e.preventDefault();
  e.stopPropagation();
  
  resizingBox = box;
  resizingLocation = location;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;
  resizeStartWidth = parseInt(box.style.width);
  resizeStartHeight = parseInt(box.style.height);
  
  document.onmousemove = doResize;
  document.onmouseup = stopResize;
}

function doResize(e) {
  if (!resizingBox) return;
  
  const deltaX = e.clientX - resizeStartX;
  const deltaY = e.clientY - resizeStartY;
  
  const newWidth = Math.max(80, resizeStartWidth + deltaX);
  const newHeight = Math.max(80, resizeStartHeight + deltaY);
  
  resizingBox.style.width = newWidth + 'px';
  resizingBox.style.height = newHeight + 'px';
}

function stopResize() {
  if (!resizingBox || !resizingLocation) {
    document.onmousemove = null;
    document.onmouseup = null;
    return;
  }
  
  const newWidth = parseInt(resizingBox.style.width);
  const newHeight = parseInt(resizingBox.style.height);
  
  resizingLocation.width = newWidth;
  resizingLocation.height = newHeight;
  
  // Check if location is outside map bounds
  const mapWidth = locationsMapData?.width || 800;
  const mapHeight = locationsMapData?.height || 600;
  const isOutsideMap = (resizingLocation.x + newWidth > mapWidth) || 
                       (resizingLocation.y + newHeight > mapHeight);
  
  // Disable is_mapped if location is outside map
  const shouldUnmap = isOutsideMap && resizingLocation.is_mapped;
  const newIsMapped = shouldUnmap ? false : resizingLocation.is_mapped;
  
  // Save to API
  apiFetch('/api/locations/' + resizingLocation.location_id, {
    method: 'PUT',
    body: JSON.stringify({
      name: resizingLocation.name,
      x: resizingLocation.x,
      y: resizingLocation.y,
      width: newWidth,
      height: newHeight,
      is_mapped: newIsMapped
    })
  }).catch(err => {
    console.error('Failed to save location size:', err);
    alert('Nie udało się zapisać rozmiaru lokalizacji');
  });
  
  document.onmousemove = null;
  document.onmouseup = null;
  resizingBox = null;
  resizingLocation = null;
}

// Update canvas size
function updateCanvasSize() {
  const width = parseInt(document.getElementById('canvasWidth').value) || 800;
  const height = parseInt(document.getElementById('canvasHeight').value) || 600;
  
  const canvas = document.getElementById('locMapCanvas');
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // Save to API
  saveMapDimensions(width, height);
}

async function saveMapDimensions(width, height) {
  try {
    const mapRes = await apiFetch('/api/warehouse/map');
    const mapData = await mapRes.json();
    const updated = {
      ...mapData.map_data,
      width,
      height
    };
    
    await apiFetch('/api/warehouse/map', {
      method: 'PUT',
      body: JSON.stringify({ map_data: updated })
    });
    
    // Update resource map view if it exists
    resourceMapData = updated;
  } catch (err) {
    console.error('Error saving map dimensions:', err);
  }
}

function renderUnmappedLocationsForMap() {
  const unmapped = document.getElementById('locMapUnmapped');
  // Show only locations NOT marked as mapped (is_mapped === false)
  const unmappedLocs = allLocationsForMap.filter(loc => loc.is_mapped === false);

  if (!unmappedLocs.length) {
    unmapped.innerHTML = '<p style="color:var(--text-muted);">Wszystkie lokalizacje są zmapowane.</p>';
    return;
  }

  unmapped.innerHTML = '<div style="font-weight:bold;margin-bottom:0.75rem;"><i data-lucide="alert-circle" style="width:1em;height:1em;vertical-align:middle;display:inline;margin-right:0.5rem;"></i>Lokalizacje poza mapą:</div>' +
    unmappedLocs.map(loc => `
      <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.5rem 0.75rem;background:#fff;border:1px solid #ddd;border-radius:4px;margin:0.25rem;text-align:center;">
        <span>${esc(loc.name)}</span> <button class="btn btn-sm" style="padding:0.25rem;" onclick="editLocationMap('${loc.name}')" title="Edytuj"><i data-lucide="edit-2" style="width:16px;height:16px;"></i></button>
      </div>
    `).join('');
  reinitIcons();
}

function renderResourceMapUnmapped() {
  const unmapped = document.getElementById('invMapUnmapped');
  if (!unmapped) return;
  
  const unmappedLocs = resourceLocations.filter(loc => loc.is_mapped === false);

  if (!unmappedLocs.length) {
    unmapped.innerHTML = '<p style="color:var(--text-muted);">Wszystkie lokalizacje są na mapie.</p>';
    return;
  }

  unmapped.innerHTML = '<div style="font-weight:bold;margin-bottom:0.75rem;"><i data-lucide="alert-circle" style="width:1em;height:1em;vertical-align:middle;display:inline;margin-right:0.5rem;"></i>Lokalizacje poza mapą:</div>' +
    unmappedLocs.map(loc => {
      const productsAtLocation = window.invItems?.filter(item => item.product_location === loc.name) || [];
      return `
        <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.5rem 0.75rem;background:#fff;border:1px solid #ddd;border-radius:4px;margin:0.25rem;text-align:center;">
          <span>${esc(loc.name)}</span>
          ${productsAtLocation.length > 0 ? `<button class="btn btn-secondary btn-xs" style="padding:2px 4px;" onclick="showLocationContentsPopup('${loc.name.replace(/'/g, "\\'")}', ${JSON.stringify(productsAtLocation).replace(/"/g, '&quot;')})" title="Pokaż produkty"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>` : ''}
        </div>
      `;
    }).join('');
  reinitIcons();
}

function showAddLocModal() {
  editingLocationId = null;
  document.getElementById('alName').value = '';
  document.getElementById('alX').value = '0';
  document.getElementById('alY').value = '0';
  document.getElementById('alWidth').value = '100';
  document.getElementById('alHeight').value = '100';
  document.getElementById('alIsMapped').checked = false;
  openModal('modalAddLocation');
}

async function editLocationMap(locationName) {
  // Find location by name (from map)
  const locFromMap = locationsMapData?.locations?.find(l => l.name === locationName);
  const locFromDb = allLocationsForMap.find(l => l.name === locationName);
  
  if (!locFromDb && !locFromMap) return;

  const loc = locFromDb || locFromMap;
  editingLocationId = locFromDb?.location_id;

  document.getElementById('elName').value = loc.name;
  document.getElementById('elX').value = loc.x || 0;
  document.getElementById('elY').value = loc.y || 0;
  document.getElementById('elWidth').value = loc.width || 100;
  document.getElementById('elHeight').value = loc.height || 100;
  document.getElementById('elIsMapped').checked = locFromDb?.is_mapped || false;

  openModal('modalEditLocation');
}

async function saveEditLocation() {
  const name = document.getElementById('elName').value.trim();
  const x = parseInt(document.getElementById('elX').value) || 0;
  const y = parseInt(document.getElementById('elY').value) || 0;
  const width = parseInt(document.getElementById('elWidth').value) || 100;
  const height = parseInt(document.getElementById('elHeight').value) || 100;
  const is_mapped = document.getElementById('elIsMapped').checked;

  if (!name) {
    showEl('elError', 'Nazwa lokalizacji jest wymagana');
    return;
  }

  try {
    // Update location
    const res = await apiFetch(`/api/locations/${editingLocationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, x, y, width, height, is_mapped })
    });

    if (!res.ok) throw new Error('Aktualizacja nie powiodła się');

    // Update map data if location is on map
    if (locationsMapData) {
      const mapLoc = locationsMapData.locations.find(l => l.location_id === editingLocationId || l.name === name);
      if (mapLoc) {
        mapLoc.name = name;
        mapLoc.x = x;
        mapLoc.y = y;
        mapLoc.width = width;
        mapLoc.height = height;
      }
    }

    closeModal('modalEditLocation');
    loadLocationsView();
  } catch (err) {
    showEl('elError', err.message);
  }
}

async function deleteEditLocation() {
  if (!confirm('Czy na pewno chcesz usunąć tę lokalizację?')) return;

  try {
    const res = await apiFetch(`/api/locations/${editingLocationId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Usuwanie nie powiodło się');
    closeModal('modalEditLocation');
    loadLocationsView();
  } catch (err) {
    showEl('elError', err.message);
  }
}

async function handleLocMapUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const mapData = JSON.parse(text);

    // Validate structure
    if (!mapData.width || !mapData.height || !Array.isArray(mapData.locations)) {
      throw new Error('Nieprawidłowy format mapy. Oczekiwano: {width, height, locations: [...]}');
    }

    // Validate location data
    mapData.locations.forEach((loc, idx) => {
      if (!loc.name || typeof loc.x !== 'number' || typeof loc.y !== 'number' || 
          typeof loc.width !== 'number' || typeof loc.height !== 'number') {
        throw new Error(`Lokalizacja ${idx} posiada nieprawidłowe dane`);
      }
    });

    // Upload to server using PUT to update existing map
    const res = await apiFetch('/api/warehouse/map', {
      method: 'PUT',
      body: JSON.stringify({ map_data: mapData })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || 'Wgranie mapy nie powiodło się');
    }

    alert('Mapa została pomyślnie wgrana! ✓');
    loadLocationsView();
  } catch (err) {
    alert('Błąd przy wgrywaniu mapy:\n' + err.message);
  }

  // Reset input
  event.target.value = '';
}

function exportLocationsMap() {
  if (!locationsMapData) {
    alert('Brak mapy do wyeksportowania');
    return;
  }

  try {
    // Include only essential data
    const exportData = {
      width: locationsMapData.width || 800,
      height: locationsMapData.height || 600,
      locations: allLocationsForMap.map(loc => ({
        name: loc.name,
        x: loc.x,
        y: loc.y,
        width: loc.width,
        height: loc.height,
        is_mapped: loc.is_mapped
      }))
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warehouse-map-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Błąd przy pobieraniu mapy:\n' + err.message);
  }
}

// ==============================
// RESOURCE TRANSFER MAP (in inventory)
// ==============================

let resourceMapData = null;
let resourceLocations = []; // Locations from DB for resource map
let selectedResourceProduct = null;
let selectedResourceQty = 0;

async function loadResourceMapView() {
  try {
    hideEl('invMapError');
    hideEl('invMapSuccess');

    // Load all products for display on map
    const prodRes = await apiFetch('/api/inventory');
    const products = await prodRes.json();
    window.invItems = products; // Store in window for renderResourceMap
    
    // Load locations from database
    const locRes = await apiFetch('/api/locations');
    resourceLocations = (await locRes.json()) || [];

    // Load warehouse map metadata
    const mapRes = await apiFetch('/api/warehouse/map');
    const mapData = await mapRes.json();
    resourceMapData = mapData.map_data;
    
    // Show unmapped locations
    renderResourceMapUnmapped();
    
    // Render the map
    renderResourceMap(false);
  } catch (err) {
    console.error('Error loading resource map:', err);
    showEl('invMapError', 'Błąd wczytywania mapy');
  }
}

function onResourceProductChange() {
  const select = document.getElementById('invResourceProduct');
  const option = select.options[select.selectedIndex];
  selectedResourceProduct = parseInt(select.value) || null;
  selectedResourceQty = parseInt(document.getElementById('invResourceQty').value) || 1;

  if (!selectedResourceProduct) {
    document.getElementById('invMapCanvas').innerHTML = '<p style="padding:2rem;color:var(--text-muted);">Wybierz produkt.</p>';
    return;
  }

  renderResourceMap();
}

function renderResourceMap(enableClickable = true) {
  const canvas = document.getElementById('invMapCanvas');
  
  // Filter only mapped locations from database
  const mappedLocs = resourceLocations.filter(loc => loc.is_mapped === true);
  
  if (!mappedLocs || !mappedLocs.length) {
    canvas.innerHTML = '<p style="padding:2rem;color:var(--text-muted);">Brak zmapowanych lokalizacji.</p>';
    return;
  }

  const width = resourceMapData?.width || 800;
  const height = resourceMapData?.height || 600;

  canvas.innerHTML = '';
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Render clickable locations with content info
  mappedLocs.forEach(loc => {
    // Get products at this location
    const productsAtLocation = (window.invItems || []).filter(p => p.product_location === loc.name);
    const contentText = productsAtLocation.length > 0 
      ? productsAtLocation.map(p => p.product_name + ' (' + p.product_count + ')').join(', ')
      : 'pusta';
    
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = loc.x + 'px';
    box.style.top = loc.y + 'px';
    box.style.width = loc.width + 'px';
    box.style.height = loc.height + 'px';
    box.style.border = '2px solid #888888';
    box.style.backgroundColor = 'rgba(136,136,136,0.08)';
    box.style.borderRadius = '4px';
    box.style.cursor = 'default';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.fontSize = '12px';
    box.style.fontWeight = 'bold';
    box.style.color = '#666666';
    box.style.userSelect = 'none';
    box.style.transition = 'all 0.2s';
    box.style.padding = '0.5rem';
    box.style.boxSizing = 'border-box';
    box.style.overflow = 'hidden';
    
    // Location name with icon
    const nameDiv = document.createElement('div');
    nameDiv.style.marginBottom = '0.25rem';
    nameDiv.innerHTML = '<i data-lucide="map-pin" style="width:1em;height:1em;vertical-align:middle;display:inline;margin-right:0.25rem;"></i><strong>' + esc(loc.name) + '</strong>';
    
    // Content preview (truncated with popup option if needed)
    const contentDiv = document.createElement('div');
    contentDiv.style.fontSize = '10px';
    contentDiv.style.textAlign = 'center';
    contentDiv.style.maxHeight = loc.height - 40 + 'px';
    contentDiv.style.overflow = 'hidden';
    contentDiv.style.display = 'flex';
    contentDiv.style.flexDirection = 'column';
    contentDiv.style.justifyContent = 'center';
    contentDiv.style.flex = 1;
    
    // Check if content fits
    const contentFitsInBox = contentText.length < 30 && productsAtLocation.length <= 2;
    
    if (contentFitsInBox) {
      contentDiv.textContent = contentText;
    } else {
      // Show truncated content with "Zajrzyj" button
      contentDiv.innerHTML = '<div style="margin-bottom:0.25rem;">' + 
        (productsAtLocation.length > 0 ? productsAtLocation.length + ' produkt' + (productsAtLocation.length !== 1 ? 'ów' : '') : 'pusta') + 
        '</div>';
      if (productsAtLocation.length > 0) {
        const btnZajrzyj = document.createElement('button');
        btnZajrzyj.className = 'btn btn-secondary btn-xs';
        btnZajrzyj.style.padding = '2px 4px';
        btnZajrzyj.title = 'Pokaż produkty';
        btnZajrzyj.innerHTML = '<i data-lucide="eye" style="width:14px;height:14px;"></i>';
        btnZajrzyj.onclick = (e) => {
          e.stopPropagation();
          showLocationContentsPopup(loc.name, productsAtLocation);
        };
        contentDiv.appendChild(btnZajrzyj);
      }
    }
    
    box.appendChild(nameDiv);
    box.appendChild(contentDiv);
    
    box.addEventListener('mouseover', () => {
      box.style.backgroundColor = 'rgba(136,136,136,0.2)';
      box.style.borderColor = '#666666';
    });

    box.addEventListener('mouseout', () => {
      box.style.backgroundColor = 'rgba(136,136,136,0.08)';
      box.style.borderColor = '#888888';
    });

    // Only add click handler if enabled (for "Przesuń towar" view)
    if (enableClickable) {
      box.addEventListener('click', () => handleResourceLocationClick(loc.name));
    }

    canvas.appendChild(box);
  });
  reinitIcons();
}

function showLocationContentsPopup(locationName, products) {
  // Create modal with location contents
  const content = products.map(p => 
    `<tr>
      <td>${esc(p.product_name)}</td>
      <td style="text-align:right;">${p.product_count} szt.</td>
      <td style="text-align:right;">${Number(p.product_price).toFixed(2)} zł</td>
      <td style="text-align:center;">
        <button class="btn btn-primary btn-xs" style="padding:2px 4px;margin-right:0.25rem;" onclick="editProductFromPopup(${p.product_id})" title="Edytuj"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
        <button class="btn btn-danger btn-xs" style="padding:2px 4px;" onclick="deleteProductFromPopup(${p.product_id})" title="Usuń"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </td>
    </tr>`
  ).join('');
  
  const modalId = 'loc-modal-' + Math.random().toString(36).substr(2, 9);
  
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = 'white';
  modal.style.border = '2px solid var(--border-strong)';
  modal.style.borderRadius = '8px';
  modal.style.padding = '1.5rem';
  modal.style.zIndex = '10000';
  modal.style.maxHeight = '80vh';
  modal.style.overflowY = 'auto';
  modal.style.minWidth = '500px';
  modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
      <h3 style="margin:0;"><i data-lucide="map-pin" style="width:1.2em;height:1.2em;vertical-align:middle;display:inline;margin-right:0.5rem;"></i>${esc(locationName)}</h3>
      <button style="background:none;border:none;font-size:1.5rem;cursor:pointer;padding:0;">×</button>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          <th style="text-align:left;padding:0.5rem;">Produkt</th>
          <th style="text-align:right;padding:0.5rem;">Ilość</th>
          <th style="text-align:right;padding:0.5rem;">Cena/szt.</th>
          <th style="text-align:center;padding:0.5rem;">Akcje</th>
        </tr>
      </thead>
      <tbody>
        ${content}
      </tbody>
    </table>
  `;
  
  const backdrop = document.createElement('div');
  backdrop.id = modalId + '-backdrop';
  backdrop.style.position = 'fixed';
  backdrop.style.top = '0';
  backdrop.style.left = '0';
  backdrop.style.width = '100%';
  backdrop.style.height = '100%';
  backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
  backdrop.style.zIndex = '9999';
  
  const closeModal = () => {
    const m = document.getElementById(modalId);
    const b = document.getElementById(modalId + '-backdrop');
    if (m) m.remove();
    if (b) b.remove();
  };
  
  // Close on backdrop click
  backdrop.onclick = closeModal;
  
  // Close on X button click
  const closeBtn = modal.querySelector('button');
  closeBtn.onclick = closeModal;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  reinitIcons();
}

function editProductFromPopup(inventoryId) {
  // Close the popup
  const popups = document.querySelectorAll('[id^="loc-modal-"]');
  popups.forEach(p => p.remove());
  const backdrops = document.querySelectorAll('[id$="-backdrop"]');
  backdrops.forEach(b => b.remove());
  
  // Open edit product modal
  openEditProduct(inventoryId);
}

function deleteProductFromPopup(inventoryId) {
  if (!confirm('Czy na pewno chcesz usunąć ten produkt?')) return;
  
  apiFetch('/api/inventory/' + inventoryId, {
    method: 'DELETE'
  }).then(() => {
    // Close the popup
    const popups = document.querySelectorAll('[id^="loc-modal-"]');
    popups.forEach(p => p.remove());
    const backdrops = document.querySelectorAll('[id$="-backdrop"]');
    backdrops.forEach(b => b.remove());
    
    // Reload views
    loadResourceMapView();
  }).catch(err => {
    alert('Nie udało się usunąć produktu: ' + err.message);
  });
}

async function handleResourceLocationClick(locationName) {
  if (!selectedResourceProduct) {
    showEl('invMapError', 'Wybierz produkt.');
    return;
  }

  const qty = parseInt(document.getElementById('invResourceQty').value) || 1;

  try {
    const res = await apiFetch('/api/inventory/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: selectedResourceProduct,
        new_location: locationName,
        quantity: qty
      })
    });

    if (!res.ok) throw new Error('Przeniesienie nie powiodło się');
    
    showEl('invMapSuccess', `Towar przesunięty do ${locationName}`);
    setTimeout(() => hideEl('invMapSuccess'), 3000);
    
    // Trigger real-time update across all views
    updateAllInventoryViews();
  } catch (err) {
    showEl('invMapError', err.message);
  }
}

// Real-time inventory updates across all views
function updateAllInventoryViews() {
  // Trigger update in parent context (dashboard.js)
  if (typeof renderInventoryViews === 'function') {
    // Reload items first
    apiFetch('/api/inventory').then(r => r.json()).then(items => {
      window.invItems = items;
      renderInventoryViews();
    });
  }
}
