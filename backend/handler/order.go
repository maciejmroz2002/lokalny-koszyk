package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/model"
)

// POST /api/orders — client places a new order
func CreateOrder(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var o model.Order
	if err := json.NewDecoder(r.Body).Decode(&o); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if len(o.Items) == 0 {
		http.Error(w, "order must contain at least one item", http.StatusBadRequest)
		return
	}
	if o.DeliveryAddress == "" {
		http.Error(w, "delivery_address is required", http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	err = tx.QueryRow(
		`INSERT INTO orders (client_username, status, delivery_address, notes)
		 VALUES ($1,'pending',$2,$3)
		 RETURNING order_id, created_at, updated_at`,
		claims.Username, o.DeliveryAddress, o.Notes,
	).Scan(&o.OrderID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		http.Error(w, "order insert failed", http.StatusInternalServerError)
		return
	}

	var savedItems []model.OrderItem
	for _, item := range o.Items {
		if item.ProductID == 0 || item.Quantity <= 0 {
			http.Error(w, "each item needs a valid product_id and quantity > 0", http.StatusBadRequest)
			return
		}

		var available int
		var unitPrice float64
		var productName string
		err = tx.QueryRow(
			`SELECT product_count, product_price, product_name FROM inventory WHERE product_id=$1 FOR UPDATE`,
			item.ProductID,
		).Scan(&available, &unitPrice, &productName)
		if err == sql.ErrNoRows {
			http.Error(w, fmt.Sprintf("product %d not found", item.ProductID), http.StatusBadRequest)
			return
		}
		if err != nil {
			http.Error(w, "inventory read error", http.StatusInternalServerError)
			return
		}
		if available < item.Quantity {
			http.Error(w, fmt.Sprintf(
				"insufficient stock for product %d (%s): have %d, want %d",
				item.ProductID, productName, available, item.Quantity,
			), http.StatusConflict)
			return
		}

		if _, err = tx.Exec(
			`UPDATE inventory SET product_count = product_count - $1 WHERE product_id=$2`,
			item.Quantity, item.ProductID,
		); err != nil {
			http.Error(w, "stock update failed", http.StatusInternalServerError)
			return
		}

		var orderItemID int64
		if err = tx.QueryRow(
			`INSERT INTO order_items (order_id, product_id, quantity, unit_price)
			 VALUES ($1,$2,$3,$4) RETURNING order_item_id`,
			o.OrderID, item.ProductID, item.Quantity, unitPrice,
		).Scan(&orderItemID); err != nil {
			http.Error(w, "order item insert failed", http.StatusInternalServerError)
			return
		}

		o.TotalPrice += unitPrice * float64(item.Quantity)
		savedItems = append(savedItems, model.OrderItem{
			OrderItemID: orderItemID,
			OrderID:     o.OrderID,
			ProductID:   item.ProductID,
			ProductName: productName,
			Quantity:    item.Quantity,
			UnitPrice:   unitPrice,
		})
	}

	if _, err = tx.Exec(
		`UPDATE orders SET total_price=$1 WHERE order_id=$2`, o.TotalPrice, o.OrderID,
	); err != nil {
		http.Error(w, "total price update failed", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	o.ClientUsername = claims.Username
	o.Status = "pending"
	o.Items = savedItems

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(o)
}

// GET /api/orders
func ListOrders(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var rows *sql.Rows
	var err error
	if claims.Role == "client" {
		rows, err = db.DB.Query(
			`SELECT order_id, client_username, status, delivery_address, COALESCE(notes,''), total_price, created_at, updated_at
			 FROM orders WHERE client_username=$1 ORDER BY order_id DESC`,
			claims.Username,
		)
	} else {
		statusFilter := r.URL.Query().Get("status")
		if statusFilter != "" {
			rows, err = db.DB.Query(
				`SELECT order_id, client_username, status, delivery_address, COALESCE(notes,''), total_price, created_at, updated_at
				 FROM orders WHERE status=$1 ORDER BY order_id DESC`, statusFilter,
			)
		} else {
			rows, err = db.DB.Query(
				`SELECT order_id, client_username, status, delivery_address, COALESCE(notes,''), total_price, created_at, updated_at
				 FROM orders ORDER BY order_id DESC`,
			)
		}
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orders := []model.Order{}
	for rows.Next() {
		var o model.Order
		if err := rows.Scan(&o.OrderID, &o.ClientUsername, &o.Status, &o.DeliveryAddress,
			&o.Notes, &o.TotalPrice, &o.CreatedAt, &o.UpdatedAt); err != nil {
			http.Error(w, "row error", http.StatusInternalServerError)
			return
		}
		orders = append(orders, o)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

// GET /api/orders/{id}
func GetOrderByID(w http.ResponseWriter, r *http.Request) {
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

	var o model.Order
	err := db.DB.QueryRow(
		`SELECT order_id, client_username, status, delivery_address, COALESCE(notes,''), total_price, created_at, updated_at
		 FROM orders WHERE order_id=$1`, id,
	).Scan(&o.OrderID, &o.ClientUsername, &o.Status, &o.DeliveryAddress,
		&o.Notes, &o.TotalPrice, &o.CreatedAt, &o.UpdatedAt)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if claims.Role == "client" && o.ClientUsername != claims.Username {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}

	itemRows, err := db.DB.Query(
		`SELECT oi.order_item_id, oi.product_id, i.product_name, oi.quantity, oi.unit_price
		 FROM order_items oi
		 JOIN inventory i ON i.product_id = oi.product_id
		 WHERE oi.order_id=$1`, id,
	)
	if err != nil {
		http.Error(w, "items query error", http.StatusInternalServerError)
		return
	}
	defer itemRows.Close()

	o.Items = []model.OrderItem{}
	for itemRows.Next() {
		var it model.OrderItem
		if err := itemRows.Scan(&it.OrderItemID, &it.ProductID, &it.ProductName, &it.Quantity, &it.UnitPrice); err != nil {
			http.Error(w, "item row error", http.StatusInternalServerError)
			return
		}
		o.Items = append(o.Items, it)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

// PATCH /api/orders/{id}/status
func UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
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

	var req model.OrderStatusReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var o model.Order
	err := db.DB.QueryRow(
		`SELECT order_id, client_username, status FROM orders WHERE order_id=$1`, id,
	).Scan(&o.OrderID, &o.ClientUsername, &o.Status)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if err := validateOrderTransition(claims, o, req.Status); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	if _, err = tx.Exec(
		`UPDATE orders SET status=$1, notes=$2, updated_at=NOW() WHERE order_id=$3`,
		req.Status, req.Notes, id,
	); err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	if req.Status == "cancelled" {
		if err := restoreStock(tx, id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"order_id": id,
		"status":   req.Status,
		"notes":    req.Notes,
	})
}

func validateOrderTransition(claims *middleware.JWTClaims, o model.Order, newStatus string) error {
	cancellable := o.Status == "pending" || o.Status == "confirmed"

	if claims.Role == "client" {
		if o.ClientUsername != claims.Username {
			return fmt.Errorf("forbidden")
		}
		if newStatus != "cancelled" {
			return fmt.Errorf("clients may only cancel orders")
		}
		if !cancellable {
			return fmt.Errorf("cannot cancel order in status '%s'", o.Status)
		}
		return nil
	}

	if newStatus == "cancelled" {
		if !cancellable {
			return fmt.Errorf("cannot cancel order in status '%s'", o.Status)
		}
		return nil
	}
	validNext := map[string]string{
		"pending":   "confirmed",
		"confirmed": "shipped",
		"shipped":   "delivered",
	}
	if validNext[o.Status] != newStatus {
		return fmt.Errorf("invalid transition: %s → %s", o.Status, newStatus)
	}
	return nil
}

func restoreStock(tx *sql.Tx, orderID int64) error {
	rows, err := tx.Query(`SELECT product_id, quantity FROM order_items WHERE order_id=$1`, orderID)
	if err != nil {
		return fmt.Errorf("items query error")
	}
	defer rows.Close()
	for rows.Next() {
		var productID int64
		var qty int
		if err := rows.Scan(&productID, &qty); err != nil {
			return fmt.Errorf("item row error")
		}
		if _, err = tx.Exec(
			`UPDATE inventory SET product_count = product_count + $1 WHERE product_id=$2`,
			qty, productID,
		); err != nil {
			return fmt.Errorf("stock restore failed")
		}
	}
	return nil
}