package model

import "time"

// Auth

type LoginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResp struct {
	Token string `json:"token"`
}

type RegisterReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Address  string `json:"address"`
}

// Inventory

type InventoryItem struct {
	ProductID       int64   `json:"product_id,omitempty"`
	ProductName     string  `json:"product_name"`
	ProductLocation string  `json:"product_location"`
	ProductPrice    float64 `json:"product_price"`
	ProductCount    int     `json:"product_count,omitempty"`
	Category        string  `json:"category,omitempty"`
}

type MoveItemReq struct {
	ProductID   int64  `json:"product_id"`
	NewLocation string `json:"new_location"`
	Quantity    int    `json:"quantity"` // 0 means move all
}

// Deliveries
// Status lifecycle: pending -> accepted | rejected | completed

type Delivery struct {
	DeliveryID       int64     `json:"delivery_id,omitempty"`
	SupplierUsername string    `json:"supplier_username,omitempty"`
	ProductName      string    `json:"product_name"`
	Quantity         int       `json:"quantity"`
	ProposedPrice    float64   `json:"proposed_price"`
	Status           string    `json:"status,omitempty"`
	Notes            string    `json:"notes,omitempty"`
	CreatedAt        time.Time `json:"created_at,omitempty"`
	UpdatedAt        time.Time `json:"updated_at,omitempty"`
}

type DeliveryStatusReq struct {
	Status   string `json:"status"`
	Notes    string `json:"notes"`
	Location string `json:"location"` // required when status = "completed"
}

// Supplier

type SupplierProfile struct {
	Username    string `json:"username"`
	CompanyName string `json:"company_name"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
}

// Client

type ClientProfile struct {
	Username string `json:"username,omitempty"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Address  string `json:"address"`
}

// Orders
// Status lifecycle: pending -> confirmed -> shipped -> delivered
//                            \ cancelled (from pending or confirmed only)

type OrderItem struct {
	OrderItemID int64   `json:"order_item_id,omitempty"`
	OrderID     int64   `json:"order_id,omitempty"`
	ProductID   int64   `json:"product_id"`
	ProductName string  `json:"product_name,omitempty"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price,omitempty"`
}

type Order struct {
	OrderID         int64       `json:"order_id,omitempty"`
	ClientUsername  string      `json:"client_username,omitempty"`
	Status          string      `json:"status,omitempty"`
	DeliveryAddress string      `json:"delivery_address"`
	Notes           string      `json:"notes,omitempty"`
	TotalPrice      float64     `json:"total_price,omitempty"`
	Items           []OrderItem `json:"items,omitempty"`
	CreatedAt       time.Time   `json:"created_at,omitempty"`
	UpdatedAt       time.Time   `json:"updated_at,omitempty"`
}

type OrderStatusReq struct {
	Status string `json:"status"`
	Notes  string `json:"notes"`
}

// Locations (warehouse sections)

type Location struct {
	LocationID int64  `json:"location_id,omitempty"`
	Name       string `json:"name"`
	X          int    `json:"x"`
	Y          int    `json:"y"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	IsMapped   bool   `json:"is_mapped"`
}

// Warehouse Map (JSON layout)

type WarehouseMapData struct {
	Width     int64      `json:"width"`
	Height    int64      `json:"height"`
	Locations []Location `json:"locations"`
}

type WarehouseMap struct {
	MapID     int64            `json:"map_id,omitempty"`
	MapData   WarehouseMapData `json:"map_data"`
	CreatedAt time.Time        `json:"created_at,omitempty"`
	UpdatedAt time.Time        `json:"updated_at,omitempty"`
}