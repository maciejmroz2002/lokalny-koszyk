package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/warehouse/map
func GetWarehouseMap(w http.ResponseWriter, _ *http.Request) {
	var wm model.WarehouseMap
	var mapDataJSON []byte

	err := db.DB.QueryRow(
		`SELECT map_id, map_data, created_at, updated_at
		 FROM warehouse_maps ORDER BY map_id DESC LIMIT 1`,
	).Scan(&wm.MapID, &mapDataJSON, &wm.CreatedAt, &wm.UpdatedAt)
	if err == sql.ErrNoRows {
		http.Error(w, "no map found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if err := json.Unmarshal(mapDataJSON, &wm.MapData); err != nil {
		http.Error(w, "json decode error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wm)
}

// POST /api/warehouse/map — upload new warehouse map JSON
func UploadWarehouseMap(w http.ResponseWriter, r *http.Request) {
	var wm model.WarehouseMap
	if err := json.NewDecoder(r.Body).Decode(&wm); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	mapDataJSON, err := json.Marshal(wm.MapData)
	if err != nil {
		http.Error(w, "json encode error", http.StatusInternalServerError)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	err = tx.QueryRow(
		`INSERT INTO warehouse_maps (map_data) VALUES ($1)
		 RETURNING map_id, created_at, updated_at`,
		mapDataJSON,
	).Scan(&wm.MapID, &wm.CreatedAt, &wm.UpdatedAt)
	if err != nil {
		http.Error(w, "insert map failed", http.StatusInternalServerError)
		return
	}

	// Sync locations from map data
	for _, loc := range wm.MapData.Locations {
		_, err := tx.Exec(
			`INSERT INTO locations (name, x, y, width, height)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (name) DO UPDATE SET x=$2, y=$3, width=$4, height=$5`,
			loc.Name, loc.X, loc.Y, loc.Width, loc.Height,
		)
		if err != nil {
			http.Error(w, "sync locations failed", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wm)
}

// PUT /api/warehouse/map — update warehouse map dimensions and sync locations
func UpdateWarehouseMap(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MapData model.WarehouseMapData `json:"map_data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	mapDataJSON, err := json.Marshal(req.MapData)
	if err != nil {
		http.Error(w, "json encode error", http.StatusInternalServerError)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update the most recent warehouse map
	_, err = tx.Exec(
		`UPDATE warehouse_maps SET map_data = $1, updated_at = NOW()
		 WHERE map_id = (SELECT map_id FROM warehouse_maps ORDER BY map_id DESC LIMIT 1)`,
		mapDataJSON,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	// Sync locations from map data, preserving is_mapped and other fields
	for _, loc := range req.MapData.Locations {
		_, err := tx.Exec(
			`INSERT INTO locations (name, x, y, width, height, is_mapped)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (name) DO UPDATE SET x=$2, y=$3, width=$4, height=$5, is_mapped=$6`,
			loc.Name, loc.X, loc.Y, loc.Width, loc.Height, loc.IsMapped,
		)
		if err != nil {
			http.Error(w, "sync locations failed", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

// GET /api/warehouse/categories — get all categories from database
func GetCategories(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.DB.Query(
		`SELECT category_id, name, description FROM categories ORDER BY name`,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	categories := []map[string]interface{}{}
	for rows.Next() {
		var categoryID int
		var name, description sql.NullString
		if err := rows.Scan(&categoryID, &name, &description); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		desc := ""
		if description.Valid {
			desc = description.String
		}
		categories = append(categories, map[string]interface{}{
			"category_id": categoryID,
			"name":        name.String,
			"description": desc,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

// POST /api/warehouse/categories — create a new category
func AddCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.Name == "" {
		http.Error(w, "category name cannot be empty", http.StatusBadRequest)
		return
	}

	var categoryID int
	var createdAt, updatedAt time.Time
	err := db.DB.QueryRow(
		`INSERT INTO categories (name, description) VALUES ($1, $2)
		 RETURNING category_id, created_at, updated_at`,
		req.Name, req.Description,
	).Scan(&categoryID, &createdAt, &updatedAt)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"category_id": categoryID,
		"name":        req.Name,
		"description": req.Description,
	})
}

// GET /api/warehouse/categories/:id — get a specific category
func GetCategory(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/warehouse/categories/")
	categoryID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var name, description sql.NullString
	err = db.DB.QueryRow(
		`SELECT name, description FROM categories WHERE category_id = $1`,
		categoryID,
	).Scan(&name, &description)
	if err == sql.ErrNoRows {
		http.Error(w, "category not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	desc := ""
	if description.Valid {
		desc = description.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"category_id": categoryID,
		"name":        name.String,
		"description": desc,
	})
}

// PUT /api/warehouse/categories/:id — update a category
func UpdateCategory(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/warehouse/categories/")
	categoryID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.Name == "" {
		http.Error(w, "category name cannot be empty", http.StatusBadRequest)
		return
	}

	result, err := db.DB.Exec(
		`UPDATE categories SET name = $1, description = $2 WHERE category_id = $3`,
		req.Name, req.Description, categoryID,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "category not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"category_id": categoryID,
		"name":        req.Name,
		"description": req.Description,
	})
}

// DELETE /api/warehouse/categories/:id — delete a category
func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/warehouse/categories/")
	categoryID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	result, err := db.DB.Exec(
		`DELETE FROM categories WHERE category_id = $1`,
		categoryID,
	)
	if err != nil {
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "category not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}