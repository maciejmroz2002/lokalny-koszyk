package handler

import (
	"strconv"
	"strings"
)

// extractID pulls the last path segment and parses it as int64.
// e.g. "/api/orders/42" -> 42, true
func extractID(path string) (int64, bool) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return 0, false
	}
	id, err := strconv.ParseInt(parts[len(parts)-1], 10, 64)
	return id, err == nil
}
