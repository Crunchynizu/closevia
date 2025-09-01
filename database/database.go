package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDatabase initializes the database connection
func InitDatabase() error {
	// Get database configuration from environment variables or use defaults
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "3306")
	dbUser := getEnv("DB_USER", "root")
	dbPassword := getEnv("DB_PASSWORD", "")
	dbName := getEnv("DB_NAME", "closevia")

	// Create DSN (Data Source Name)
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=Local",
		dbUser, dbPassword, dbHost, dbPort, dbName)

	// Open database connection
	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}

	// Configure connection pool
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Test the connection
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	// Test a simple query to verify we're connected to the right database
	var currentDbName string
	err = DB.QueryRow("SELECT DATABASE()").Scan(&currentDbName)
	if err != nil {
		return fmt.Errorf("failed to get database name: %v", err)
	}

	log.Printf("Successfully connected to MySQL database: %s", currentDbName)
	return nil
}

// CloseDatabase closes the database connection
func CloseDatabase() {
	if DB != nil {
		DB.Close()
		log.Println("Database connection closed")
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// CreateTables creates all necessary tables if they don't exist
func CreateTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(10) NOT NULL DEFAULT 'user',
			verified BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS products (
			id INT AUTO_INCREMENT PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			price DECIMAL(10,2) NOT NULL,
			image_url VARCHAR(500),
			seller_id INT NOT NULL,
			premium BOOLEAN DEFAULT FALSE,
			status ENUM('available', 'sold') DEFAULT 'available',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS orders (
			id INT AUTO_INCREMENT PRIMARY KEY,
			product_id INT NOT NULL,
			buyer_id INT NOT NULL,
			status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
			FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS transactions (
			id INT AUTO_INCREMENT PRIMARY KEY,
			order_id INT NOT NULL,
			amount DECIMAL(10,2) NOT NULL,
			payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS premium_listings (
			id INT AUTO_INCREMENT PRIMARY KEY,
			product_id INT NOT NULL,
			start_date TIMESTAMP NOT NULL,
			end_date TIMESTAMP NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
		)`,
		// Conversations for chat between buyer and seller about a product
		`CREATE TABLE IF NOT EXISTS conversations (
			id INT AUTO_INCREMENT PRIMARY KEY,
			product_id INT NOT NULL,
			buyer_id INT NOT NULL,
			seller_id INT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY uniq_conversation (product_id, buyer_id, seller_id),
			FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
			FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		// Messages within a conversation
		`CREATE TABLE IF NOT EXISTS messages (
			id INT AUTO_INCREMENT PRIMARY KEY,
			conversation_id INT NOT NULL,
			sender_id INT NOT NULL,
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			read_at TIMESTAMP NULL,
			FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
			FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		// Trades and trade items for barter system
		`CREATE TABLE IF NOT EXISTS trades (
			id INT AUTO_INCREMENT PRIMARY KEY,
			buyer_id INT NOT NULL,
			seller_id INT NOT NULL,
			target_product_id INT NOT NULL,
			status ENUM('pending','accepted','declined','countered','active','completed','cancelled') DEFAULT 'pending',
			message TEXT NULL,
			offered_cash_amount DECIMAL(10,2) NULL,
			buyer_completed BOOLEAN DEFAULT FALSE,
			seller_completed BOOLEAN DEFAULT FALSE,
			completed_at TIMESTAMP NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (target_product_id) REFERENCES products(id) ON DELETE CASCADE
		)`,
		// Backfill/alter for existing deployments (ignore errors if already applied)
		`ALTER TABLE trades MODIFY status ENUM('pending','accepted','declined','countered','active','completed','cancelled') DEFAULT 'pending'`,
		`ALTER TABLE trades ADD COLUMN IF NOT EXISTS buyer_completed BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE trades ADD COLUMN IF NOT EXISTS seller_completed BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE trades ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user'`,
		`ALTER TABLE trades ADD COLUMN IF NOT EXISTS offered_cash_amount DECIMAL(10,2) NULL`,
		`CREATE TABLE IF NOT EXISTS trade_items (
			id INT AUTO_INCREMENT PRIMARY KEY,
			trade_id INT NOT NULL,
			product_id INT NOT NULL,
			offered_by ENUM('buyer','seller') NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
			FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS trade_messages (
			id INT AUTO_INCREMENT PRIMARY KEY,
			trade_id INT NOT NULL,
			sender_id INT NOT NULL,
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
			FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		// Trade events history log
		`CREATE TABLE IF NOT EXISTS trade_events (
			id INT AUTO_INCREMENT PRIMARY KEY,
			trade_id INT NOT NULL,
			actor_id INT NULL,
			from_status VARCHAR(32) NULL,
			to_status VARCHAR(32) NULL,
			note VARCHAR(500) NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
			FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
		)`,
		`CREATE TABLE IF NOT EXISTS notifications (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			type VARCHAR(50) NOT NULL,
			message VARCHAR(500) NOT NULL,
			is_read BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
	}

	for _, query := range queries {
		if _, err := DB.Exec(query); err != nil {
			return fmt.Errorf("failed to create table: %v", err)
		}
	}

	// Create indexes
	indexQueries := []string{
		"CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id)",
		"CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)",
		"CREATE INDEX IF NOT EXISTS idx_products_premium ON products(premium)",
		"CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id)",
		"CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id)",
		"CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id)",
		"CREATE INDEX IF NOT EXISTS idx_premium_listings_product ON premium_listings(product_id)",
		"CREATE INDEX IF NOT EXISTS idx_premium_listings_dates ON premium_listings(start_date, end_date)",
		"CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(buyer_id, seller_id)",
		"CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)",
		"CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)",
		"CREATE INDEX IF NOT EXISTS idx_trades_participants ON trades(buyer_id, seller_id)",
		"CREATE INDEX IF NOT EXISTS idx_trades_target ON trades(target_product_id)",
		"CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)",
		"CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id)",
		"CREATE INDEX IF NOT EXISTS idx_trade_items_product ON trade_items(product_id)",
		"CREATE INDEX IF NOT EXISTS idx_trade_messages_trade ON trade_messages(trade_id)",
		"CREATE INDEX IF NOT EXISTS idx_trade_messages_sender ON trade_messages(sender_id)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)",
	}

	for _, query := range indexQueries {
		if _, err := DB.Exec(query); err != nil {
			// Index creation might fail if they already exist, which is fine
			log.Printf("Warning: failed to create index: %v", err)
		}
	}

	log.Println("Database tables and indexes created successfully")
	return nil
}
