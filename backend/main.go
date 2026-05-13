package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

var db *sql.DB
var (
	host     = os.Getenv("DB_HOST")
	port     = os.Getenv("DB_PORT")
	user     = os.Getenv("DB_USERNAME")
	password = os.Getenv("DB_PASSWORD")
	database = os.Getenv("DB_DATABASE")
)

type loginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResp struct {
	Token string `json:"token"`
}

type jwtClaims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

const claimsKey string = "jwtClaims"

func AuthMiddleware(allowedRoles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]struct{}, len(allowedRoles))
	for _, r := range allowedRoles {
		roleSet[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			if h == "" || !strings.HasPrefix(h, "Bearer ") {
				http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
				return
			}
			raw := strings.TrimPrefix(h, "Bearer ")

			claims := &jwtClaims{}
			_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method")
				}
				return jwtSecret, nil
			})
			if err != nil {
				http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
				return
			}

			if len(roleSet) > 0 {
				if _, ok := roleSet[claims.Role]; !ok {
					http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
					return
				}
			}

			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func claimsFromContext(ctx context.Context) (*jwtClaims, bool) {
	c, ok := ctx.Value(claimsKey).(*jwtClaims)
	return c, ok
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var role string
	row := db.QueryRow(`
		SELECT role
		FROM users
		WHERE username = $1
		  AND password_hash = crypt($2, password_hash)`,
		req.Username, req.Password)

	if err := row.Scan(&role); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	claims := jwtClaims{
		Username: req.Username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(jwtSecret)
	if err != nil {
		http.Error(w, "failed to sign token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResp{Token: signed})
}

type inventoryItem struct {
	ProductID       int64   `json:"product_id,omitempty"`
	ProductName     string  `json:"product_name"`
	ProductLocation string  `json:"product_location"`
	ProductPrice    float64 `json:"product_price"`
	ProductCount    int     `json:"product_count,omitempty"` // omitted for catalogue
}

// GET /api/inventory
func getAllInventory(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.Query(`SELECT product_id, product_name, product_location, product_price, product_count FROM inventory ORDER BY product_id`)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []inventoryItem
	for rows.Next() {
		var it inventoryItem
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
func createInventory(w http.ResponseWriter, r *http.Request) {
	var it inventoryItem
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	err := db.QueryRow(
		`INSERT INTO inventory (product_name, product_location, product_price, product_count)
		 VALUES ($1,$2,$3,$4) RETURNING product_id`,
		it.ProductName, it.ProductLocation, it.ProductPrice, it.ProductCount,
	).Scan(&it.ProductID)

	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(it)
}

// GET /api/inventory/{id}
func getInventoryByID(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var it inventoryItem
	err := db.QueryRow(
		`SELECT product_id, product_name, product_location, product_price, product_count
		 FROM inventory WHERE product_id=$1`, id).
		Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice, &it.ProductCount)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(it)
}

// PUT /api/inventory/{id}
func updateInventory(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var it inventoryItem
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	res, err := db.Exec(
		`UPDATE inventory SET product_name=$1, product_location=$2, product_price=$3, product_count=$4
		 WHERE product_id=$5`,
		it.ProductName, it.ProductLocation, it.ProductPrice, it.ProductCount, id)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	it.ProductID = id
	json.NewEncoder(w).Encode(it)
}

// DELETE /api/inventory/{id}
func deleteInventory(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	res, err := db.Exec(`DELETE FROM inventory WHERE product_id=$1`, id)
	if err != nil {
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/catalogue
func catalogueHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`SELECT product_id, product_name, product_location, product_price FROM inventory ORDER BY product_id`)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []inventoryItem
	for rows.Next() {
		var it inventoryItem
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
func catalogueItemHandler(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var it inventoryItem
	err := db.QueryRow(
		`SELECT product_id, product_name, product_location, product_price
		 FROM inventory WHERE product_id=$1`, id).
		Scan(&it.ProductID, &it.ProductName, &it.ProductLocation, &it.ProductPrice)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(it)
}

func extractID(path string) (int64, bool) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return 0, false
	}
	idStr := parts[len(parts)-1]
	id, err := strconv.ParseInt(idStr, 10, 64)
	return id, err == nil
}

func main() {
	conn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, database)

	var err error
	db, err = sql.Open("postgres", conn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	http.HandleFunc("/api/login", loginHandler)

	// PUBLIC catalogue routes
	http.HandleFunc("/api/catalogue", catalogueHandler)      // GET all
	http.HandleFunc("/api/catalogue/", catalogueItemHandler) // GET by id

	// PROTECTED inventory routes (admin & magazynier)
	invAuth := AuthMiddleware("admin", "magazynier")
	http.Handle("/api/inventory", invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getAllInventory(w, r)
		case http.MethodPost:
			createInventory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	http.Handle("/api/inventory/", invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getInventoryByID(w, r)
		case http.MethodPut:
			updateInventory(w, r)
		case http.MethodDelete:
			deleteInventory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	log.Fatal(http.ListenAndServe(":80", nil))
}
