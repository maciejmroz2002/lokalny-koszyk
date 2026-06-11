package router

import (
	"net/http"
	"strings"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/handler"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
)

// cors adds permissive CORS headers for development
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func Register() {
	mux := http.DefaultServeMux

	// Auth middleware for all authenticated users
	allAuthRoles := middleware.Auth("admin", "magazynier", "supplier", "client")

	// Public
	mux.Handle("/api/login", cors(http.HandlerFunc(handler.Login)))
	mux.Handle("/api/register", cors(http.HandlerFunc(handler.Register)))
	mux.Handle("/api/users/suppliers", cors(allAuthRoles(http.HandlerFunc(handler.GetSuppliers))))

	// Catalogue (public with optional auth - shows different data based on role)
	mux.Handle("/api/catalogue", cors(http.HandlerFunc(handler.GetCatalogue)))
	mux.Handle("/api/catalogue/", cors(allAuthRoles(http.HandlerFunc(handler.GetCatalogueItem))))

	// Inventory (admin & magazynier)
	invAuth := middleware.Auth("admin", "magazynier")

	// /api/inventory/move must be registered BEFORE /api/inventory/ so it isn't swallowed
	mux.Handle("/api/inventory/move", cors(invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handler.MoveItem(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/inventory", cors(invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetAllInventory(w, r)
		case http.MethodPost:
			handler.CreateInventory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/inventory/", cors(invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetInventoryByID(w, r)
		case http.MethodPut:
			handler.UpdateInventory(w, r)
		case http.MethodDelete:
			handler.DeleteInventory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Locations (GET for all authenticated, POST/others for admin & magazynier)
	mux.Handle("/api/locations", cors(allAuthRoles(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			// Anyone authenticated can read locations
			handler.GetAllLocations(w, r)
		} else if r.Method == http.MethodPost {
			// POST requires admin or magazynier
			claims, _ := middleware.ClaimsFromContext(r.Context())
			if claims.Role != "admin" && claims.Role != "magazynier" {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			handler.CreateLocation(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Locations/{id} (GET for all authenticated, others for admin & magazynier)
	mux.Handle("/api/locations/", cors(allAuthRoles(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// Anyone authenticated can read individual location
			handler.GetLocationByID(w, r)
		case http.MethodPut, http.MethodDelete:
			// Modify requires admin/magazynier
			claims, _ := middleware.ClaimsFromContext(r.Context())
			if claims.Role != "admin" && claims.Role != "magazynier" {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			if r.Method == http.MethodPut {
				handler.UpdateLocation(w, r)
			} else {
				handler.DeleteLocation(w, r)
			}
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Warehouse
	mux.Handle("/api/warehouse/map", cors(invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetWarehouseMap(w, r)
		case http.MethodPost:
			handler.UploadWarehouseMap(w, r)
		case http.MethodPut:
			handler.UpdateWarehouseMap(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/warehouse/categories", cors(invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetCategories(w, r)
		case http.MethodPost:
			handler.AddCategory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/warehouse/categories/", cors(invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetCategory(w, r)
		case http.MethodPut:
			handler.UpdateCategory(w, r)
		case http.MethodDelete:
			handler.DeleteCategory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Deliveries
	deliveryAuth := middleware.Auth("admin", "magazynier", "supplier")

	mux.Handle("/api/deliveries", cors(deliveryAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.ListDeliveries(w, r)
		case http.MethodPost:
			claims, _ := middleware.ClaimsFromContext(r.Context())
			if claims.Role != "supplier" {
				http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
				return
			}
			handler.CreateDelivery(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Admin/magazynier orders from supplier
	adminMagazynierAuth := middleware.Auth("admin", "magazynier")
	mux.Handle("/api/deliveries/supplier-order", cors(adminMagazynierAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler.CreateSupplierOrder(w, r)
	}))))

	mux.Handle("/api/deliveries/", cors(deliveryAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/status") {
			if r.Method != http.MethodPatch {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			// Let UpdateDeliveryStatus handle role/permission checks
			handler.UpdateDeliveryStatus(w, r)
			return
		}
		if r.Method == http.MethodGet {
			handler.GetDeliveryByID(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Supplier
	supplierAuth := middleware.Auth("supplier")
	adminAuth := middleware.Auth("admin")

	mux.Handle("/api/supplier/profile", cors(supplierAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetSupplierProfile(w, r)
		case http.MethodPut:
			handler.UpdateSupplierProfile(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/suppliers", cors(adminAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handler.ListSuppliers(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Client
	clientAuth := middleware.Auth("client")

	mux.Handle("/api/client/profile", cors(clientAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetClientProfile(w, r)
		case http.MethodPut:
			handler.UpdateClientProfile(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/clients", cors(adminAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handler.ListClients(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	// Orders
	orderAuth := middleware.Auth("client", "admin", "magazynier")

	mux.Handle("/api/orders", cors(orderAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.ListOrders(w, r)
		case http.MethodPost:
			claims, _ := middleware.ClaimsFromContext(r.Context())
			if claims.Role != "client" {
				http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
				return
			}
			handler.CreateOrder(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/orders/", cors(orderAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/status") {
			if r.Method != http.MethodPatch {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			handler.UpdateOrderStatus(w, r)
			return
		}
		if r.Method == http.MethodGet {
			handler.GetOrderByID(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
}