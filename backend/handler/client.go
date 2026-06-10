package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/client/profile - client views their own profile
func GetClientProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var p model.ClientProfile
	var fullName, email, phone, address sql.NullString
	err := db.DB.QueryRow(
		`SELECT username, full_name, email, phone, address FROM client_profiles WHERE username=$1`,
		claims.Username,
	).Scan(&p.Username, &fullName, &email, &phone, &address)
	if err == sql.ErrNoRows {
		p.Username = claims.Username
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	p.FullName = fullName.String
	p.Email = email.String
	p.Phone = phone.String
	p.Address = address.String
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// PUT /api/client/profile - client creates or updates their own profile
func UpdateClientProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var p model.ClientProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	_, err := db.DB.Exec(
		`INSERT INTO client_profiles (username, full_name, email, phone, address)
		 VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (username) DO UPDATE SET full_name=$2, email=$3, phone=$4, address=$5`,
		claims.Username, p.FullName, p.Email, p.Phone, p.Address,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	p.Username = claims.Username
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// GET /api/clients - admin-only directory of all clients
func ListClients(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.DB.Query(
		`SELECT u.username,
		        COALESCE(cp.full_name,''),
		        COALESCE(cp.phone,''),
		        COALESCE(cp.email,''),
		        COALESCE(cp.address,'')
		 FROM users u
		 LEFT JOIN client_profiles cp ON u.username = cp.username
		 WHERE u.role = 'client'
		 ORDER BY u.username`,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var profiles []model.ClientProfile
	for rows.Next() {
		var p model.ClientProfile
		if err := rows.Scan(&p.Username, &p.FullName, &p.Phone, &p.Email, &p.Address); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		profiles = append(profiles, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profiles)
}
