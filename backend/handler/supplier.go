package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// GET /api/supplier/profile - supplier views their own profile
func GetSupplierProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var p model.SupplierProfile
	var company, phone, email sql.NullString
	err := db.DB.QueryRow(
		`SELECT username, company_name, phone, email FROM supplier_profiles WHERE username=$1`,
		claims.Username,
	).Scan(&p.Username, &company, &phone, &email)
	if err == sql.ErrNoRows {
		// Profile not filled in yet - return skeleton
		p.Username = claims.Username
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	p.CompanyName = company.String
	p.Phone = phone.String
	p.Email = email.String
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// PUT /api/supplier/profile - supplier creates or updates their own profile
func UpdateSupplierProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var p model.SupplierProfile
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	_, err := db.DB.Exec(
		`INSERT INTO supplier_profiles (username, company_name, phone, email)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (username) DO UPDATE SET company_name=$2, phone=$3, email=$4`,
		claims.Username, p.CompanyName, p.Phone, p.Email,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	p.Username = claims.Username
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// GET /api/suppliers - admin-only directory of all suppliers
func ListSuppliers(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.DB.Query(
		`SELECT u.username,
		        COALESCE(sp.company_name,''),
		        COALESCE(sp.phone,''),
		        COALESCE(sp.email,'')
		 FROM users u
		 LEFT JOIN supplier_profiles sp ON u.username = sp.username
		 WHERE u.role = 'supplier'
		 ORDER BY u.username`,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var profiles []model.SupplierProfile
	for rows.Next() {
		var p model.SupplierProfile
		if err := rows.Scan(&p.Username, &p.CompanyName, &p.Phone, &p.Email); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		profiles = append(profiles, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profiles)
}
