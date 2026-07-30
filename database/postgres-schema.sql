BEGIN;

CREATE TABLE IF NOT EXISTS db_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  verify_token_expires TEXT,
  reset_token TEXT,
  reset_token_expires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_customer_id TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  subscription_period TEXT NOT NULL DEFAULT 'monthly',
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  subscription_email_key TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  free_pdf_used INTEGER DEFAULT 0,
  free_book_used INTEGER DEFAULT 0,
  default_leaflet_id BIGINT
);

CREATE TABLE IF NOT EXISTS leaflets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  language_mode TEXT NOT NULL DEFAULT 'one',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  layout_json TEXT,
  thumbnail TEXT
);

CREATE TABLE IF NOT EXISTS leaflet_products (
  id BIGSERIAL PRIMARY KEY,
  leaflet_id BIGINT NOT NULL REFERENCES leaflets(id) ON DELETE CASCADE,
  row_index INTEGER,
  product_name_lan1 TEXT NOT NULL DEFAULT '',
  product_name_lan2 TEXT NOT NULL DEFAULT '',
  product_img_url TEXT NOT NULL DEFAULT '',
  product_image_source TEXT NOT NULL DEFAULT '',
  product_image_license TEXT NOT NULL DEFAULT '',
  product_url TEXT NOT NULL DEFAULT '',
  origin_lan1 TEXT NOT NULL DEFAULT '',
  origin_lan2 TEXT NOT NULL DEFAULT '',
  origin_lan1_iso TEXT NOT NULL DEFAULT '',
  origin_lan2_iso TEXT NOT NULL DEFAULT '',
  old_price DOUBLE PRECISION,
  current_price DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS product_clicks (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES leaflet_products(id) ON DELETE CASCADE,
  leaflet_id BIGINT NOT NULL REFERENCES leaflets(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_plan_prices (
  id BIGSERIAL PRIMARY KEY,
  plan TEXT NOT NULL,
  period TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_product_id TEXT NOT NULL DEFAULT '',
  stripe_price_id TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaflet_pdf_exports (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leaflet_id BIGINT NOT NULL REFERENCES leaflets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  share_token TEXT NOT NULL DEFAULT '',
  allow_edit INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_layout_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  is_platform INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS help_article_groups (
  id BIGSERIAL PRIMARY KEY,
  icon TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS help_articles (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES help_article_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "desc" TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS icon_library (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS icon_preset_overrides (
  icon_key TEXT PRIMARY KEY,
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_pages (
  id BIGSERIAL PRIMARY KEY,
  page_key TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  page_path TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '',
  og_title TEXT NOT NULL DEFAULT '',
  og_description TEXT NOT NULL DEFAULT '',
  og_image TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  robots TEXT NOT NULL DEFAULT 'index, follow',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS page_content (
  id BIGSERIAL PRIMARY KEY,
  page TEXT NOT NULL,
  section TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  UNIQUE(page, section, field)
);

CREATE INDEX IF NOT EXISTS idx_leaflets_user_id ON leaflets(user_id);
CREATE INDEX IF NOT EXISTS idx_leaflet_products_leaflet_id ON leaflet_products(leaflet_id);
CREATE INDEX IF NOT EXISTS idx_product_clicks_product_id ON product_clicks(product_id);
CREATE INDEX IF NOT EXISTS idx_product_clicks_leaflet_id ON product_clicks(leaflet_id);
CREATE INDEX IF NOT EXISTS idx_product_clicks_user_id ON product_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_user_leaflet ON leaflet_pdf_exports(user_id, leaflet_id);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_share_token ON leaflet_pdf_exports(share_token);
CREATE INDEX IF NOT EXISTS idx_card_templates_user_id ON card_layout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_plan_prices_lookup ON stripe_plan_prices(plan, period, active);
CREATE INDEX IF NOT EXISTS idx_stripe_plan_prices_price_id ON stripe_plan_prices(stripe_price_id);

COMMIT;
