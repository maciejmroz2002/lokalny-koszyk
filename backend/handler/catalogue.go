package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/catalogue - public product listing without stock counts
func GetCatalogue(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.DB.Query(
		`SELECT product_id, product_name, product_location, product_price
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
		if err := rows.Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		items = append(items, it)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// GET /api/catalogue/{id}
func GetCatalogueItem(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var it model.InventoryItem
	err := db.DB.QueryRow(
		`SELECT product_id, product_name, product_location, product_price
		 FROM inventory WHERE product_id=$1`, id,
	).Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice)
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
