package utils

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const HostAuthCookieName = "__Host-clovia_session"
const SecureAuthCookieName = "__Secure-clovia_session"
const DevAuthCookieName = "clovia_session"

func isProduction() bool {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	}
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	}
	return env == "production" || env == "prod" || os.Getenv("RENDER") != ""
}

func AuthCookieSameSite() string {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_COOKIE_SAMESITE")))
	switch value {
	case "strict":
		return "Strict"
	case "lax":
		return "Lax"
	case "none":
		return "None"
	default:
		if isProduction() {
			// The hosted frontend and API can be on different sites, so production
			// cookie auth must allow credentialed cross-site XHR.
			return "None"
		}
		return "Lax"
	}
}

func AuthCookieSecure() bool {
	if value := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_COOKIE_SECURE"))); value != "" {
		return value == "1" || value == "true" || value == "yes"
	}
	return isProduction()
}

func AuthCookieDomain() string {
	return strings.TrimSpace(os.Getenv("AUTH_COOKIE_DOMAIN"))
}

func AuthCookiePath() string {
	if value := strings.TrimSpace(os.Getenv("AUTH_COOKIE_PATH")); value != "" {
		return value
	}
	return "/"
}

func PrimaryAuthCookieName() string {
	if AuthCookieSecure() {
		if AuthCookieDomain() == "" && AuthCookiePath() == "/" {
			return HostAuthCookieName
		}
		return SecureAuthCookieName
	}
	return DevAuthCookieName
}

func AuthCookieNames() []string {
	switch PrimaryAuthCookieName() {
	case HostAuthCookieName:
		return []string{HostAuthCookieName, SecureAuthCookieName, DevAuthCookieName}
	case SecureAuthCookieName:
		return []string{SecureAuthCookieName, HostAuthCookieName, DevAuthCookieName}
	default:
		return []string{DevAuthCookieName, HostAuthCookieName, SecureAuthCookieName}
	}
}

func SessionIdleTimeout() time.Duration {
	if minutes := strings.TrimSpace(os.Getenv("SESSION_IDLE_TIMEOUT_MINUTES")); minutes != "" {
		if parsed, err := strconv.Atoi(minutes); err == nil && parsed > 0 && parsed <= 24*60 {
			return time.Duration(parsed) * time.Minute
		}
	}
	return 30 * time.Minute
}

func SetAuthCookie(c *fiber.Ctx, token string) {
	maxAge := SessionIdleTimeout()
	if tokenTTL := TokenTTL(); tokenTTL < maxAge {
		maxAge = tokenTTL
	}
	sameSite := AuthCookieSameSite()
	secure := AuthCookieSecure() || sameSite == "None"
	primaryName := PrimaryAuthCookieName()
	domain := AuthCookieDomain()
	if primaryName == HostAuthCookieName {
		// Browsers reject __Host- cookies if Domain is present.
		domain = ""
	}
	c.Cookie(&fiber.Cookie{
		Name:     primaryName,
		Value:    token,
		Path:     AuthCookiePath(),
		Domain:   domain,
		HTTPOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  time.Now().Add(maxAge),
		MaxAge:   int(maxAge.Seconds()),
	})
}

func ClearAuthCookie(c *fiber.Ctx) {
	sameSite := AuthCookieSameSite()
	secure := AuthCookieSecure() || sameSite == "None"
	for _, name := range AuthCookieNames() {
		domain := AuthCookieDomain()
		if name == HostAuthCookieName {
			domain = ""
		}
		c.Cookie(&fiber.Cookie{
			Name:     name,
			Value:    "",
			Path:     AuthCookiePath(),
			Domain:   domain,
			HTTPOnly: true,
			Secure:   secure,
			SameSite: sameSite,
			Expires:  time.Unix(0, 0),
			MaxAge:   -1,
		})
	}
}
