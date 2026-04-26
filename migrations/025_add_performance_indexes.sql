-- Performance indexes for commonly-filtered and commonly-sorted columns.
-- These fill gaps left by earlier migrations and address the most frequent
-- slow-query patterns identified in the audit (ORDER BY recency, buyer/seller
-- trade lookups, and the wishlist/trade-count sub-selects in product search).

-- ── Products ────────────────────────────────────────────────────────────────

-- Sorting by recency (the default home-feed and dashboard order)
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products (updated_at);

-- Compound for ORDER BY premium DESC, created_at DESC used in GetProducts
CREATE INDEX IF NOT EXISTS idx_products_premium_created ON products (premium, created_at);

-- Dashboard: WHERE seller_id = ? AND status = 'active' (user's own listings)
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON products (seller_id, status(20));

-- ── Trades ──────────────────────────────────────────────────────────────────

-- Simple buyer / seller lookups (the compound indexes from migration 021 cover
-- the three-column duplicate-check query; these cover plain buyer/seller scans)
CREATE INDEX IF NOT EXISTS idx_trades_buyer_id  ON trades (buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON trades (seller_id);

-- Buyer/seller trade list sorted by date (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_trades_buyer_created  ON trades (buyer_id,  created_at);
CREATE INDEX IF NOT EXISTS idx_trades_seller_created ON trades (seller_id, created_at);

-- ── Wishlists / Saved Products ───────────────────────────────────────────────

-- Used in the COUNT(*) sub-select that ranks products by wishlist popularity
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists (product_id);
