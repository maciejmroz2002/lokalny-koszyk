package router

import (
	"net/http"
	"strings"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/handler"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/middleware"
)

func Register() {
	// Public
	http.HandleFunc("/api/login", handler.Login)
	http.HandleFunc("/api/register", handler.Register)
	http.HandleFunc("/api/catalogue", handler.GetCatalogue)
	http.HandleFunc("/api/catalogue/", handler.GetCatalogueItem)

	// Inventory (admin & magazynier)
	invAuth := middleware.Auth("admin", "magazynier")

	http.Handle("/api/inventory/move", invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handler.MoveItem(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	http.Handle("/api/inventory", invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetAllInventory(w, r)
		case http.MethodPost:
			handler.CreateInventory(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	http.Handle("/api/inventory/", invAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	})))

	// Deliveries
	deliveryAuth := middleware.Auth("admin", "magazynier", "supplier")

	http.Handle("/api/deliveries", deliveryAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	})))

	http.Handle("/api/deliveries/", deliveryAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/status") {
			if r.Method != http.MethodPatch {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			claims, _ := middleware.ClaimsFromContext(r.Context())
			if claims.Role != "admin" && claims.Role != "magazynier" {
				http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
				return
			}
			handler.UpdateDeliveryStatus(w, r)
			return
		}
		if r.Method == http.MethodGet {
			handler.GetDeliveryByID(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	// Supplier
	supplierAuth := middleware.Auth("supplier")
	adminAuth := middleware.Auth("admin")

	http.Handle("/api/supplier/profile", supplierAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetSupplierProfile(w, r)
		case http.MethodPut:
			handler.UpdateSupplierProfile(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	http.Handle("/api/suppliers", adminAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handler.ListSuppliers(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	// Client
	clientAuth := middleware.Auth("client")

	http.Handle("/api/client/profile", clientAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetClientProfile(w, r)
		case http.MethodPut:
			handler.UpdateClientProfile(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	http.Handle("/api/clients", adminAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handler.ListClients(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	// Orders
	orderAuth := middleware.Auth("client", "admin", "magazynier")

	http.Handle("/api/orders", orderAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	})))

	http.Handle("/api/orders/", orderAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	})))
}
