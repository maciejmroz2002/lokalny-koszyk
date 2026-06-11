package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/locations
func GetAllLocations(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.DB.Query(
		`SELECT location_id, name, x, y, width, height, is_mapped FROM locations ORDER BY location_id`,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	locations := []model.Location{}
	for rows.Next() {
		var loc model.Location
		if err := rows.Scan(&loc.LocationID, &loc.Name, &loc.X, &loc.Y, &loc.Width, &loc.Height, &loc.IsMapped); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		locations = append(locations, loc)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(locations)
}

// POST /api/locations
func CreateLocation(w http.ResponseWriter, r *http.Request) {
	var loc model.Location
	if err := json.NewDecoder(r.Body).Decode(&loc); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if loc.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	err := db.DB.QueryRow(
		`INSERT INTO locations (name, x, y, width, height, is_mapped)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING location_id`,
		loc.Name, loc.X, loc.Y, loc.Width, loc.Height, loc.IsMapped,
	).Scan(&loc.LocationID)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(loc)
}

// GET /api/locations/{id}
func GetLocationByID(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var loc model.Location
	err := db.DB.QueryRow(
		`SELECT location_id, name, x, y, width, height, is_mapped FROM locations WHERE location_id=$1`, id,
	).Scan(&loc.LocationID, &loc.Name, &loc.X, &loc.Y, &loc.Width, &loc.Height, &loc.IsMapped)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loc)
}

// PUT /api/locations/{id}
func UpdateLocation(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var loc model.Location
	if err := json.NewDecoder(r.Body).Decode(&loc); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	res, err := db.DB.Exec(
		`UPDATE locations SET name=$1, x=$2, y=$3, width=$4, height=$5, is_mapped=$6 WHERE location_id=$7`,
		loc.Name, loc.X, loc.Y, loc.Width, loc.Height, loc.IsMapped, id,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	loc.LocationID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loc)
}

// DELETE /api/locations/{id}
func DeleteLocation(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	res, err := db.DB.Exec(`DELETE FROM locations WHERE location_id=$1`, id)
	if err != nil {
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}