package main

import (
	"log"
	"net/http"

	_ "github.com/lib/pq"

	"github.com/maciejmroz2002/lokalny-koszyk/backend/db"
	"github.com/maciejmroz2002/lokalny-koszyk/backend/router"
)

func main() {
	err := db.Connect()
	if err != nil {
		log.Fatal("Failed to connect to database")
	}

	router.Register()

	log.Println("Listening on :80")
	log.Fatal(http.ListenAndServe(":80", nil))
}
