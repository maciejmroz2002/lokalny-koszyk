package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// POST /api/deliveries — supplier submits a new delivery proposal
func CreateDelivery(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var d model.Delivery
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if d.ProductName == "" || d.Quantity <= 0 || d.ProposedPrice <= 0 {
		http.Error(w, "product_name, quantity > 0, and proposed_price > 0 are required", http.StatusBadRequest)
		return
	}

	err := db.DB.QueryRow(
		`INSERT INTO deliveries (supplier_username, product_name, quantity, proposed_price, status)
		 VALUES ($1,$2,$3,$4,'pending')
		 RETURNING delivery_id, status, created_at, updated_at`,
		claims.Username, d.ProductName, d.Quantity, d.ProposedPrice,
	).Scan(&d.DeliveryID, &d.Status, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	d.SupplierUsername = claims.Username
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(d)
}

// GET /api/deliveries
// Admin/magazynier see all; suppliers see only their own.
func ListDeliveries(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var rows *sql.Rows
	var err error
	if claims.Role == "supplier" {
		rows, err = db.DB.Query(
			`SELECT delivery_id, supplier_username, product_name, quantity, proposed_price, status,
			        COALESCE(notes,''), created_at, updated_at
			 FROM deliveries WHERE supplier_username=$1 ORDER BY delivery_id DESC`,
			claims.Username,
		)
	} else {
		rows, err = db.DB.Query(
			`SELECT delivery_id, supplier_username, product_name, quantity, proposed_price, status,
			        COALESCE(notes,''), created_at, updated_at
			 FROM deliveries ORDER BY delivery_id DESC`,
		)
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []model.Delivery{}
	for rows.Next() {
		var d model.Delivery
		if err := rows.Scan(&d.DeliveryID, &d.SupplierUsername, &d.ProductName, &d.Quantity,
			&d.ProposedPrice, &d.Status, &d.Notes, &d.CreatedAt, &d.UpdatedAt); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		items = append(items, d)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// GET /api/deliveries/{id}
func GetDeliveryByID(w http.ResponseWriter, r *http.Request) {
	id, ok := extractID(r.URL.Path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var d model.Delivery
	err := db.DB.QueryRow(
		`SELECT delivery_id, supplier_username, product_name, quantity, proposed_price, status,
		        COALESCE(notes,''), created_at, updated_at
		 FROM deliveries WHERE delivery_id=$1`, id,
	).Scan(&d.DeliveryID, &d.SupplierUsername, &d.ProductName, &d.Quantity,
		&d.ProposedPrice, &d.Status, &d.Notes, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if claims.Role == "supplier" && d.SupplierUsername != claims.Username {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(d)
}

// PATCH /api/deliveries/{id}/status — admin/magazynier only
func UpdateDeliveryStatus(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSuffix(r.URL.Path, "/status")
	id, ok := extractID(path)
	if !ok {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req model.DeliveryStatusReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Get current delivery
	var d model.Delivery
	err := db.DB.QueryRow(
		`SELECT delivery_id, supplier_username, product_name, quantity, proposed_price, status
		 FROM deliveries WHERE delivery_id=$1`, id,
	).Scan(&d.DeliveryID, &d.SupplierUsername, &d.ProductName, &d.Quantity, &d.ProposedPrice, &d.Status)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// Validate status transitions based on current status, user role, and requested status
	isAdmin := claims.Role == "admin"
	isSupplier := claims.Username == d.SupplierUsername
	isMagazynier := claims.Role == "magazynier"

	// Rule 1: Only admin can change pending → accepted
	if d.Status == "pending" && req.Status == "accepted" {
		if !isAdmin {
			http.Error(w, "only admin can accept a pending delivery", http.StatusForbidden)
			return
		}
	} else if d.Status == "accepted" && (req.Status == "ready_for_pickup" || req.Status == "cancelled") {
		// Rule 2: Only supplier can change accepted → ready_for_pickup or cancelled
		if !isSupplier {
			http.Error(w, "only supplier can change status for accepted delivery", http.StatusForbidden)
			return
		}
	} else if d.Status == "ready_for_pickup" && (req.Status == "completed" || req.Status == "returned_to_supplier") {
		// Rule 3: Only admin or magazynier can change ready_for_pickup → completed or returned_to_supplier
		if !(isAdmin || isMagazynier) {
			http.Error(w, "only admin or magazynier can complete or return a delivery", http.StatusForbidden)
			return
		}
		// completed requires location
		if req.Status == "completed" && req.Location == "" {
			http.Error(w, "location is required when completing a delivery", http.StatusBadRequest)
			return
		}
	} else if d.Status == "cancelled" || d.Status == "completed" || d.Status == "returned_to_supplier" {
		// No further status changes allowed for terminal states
		http.Error(w, "cannot change status of "+d.Status+" delivery", http.StatusBadRequest)
		return
	} else {
		// Disallow other transitions
		http.Error(w, "invalid status transition from "+d.Status+" to "+req.Status, http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	if _, err = tx.Exec(
		`UPDATE deliveries SET status=$1, notes=$2, updated_at=NOW() WHERE delivery_id=$3`,
		req.Status, req.Notes, id,
	); err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	// On completion, stock the inventory
	if req.Status == "completed" {
		if req.Location == "" {
			http.Error(w, "location is required when completing a delivery", http.StatusBadRequest)
			return
		}
		var existingID int64
		err = tx.QueryRow(
			`SELECT product_id FROM inventory WHERE product_name=$1 AND product_location=$2`,
			d.ProductName, req.Location,
		).Scan(&existingID)
		switch err {
		case sql.ErrNoRows:
			_, err = tx.Exec(
				`INSERT INTO inventory (product_name, product_location, product_price, product_count, category)
				 VALUES ($1,$2,$3,$4,'Inne')`,
				d.ProductName, req.Location, d.ProposedPrice, d.Quantity,
			)
		case nil:
			_, err = tx.Exec(
				`UPDATE inventory SET product_count = product_count + $1 WHERE product_id=$2`,
				d.Quantity, existingID,
			)
		}
		if err != nil {
			http.Error(w, "inventory update failed", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
		var existingID int64
		err = tx.QueryRow(
			`SELECT product_id FROM inventory WHERE product_name=$1 AND product_location=$2`,
			d.ProductName, req.Location,
		).Scan(&existingID)
		switch err {
		case sql.ErrNoRows:
			_, err = tx.Exec(
				`INSERT INTO inventory (product_name, product_location, product_price, product_count, category)
				 VALUES ($1,$2,$3,$4,'Inne')`,
				d.ProductName, req.Location, d.ProposedPrice, d.Quantity,
			)
		case nil:
			_, err = tx.Exec(
				`UPDATE inventory SET product_count = product_count + $1 WHERE product_id=$2`,
				d.Quantity, existingID,
			)
		}
		if err != nil {
			http.Error(w, "inventory update failed", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"delivery_id": id,
		"status":      req.Status,
		"notes":       req.Notes,
	})
}