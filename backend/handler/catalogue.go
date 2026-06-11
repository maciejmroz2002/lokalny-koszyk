package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/catalogue — product listing (optional JWT - shows different data based on role)
func GetCatalogue(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Try to extract JWT claims if present
	var claims *middleware.JWTClaims
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		raw := strings.TrimPrefix(authHeader, "Bearer ")
		parsedClaims := &middleware.JWTClaims{}
		_, err := jwt.ParseWithClaims(raw, parsedClaims, func(t *jwt.Token) (interface{}, error) {
			secret := os.Getenv("JWT_SECRET")
			if secret != "" {
				return []byte(secret), nil
			}
			return []byte("super_secret_key"), nil
		})
		if err == nil {
			claims = parsedClaims
		}
	}

	var rows *sql.Rows
	var err error

	// Admin and magazynier see all products; client/supplier/anonymous see only in-stock
	if claims != nil && (claims.Role == "admin" || claims.Role == "magazynier") {
		rows, err = db.DB.Query(
			`SELECT product_id, product_name, product_location, product_price, category
			 FROM inventory ORDER BY product_id`,
		)
	} else {
		// Client/supplier/anonymous: only show products with stock > 0
		rows, err = db.DB.Query(
			`SELECT product_id, product_name, product_location, product_price, category
			 FROM inventory WHERE product_count > 0 ORDER BY product_id`,
		)
	}

	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []model.InventoryItem{}
	for rows.Next() {
		var it model.InventoryItem
		if err := rows.Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.Category); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		// Hide price and location for non-admin users
		if claims == nil || (claims.Role != "admin" && claims.Role != "magazynier") {
			it.ProductPrice = 0
			it.ProductLocation = ""
		}
		items = append(items, it)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// GET /api/catalogue/{id}
func GetCatalogueItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var it model.InventoryItem
	err := db.DB.QueryRow(
		`SELECT product_id, product_name, product_location, product_price, category
		 FROM inventory WHERE product_id=$1`, id,
	).Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.Category)
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