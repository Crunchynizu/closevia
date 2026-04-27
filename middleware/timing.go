package middleware

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
)

const slowRequestThreshold = 500 * time.Millisecond

// RequestTiming logs slow API requests and sets an X-Response-Time header on
// every response. Only the slow-request log line is written (to keep noise low
// in production); the header is always present so it shows up in browser DevTools.
func RequestTiming() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		elapsed := time.Since(start)

		ms := elapsed.Milliseconds()
		c.Set("X-Response-Time", fmt.Sprintf("%dms", ms))

		if elapsed >= slowRequestThreshold {
			log.Printf("[SLOW] %s %s  %dms  status=%d",
				c.Method(), c.Path(), ms, c.Response().StatusCode())
		}

		return err
	}
}
