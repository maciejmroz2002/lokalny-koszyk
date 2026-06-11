package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// POST /api/login
func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req model.LoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var role string
	err := db.DB.QueryRow(
		`SELECT role FROM users WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
		req.Username, req.Password,
	).Scan(&role)
	if err == sql.ErrNoRows {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "super_secret_key"
	}

	claims := middleware.JWTClaims{
		Username: req.Username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		http.Error(w, "failed to sign token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(model.LoginResp{Token: signed})
}

// POST /api/register — public self-registration, always creates a client account
func Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req model.RegisterReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.Username == "" || req.Password == "" {
		http.Error(w, "username and password are required", http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`INSERT INTO users (username, password_hash, role) VALUES ($1, crypt($2, gen_salt('bf')), 'client')`,
		req.Username, req.Password,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			http.Error(w, "username already taken", http.StatusConflict)
			return
		}
		http.Error(w, "registration failed", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		`INSERT INTO client_profiles (username, full_name, email, phone, address) VALUES ($1,$2,$3,$4,$5)`,
		req.Username, req.FullName, req.Email, req.Phone, req.Address,
	)
	if err != nil {
		http.Error(w, "profile creation failed", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"username": req.Username, "role": "client"})
}

// GET /api/users/suppliers — list all suppliers
func GetSuppliers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`SELECT username FROM users WHERE role='supplier' ORDER BY username`)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var suppliers []map[string]string
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		suppliers = append(suppliers, map[string]string{"username": username})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suppliers)
}