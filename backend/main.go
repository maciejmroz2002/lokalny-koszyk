package main

import (
	"log"
	"net/http"
	"time"

	_ "github.com/lib/pq"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/router"
)

func main() {
	// Retry DB connection on startup (container ordering)
	var err error
	for i := 0; i < 10; i++ {
		err = db.Connect()
		if err == nil {
			if pingErr := db.DB.Ping(); pingErr == nil {
				break
			}
		}
		log.Printf("DB not ready, retrying in 2s... (%d/10)", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	if err := db.DB.Ping(); err != nil {
		log.Fatal("Database not reachable:", err)
	}

	router.Register()

	log.Println("Listening on :80")
	log.Fatal(http.ListenAndServe(":80", nil))
}