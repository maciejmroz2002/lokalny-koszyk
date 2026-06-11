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
		`SELECT product_id, product_name, product_location, product_price, product_count, category
		 FROM inventory ORDER BY product_id`,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []model.InventoryItem{}
	for rows.Next() {
		var it model.InventoryItem
		if err := rows.Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.ProductCount, &it.Category); err != nil {
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

	if it.ProductName == "" || it.ProductLocation == "" {
		http.Error(w, "product_name and product_location are required", http.StatusBadRequest)
		return
	}
	if it.Category == "" {
		it.Category = "Inne"
	}

	err := db.DB.QueryRow(
		`INSERT INTO inventory (product_name, product_location, product_price, product_count, category)
		 VALUES ($1,$2,$3,$4,$5) RETURNING product_id`,
		it.ProductName, it.ProductLocation, it.ProductPrice, it.ProductCount, it.Category,
	).Scan(&it.ProductID)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
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
		`SELECT product_id, product_name, product_location, product_price, product_count, category
		 FROM inventory WHERE product_id=$1`, id,
	).Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.ProductCount, &it.Category)
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

	if it.Category == "" {
		it.Category = "Inne"
	}

	res, err := db.DB.Exec(
		`UPDATE inventory SET product_name=$1, product_location=$2, product_price=$3, product_count=$4, category=$5
		 WHERE product_id=$6`,
		it.ProductName, it.ProductLocation, it.ProductPrice, it.ProductCount, it.Category, id,
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
func MoveItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

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
		// Move all
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

	// Partial move
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
			`INSERT INTO inventory (product_name, product_location, product_price, product_count, category)
			 SELECT product_name, $1, product_price, $2, category FROM inventory WHERE product_id=$3`,
			req.NewLocation, qty, req.ProductID,
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