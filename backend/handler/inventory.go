package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/inventory
func GetAllInventory(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.DB.Query(
		`SELECT product_id, product_name, product_location, product_price, product_count
		 FROM inventory ORDER BY product_id`,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []model.InventoryItem
	for rows.Next() {
		var it model.InventoryItem
		if err := rows.Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.ProductCount); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		items = append(items, it)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// POST /api/inventory
func CreateInventory(w http.ResponseWriter, r *http.Request) {
	var it model.InventoryItem
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	err := db.DB.QueryRow(
		`INSERT INTO inventory (product_name, product_location, product_price, product_count)
		 VALUES ($1,$2,$3,$4) RETURNING product_id`,
		it.ProductName, it.ProductLocation, it.ProductPrice, it.ProductCount,
	).Scan(&it.ProductID)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(it)
}

// GET /api/inventory/{id}
func GetInventoryByID(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var it model.InventoryItem
	err := db.DB.QueryRow(
		`SELECT product_id, product_name, product_location, product_price, product_count
		 FROM inventory WHERE product_id=$1`, id,
	).Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.ProductCount)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(it)
}

// PUT /api/inventory/{id}
func UpdateInventory(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var it model.InventoryItem
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	res, err := db.DB.Exec(
		`UPDATE inventory SET product_name=$1, product_location=$2, product_price=$3, product_count=$4
		 WHERE product_id=$5`,
		it.ProductName, it.ProductLocation, it.ProductPrice, it.ProductCount, id,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	it.ProductID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(it)
}

// DELETE /api/inventory/{id}
func DeleteInventory(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	res, err := db.DB.Exec(`DELETE FROM inventory WHERE product_id=$1`, id)
	if err != nil {
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// POST /api/inventory/move
// Moves quantity units of a product to a new storage location.
// quantity=0 (or >= total stock) moves everything in place.
// A partial quantity splits the row, merging at the destination if it already exists.
func MoveItem(w http.ResponseWriter, r *http.Request) {
	var req model.MoveItemReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.ProductID == 0 || req.NewLocation == "" {
		http.Error(w, "product_id and new_location are required", http.StatusBadRequest)
		return
	}

	var src model.InventoryItem
	err := db.DB.QueryRow(
		`SELECT product_id, product_name, product_location, product_price, product_count
		 FROM inventory WHERE product_id=$1`, req.ProductID,
	).Scan(&src.ProductID, &src.ProductName, &src.ProductLocation, &src.ProductPrice, &src.ProductCount)
	if err == sql.ErrNoRows {
		http.Error(w, "product not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if src.ProductLocation == req.NewLocation {
		http.Error(w, "product is already at that location", http.StatusBadRequest)
		return
	}

	qty := req.Quantity
	if qty <= 0 || qty >= src.ProductCount {
		// Move all - simple in-place location update
		if _, err := db.DB.Exec(
			`UPDATE inventory SET product_location=$1 WHERE product_id=$2`,
			req.NewLocation, req.ProductID,
		); err != nil {
			http.Error(w, "move failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"moved":        src.ProductCount,
			"new_location": req.NewLocation,
			"product_id":   src.ProductID,
		})
		return
	}

	// Partial move - transactional split
	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	if _, err = tx.Exec(
		`UPDATE inventory SET product_count = product_count - $1 WHERE product_id=$2`,
		qty, req.ProductID,
	); err != nil {
		http.Error(w, "update source failed", http.StatusInternalServerError)
		return
	}

	var destID int64
	err = tx.QueryRow(
		`SELECT product_id FROM inventory WHERE product_name=$1 AND product_location=$2`,
		src.ProductName, req.NewLocation,
	).Scan(&destID)
	switch err {
	case sql.ErrNoRows:
		_, err = tx.Exec(
			`INSERT INTO inventory (product_name, product_location, product_price, product_count) VALUES ($1,$2,$3,$4)`,
			src.ProductName, req.NewLocation, src.ProductPrice, qty,
		)
	case nil:
		_, err = tx.Exec(
			`UPDATE inventory SET product_count = product_count + $1 WHERE product_id=$2`,
			qty, destID,
		)
	}
	if err != nil {
		http.Error(w, "update destination failed", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"moved":             qty,
		"source_product_id": req.ProductID,
		"new_location":      req.NewLocation,
	})
}
