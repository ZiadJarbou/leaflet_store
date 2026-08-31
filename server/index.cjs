// server/index.cjs
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../data/.env') });
dotenv.config({ path: path.resolve(__dirname, '../data/.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.on('uncaughtException', err => { console.error('[uncaughtException]', err); });
process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); });

const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Database = require('better-sqlite3');
const crypto   = require('crypto');
const fs       = require('fs');
const https    = require('https');
const dns      = require('dns').promises;
const net      = require('net');
const multer   = require('multer');
const Stripe   = require('stripe');
const nodemailer = require('nodemailer');

const zlib = require('zlib');

function envValue(...names) {
  for (const name of names) {
    let value = String(process.env[name] || '').trim();
    if (value.toLowerCase().startsWith(`${name.toLowerCase()}=`)) {
      value = value.slice(name.length + 1).trim();
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    if (value) return value;
  }
  return '';
}

// In development Vite owns port 3000 and proxies API requests here.
// Hosting providers can still override this with their assigned PORT.
const PORT       = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'leafletai-dev-secret-change-in-prod';
const IS_PRODUCTION                = process.env.NODE_ENV === 'production';
const ALLOW_PRODUCTION_DB_BOOTSTRAP = process.env.ALLOW_PRODUCTION_DB_BOOTSTRAP === 'I_UNDERSTAND_THIS_CREATES_A_NEW_PRODUCTION_DATABASE';
const LEGACY_DATA_DIR              = path.resolve(__dirname);
const DEFAULT_PRODUCTION_DATA_DIR  = path.resolve(__dirname, '../..', 'data');
const DATA_DIR                     = path.resolve(envValue('DATA_DIR', 'LEAFLETAI_DATA_DIR') || (IS_PRODUCTION ? DEFAULT_PRODUCTION_DATA_DIR : LEGACY_DATA_DIR));
const DB_PATH                      = path.join(DATA_DIR, 'leafletai.db');
const LEGACY_DB_PATH               = path.join(LEGACY_DATA_DIR, 'leafletai.db');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDirectoryIfMissing(source, destination) {
  if (!fs.existsSync(source) || fs.existsSync(destination)) return;
  fs.cpSync(source, destination, { recursive: true });
}

function prepareProductionDataDir() {
  ensureDir(DATA_DIR);

  if (IS_PRODUCTION && DB_PATH !== LEGACY_DB_PATH && !fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
    console.warn(`[production-data] Migrating existing database from ${LEGACY_DB_PATH} to ${DB_PATH}.`);
    fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
    for (const suffix of ['-wal', '-shm']) {
      const source = `${LEGACY_DB_PATH}${suffix}`;
      if (fs.existsSync(source)) fs.copyFileSync(source, `${DB_PATH}${suffix}`);
    }
    copyDirectoryIfMissing(path.join(LEGACY_DATA_DIR, 'uploads'), path.join(DATA_DIR, 'uploads'));
    copyDirectoryIfMissing(path.join(LEGACY_DATA_DIR, 'pdf_exports'), path.join(DATA_DIR, 'pdf_exports'));
    copyDirectoryIfMissing(path.join(LEGACY_DATA_DIR, 'backups'), path.join(DATA_DIR, 'backups'));
  }

  if (IS_PRODUCTION && !fs.existsSync(DB_PATH) && !ALLOW_PRODUCTION_DB_BOOTSTRAP) {
    throw new Error(
      `Production database not found at ${DB_PATH}. Refusing to create an empty production database. ` +
      'Set DATA_DIR/LEAFLETAI_DATA_DIR to the persistent production data folder, or restore the existing leafletai.db. ' +
      'Only set ALLOW_PRODUCTION_DB_BOOTSTRAP=I_UNDERSTAND_THIS_CREATES_A_NEW_PRODUCTION_DATABASE for a deliberate first-time production install.'
    );
  }
}

prepareProductionDataDir();

const STRIPE_SECRET_KEY            = envValue('STRIPE_SECRET_KEY')            || '';
const STRIPE_WEBHOOK_SECRET        = process.env.STRIPE_WEBHOOK_SECRET        || '';
const STRIPE_PRO_MONTHLY_PRICE_ID  = process.env.STRIPE_PRO_MONTHLY_PRICE_ID  || '';
const STRIPE_PRO_ANNUAL_PRICE_ID   = process.env.STRIPE_PRO_ANNUAL_PRICE_ID   || '';
const STRIPE_BIZ_MONTHLY_PRICE_ID  = process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '';
const STRIPE_BIZ_ANNUAL_PRICE_ID   = process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID  || '';
const APP_URL                      = String(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const OPENAI_API_KEY               = envValue('OPENAI_API_KEY') || '';
const OPENAI_IMAGE_MODEL           = envValue('OPENAI_IMAGE_MODEL') || 'gpt-image-1';
function smtpPasswordValue() {
  const value = envValue('SMTP_PASS');
  if (/gmail\.com$/i.test(envValue('SMTP_HOST'))) {
    return value.replace(/\s+/g, '');
  }
  return value;
}
const GOOGLE_OAUTH_CLIENT_ID       = envValue('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_AUTH_CLIENT_ID');
const GOOGLE_OAUTH_CLIENT_SECRET   = envValue('GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_AUTH_CLIENT_SECRET');
console.log({
  clientIdLoaded: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
  clientSecretLoaded: Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
});
const SMTP_HOST                    = envValue('SMTP_HOST');
const SMTP_PORT                    = Number(envValue('SMTP_PORT') || 587);
const SMTP_SECURE                  = envValue('SMTP_SECURE').toLowerCase() === 'true';
const SMTP_USER                    = envValue('SMTP_USER');
const SMTP_PASS                    = smtpPasswordValue();
const MAIL_FROM                    = envValue('MAIL_FROM') || 'LeafletAI <no-reply@leafletai.ai>';
const SUBSCRIPTION_MAIL_FROM       = 'LeafletAI <no-reply@leafletai.ai>';
const CONTACT_TO_EMAIL             = envValue('CONTACT_TO_EMAIL') || 'info@leafletai.ai';
const ALLOW_PRODUCTION_SEEDING     = process.env.ALLOW_PRODUCTION_SEEDING === 'I_UNDERSTAND_THIS_SEEDS_PRODUCTION';

function productionSafetyError(operation) {
  return new Error(`${operation} is blocked in production to protect existing database data and user-generated files.`);
}

function shouldSeedDefaultContent() {
  return !IS_PRODUCTION || ALLOW_PRODUCTION_SEEDING;
}

let stripe = null;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const DEFAULT_STRIPE_PLAN_PRICES = {
  starter:  { monthlyPrice: 13.34, yearlyPrice: 133.42 / 12, annualPrice: 133.42, name: 'Starter' },
  pro:      { monthlyPrice: 26.96, yearlyPrice: 269.57 / 12, annualPrice: 269.57, name: 'Professional' },
  business: { monthlyPrice: 67.80, yearlyPrice: 677.99 / 12, annualPrice: 677.99, name: 'Business' },
  agency:   { monthlyPrice: 163.10, yearlyPrice: 0, name: 'Agency' },
};

const DEFAULT_PRICING_PLANS = [
  { id:'free', name:'Free', badge:null, monthlyPrice:0, yearlyPrice:0, annualPrice:0, desc:'Explore LeafletAI and create your first promotional leaflet.', cta:'Start for Free', ctaVariant:'ghost', highlight:false, checkoutPlanId:'free', features:['1 leaflet per month','Up to 20 products per leaflet','Basic leaflet templates','CSV and XLSX product import','2-language support','Standard-quality export','LeafletAI watermark','Concurrent logins: 1 device'] },
  { id:'starter', name:'Starter', badge:null, monthlyPrice:13.34, yearlyPrice:133.42 / 12, annualPrice:133.42, desc:'Perfect for small shops and businesses that create promotional leaflets occasionally.', cta:'Choose Starter', ctaVariant:'ghost', highlight:false, checkoutPlanId:'starter', features:['Up to 5 leaflets per month','Up to 100 products per leaflet','CSV and XLSX product import','2-language layouts','Basic template library','PDF and PNG export','No LeafletAI watermark','Save and edit your leaflets','Concurrent logins: 2 devices'] },
  { id:'pro', name:'Professional', badge:'Most Popular', monthlyPrice:26.96, yearlyPrice:269.57 / 12, annualPrice:269.57, desc:'The best choice for supermarkets and active retailers that regularly create promotional campaigns.', cta:'Choose Professional', ctaVariant:'primary', highlight:true, checkoutPlanId:'pro', features:['Up to 25 leaflets per month','Large product imports','Access to all premium templates','High-quality print-ready PDF export','2-language layouts','Custom fonts','Brand kit with logos, colors, and fonts','Background removal tools','Custom reusable templates','Priority support','Concurrent logins: 3 devices'] },
  { id:'business', name:'Business', badge:null, monthlyPrice:67.80, yearlyPrice:677.99 / 12, annualPrice:677.99, desc:'Designed for marketing teams, multi-branch retailers, and businesses managing frequent promotional campaigns.', cta:'Choose Business', ctaVariant:'brand2', highlight:false, checkoutPlanId:'business', features:['Up to 100 leaflets per month','Concurrent logins: 5 devices','Multiple brands and branches','Shared product library','Shared brand assets and templates','Team collaboration','User roles and permissions','High-quality PDF and PNG export','Advanced AI tools','Higher AI usage limits','Priority customer support','Branch-specific logos and contact details'] },
  { id:'agency', name:'Agency', badge:null, monthlyPrice:163.10, yearlyPrice:0, annualPriceLabel:'Custom annual pricing', pricePrefix:'Starting from', desc:'Built for agencies and large organizations managing multiple brands, stores, or clients.', cta:'Contact Sales', ctaVariant:'ghost', highlight:false, checkoutPlanId:'contact', features:['High-volume or unlimited leaflet creation','Multiple client workspaces','Concurrent logins: 10+ devices','Separate brand kits for each client','White-label leaflet exports','Advanced team permissions','Bulk product and design management','Custom templates for each client','Batch export tools','Premium customer support','Custom onboarding and training'] },
];

const DEFAULT_PRICING_FEATURES = [
  { label:'Leaflets per month', free:'1', starter:'5', pro:'25', business:'100', agency:'High-volume' },
  { label:'Products per leaflet', free:'20', starter:'100', pro:'Large imports', business:true, agency:true },
  { label:'CSV and XLSX import', free:true, starter:true, pro:true, business:true, agency:true },
  { label:'2-language layouts', free:true, starter:true, pro:true, business:true, agency:true },
  { label:'PDF and PNG export', free:false, starter:true, pro:true, business:true, agency:true },
  { label:'Watermark removed', free:false, starter:true, pro:true, business:true, agency:true },
  { label:'Brand kits and templates', free:false, starter:false, pro:true, business:true, agency:true },
  { label:'Concurrent logins', free:'1 device', starter:'2 devices', pro:'3 devices', business:'5 devices', agency:'10+ devices' },
];

const DEFAULT_PRICING_ANNUAL_ITEMS = [
  'Starter: $133.42 per year',
  'Professional: $269.57 per year',
  'Business: $677.99 per year',
  'Agency: Custom annual pricing',
];
const PLAN_PRICE_SETTING_MAP = {
  starter: {
    monthly: 'plan_price_starter_monthly',
    annual: 'plan_price_starter_annual',
  },
  pro: {
    monthly: 'plan_price_pro_monthly',
    annual: 'plan_price_pro_annual',
  },
  business: {
    monthly: 'plan_price_business_monthly',
    annual: 'plan_price_business_annual',
  },
  agency: {
    monthly: 'plan_price_agency_monthly',
    annual: 'plan_price_agency_annual',
  },
};
const PLAN_PRICE_SETTING_KEYS = new Set(Object.values(PLAN_PRICE_SETTING_MAP).flatMap(keys => Object.values(keys)));

const PRODUCT_IMPORT_LIMIT_BY_PLAN = {
  free: 20,
  starter: 100,
};

const LEAFLET_CREATION_LIMIT_BY_PLAN = {
  free: 3,
  starter: 5,
  pro: 25,
  professional: 25,
  business: 100,
  agency: 1000,
  admin: 1000,
};
const LEAFLET_CREATION_SETTING_KEYS = {
  free: 'max_leaflets_free',
  starter: 'max_leaflets_starter',
  pro: 'max_leaflets_pro',
  professional: 'max_leaflets_pro',
  business: 'max_leaflets_business',
  agency: 'max_leaflets_agency',
  admin: 'max_leaflets_agency',
};
const LEAFLET_CREATION_SETTING_KEY_SET = new Set(Object.values(LEAFLET_CREATION_SETTING_KEYS));

const AI_COVER_GENERATION_LIMIT_BY_PLAN = {
  free: 1,
  starter: 2,
  pro: 4,
  professional: 4,
  business: 6,
  agency: 10,
  admin: 10,
};
const AI_COVER_GENERATION_SETTING_KEYS = {
  free: 'ai_cover_generations_free',
  starter: 'ai_cover_generations_starter',
  pro: 'ai_cover_generations_pro',
  professional: 'ai_cover_generations_pro',
  business: 'ai_cover_generations_business',
  agency: 'ai_cover_generations_agency',
  admin: 'ai_cover_generations_agency',
};
const AI_COVER_GENERATION_SETTING_KEY_SET = new Set(Object.values(AI_COVER_GENERATION_SETTING_KEYS));

function productImportLimitForUser(user) {
  if (isUnlimitedUser(user) || String(user?.role || '').toLowerCase() === 'admin') return Infinity;
  const plan = String(user?.subscription_plan || 'free').trim().toLowerCase();
  return PRODUCT_IMPORT_LIMIT_BY_PLAN[plan] ?? Infinity;
}

function productImportLimitPayload(user) {
  const limit = productImportLimitForUser(user);
  const unlimited = !Number.isFinite(limit);
  return {
    plan: unlimited && isUnlimitedUser(user) ? 'admin' : String(user?.subscription_plan || 'free').trim().toLowerCase() || 'free',
    limit: unlimited ? null : limit,
    unlimited,
  };
}

function normalizeSubscriptionPlan(plan) {
  const safePlan = String(plan || 'free').trim().toLowerCase();
  return safePlan === 'professional' ? 'pro' : (safePlan || 'free');
}

function leafletCreationLimitForUser(user) {
  if (isUnlimitedUser(user) || String(user?.role || '').toLowerCase() === 'admin') return Infinity;
  const safePlan = normalizeSubscriptionPlan(user?.subscription_plan);
  const fallback = LEAFLET_CREATION_LIMIT_BY_PLAN[safePlan] ?? LEAFLET_CREATION_LIMIT_BY_PLAN.free;
  const settingKey = LEAFLET_CREATION_SETTING_KEYS[safePlan];
  if (!settingKey) return fallback;
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(settingKey);
  const configured = Number.parseInt(String(row?.value || '').trim(), 10);
  return Number.isInteger(configured) && configured >= 0 ? configured : fallback;
}

function leafletPlanLabel(plan) {
  const safePlan = normalizeSubscriptionPlan(plan);
  if (safePlan === 'pro') return 'Professional';
  return safePlan.charAt(0).toUpperCase() + safePlan.slice(1);
}

function exportedLeafletUsageForUser(userId) {
  return Number(db.prepare('SELECT exported_leaflets_used FROM users WHERE id = ?').get(userId)?.exported_leaflets_used || 0);
}

function assertCanCountExportedLeaflet(userId) {
  const user = db.prepare('SELECT email, role, subscription_plan FROM users WHERE id = ?').get(userId);
  if (!user) throw httpError(401, 'User was not found.');
  const limit = leafletCreationLimitForUser(user);
  if (!Number.isFinite(limit)) return { user, limit, used: 0 };
  const used = exportedLeafletUsageForUser(userId);
  if (used >= limit) {
    const label = leafletPlanLabel(user.subscription_plan);
    const err = httpError(403, `Exported leaflet limit reached. Your ${label} plan allows ${limit} exported ${limit === 1 ? 'leaflet' : 'leaflets'}. Upgrade your plan to export more leaflets.`);
    err.limitReached = true;
    err.usage = { used, limit, plan: normalizeSubscriptionPlan(user.subscription_plan) };
    throw err;
  }
  return { user, limit, used };
}

function parsePlanAmount(value) {
  const n = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const COUNTRY_TO_CURRENCY = {
  AE: 'AED', GB: 'GBP', UK: 'GBP', IN: 'INR', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', EG: 'EGP', MA: 'MAD',
  DZ: 'DZD', TN: 'TND', TR: 'TRY', EU: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR',
  NL: 'EUR', BE: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
  JP: 'JPY', CN: 'CNY', HK: 'HKD', SG: 'SGD', MY: 'MYR', TH: 'THB', PH: 'PHP', ID: 'IDR',
  KR: 'KRW', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', ZA: 'ZAR', NG: 'NGN', KE: 'KES',
  GH: 'GHS', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', CH: 'CHF',
  NO: 'NOK', SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN',
  IL: 'ILS',
};
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf',
]);
let usdRateCache = { fetchedAt: 0, rates: null };
const regionCountryCache = new Map();

function normalizeCountryCode(value) {
  const code = String(value || '').trim().slice(0, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

function countryFromLocale(locale) {
  const parts = String(locale || '').split(/[,;]/).map(v => v.trim()).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/[-_]([A-Za-z]{2})\b/);
    const country = normalizeCountryCode(match?.[1]);
    if (country) return country;
  }
  return '';
}

function detectCheckoutCountry(req, bodyCountry) {
  return normalizeCountryCode(req.headers['cf-ipcountry'])
    || normalizeCountryCode(req.headers['x-vercel-ip-country'])
    || normalizeCountryCode(req.headers['cloudfront-viewer-country'])
    || normalizeCountryCode(req.headers['x-country-code'])
    || normalizeCountryCode(req.headers['x-user-country'])
    || normalizeCountryCode(bodyCountry);
}

function normalizeClientIp(value) {
  let ip = String(value || '').trim();
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  ip = ip.replace(/^\[/, '').replace(/\]$/, '');
  if (ip.includes(':') && ip.includes('.')) ip = ip.split(':').pop();
  return net.isIP(ip) ? ip : '';
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '::1') return true;
  if (ip.includes(':')) {
    return /^(fc|fd|fe80):/i.test(ip);
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127)
    || a === 0;
}

function requestClientIp(req) {
  const candidates = [
    req.headers['cf-connecting-ip'],
    req.headers['true-client-ip'],
    req.headers['x-real-ip'],
    req.headers['x-client-ip'],
    req.headers['x-forwarded-for'],
    req.ip,
    req.socket?.remoteAddress,
  ].flatMap(value => String(value || '').split(','));

  for (const value of candidates) {
    const ip = normalizeClientIp(value);
    if (ip && !isPrivateIp(ip)) return ip;
  }
  return '';
}

async function countryFromClientIp(ip) {
  if (!ip) return '';
  const cached = regionCountryCache.get(ip);
  if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached.countryCode;
  try {
    const data = await httpsGet(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`);
    const countryCode = data?.success === false ? '' : normalizeCountryCode(data?.country_code);
    regionCountryCache.set(ip, { fetchedAt: Date.now(), countryCode });
    return countryCode;
  } catch (err) {
    console.warn('[region-country] lookup failed', err?.message || err);
    return '';
  }
}

async function detectRequestCountry(req, bodyCountry) {
  return detectCheckoutCountry(req, bodyCountry)
    || await countryFromClientIp(requestClientIp(req));
}

function authPayloadFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token ? String(req.query.token) : null);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.sid) {
      const session = db.prepare(`
        SELECT id
        FROM user_sessions
        WHERE user_id = ?
          AND session_id = ?
          AND revoked_at IS NULL
          AND datetime(expires_at) > datetime('now')
      `).get(payload.id, payload.sid);
      if (!session) return null;
      db.prepare("UPDATE user_sessions SET last_seen_at = datetime('now') WHERE id = ?").run(session.id);
    }
    return payload;
  } catch {
    return null;
  }
}

async function getUsdExchangeRates() {
  const sixHours = 6 * 60 * 60 * 1000;
  if (usdRateCache.rates && Date.now() - usdRateCache.fetchedAt < sixHours) return usdRateCache.rates;
  const data = await httpsGet('https://open.er-api.com/v6/latest/USD');
  if (!data?.rates || typeof data.rates !== 'object') throw new Error('Exchange-rate lookup failed.');
  usdRateCache = { fetchedAt: Date.now(), rates: data.rates };
  return usdRateCache.rates;
}

function toStripeMinorUnit(amountMajor, currency) {
  const code = currency.toLowerCase();
  return Math.max(1, Math.round(amountMajor * (STRIPE_ZERO_DECIMAL_CURRENCIES.has(code) ? 1 : 100)));
}

function fromStripeMinorUnit(amountMinor, currency) {
  const code = String(currency || '').toLowerCase();
  return amountMinor / (STRIPE_ZERO_DECIMAL_CURRENCIES.has(code) ? 1 : 100);
}

async function localizeCheckoutPrice(usdAmountCents, countryCode) {
  const currency = COUNTRY_TO_CURRENCY[countryCode] || 'USD';
  if (currency === 'USD') return null;
  const rates = await getUsdExchangeRates();
  const rate = Number(rates[currency]);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const usdMajor = usdAmountCents / 100;
  return {
    currency: currency.toLowerCase(),
    unitAmount: toStripeMinorUnit(usdMajor * rate, currency),
    rate,
    country: countryCode,
  };
}

async function quoteLocalizedPlanPrice(basePrice, countryCode) {
  let currency = basePrice.currency || 'usd';
  let unitAmount = basePrice.unitAmount;
  let localized = null;
  try {
    localized = await localizeCheckoutPrice(basePrice.unitAmount, countryCode);
  } catch (err) {
    console.warn('[stripe-localized-pricing] falling back to USD:', err instanceof Error ? err.message : err);
  }
  if (localized) {
    currency = localized.currency;
    unitAmount = localized.unitAmount;
  }
  return {
    currency: currency.toUpperCase(),
    amount: fromStripeMinorUnit(unitAmount, currency),
    unitAmount,
  };
}

function getCheckoutPlanPrice(plan, period) {
  const fallback = DEFAULT_STRIPE_PLAN_PRICES[plan];
  const row = db.prepare(
    "SELECT value FROM page_content WHERE page='pricing' AND section='plans' AND field='items'"
  ).get();
  let planDef = null;
  if (row?.value) {
    try {
      const plans = JSON.parse(row.value);
      if (Array.isArray(plans)) planDef = plans.find(p => p?.id === plan || p?.checkoutPlanId === plan) || null;
    } catch {}
  }
  const source = planDef || fallback;
  const monthlyRate = parsePlanAmount(period === 'annual' ? source?.yearlyPrice : source?.monthlyPrice);
  const annualTotal = parsePlanAmount(source?.annualPrice);
  if (!monthlyRate && !(period === 'annual' && annualTotal)) return null;
  const unitAmount = period === 'annual'
    ? Math.round((annualTotal || monthlyRate * 12) * 100)
    : Math.round(monthlyRate * 100);
  return {
    name: source?.name || fallback?.name || plan,
    unitAmount,
    currency: 'usd',
  };
}

function resolveStripePlanFromPriceId(priceId) {
  if (!priceId) return null;
  const mapped = db.prepare(`
    SELECT plan, period FROM stripe_plan_prices
    WHERE stripe_price_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(priceId);
  if (mapped) return { plan: mapped.plan, period: mapped.period };
  const legacy = {
    [STRIPE_PRO_MONTHLY_PRICE_ID]:  { plan: 'pro',      period: 'monthly' },
    [STRIPE_PRO_ANNUAL_PRICE_ID]:   { plan: 'pro',      period: 'annual'  },
    [STRIPE_BIZ_MONTHLY_PRICE_ID]:  { plan: 'business', period: 'monthly' },
    [STRIPE_BIZ_ANNUAL_PRICE_ID]:   { plan: 'business', period: 'annual'  },
  };
  return legacy[priceId] || null;
}

function getActiveStripePrice(plan, period) {
  return db.prepare(`
    SELECT * FROM stripe_plan_prices
    WHERE plan = ? AND period = ? AND active = 1
    ORDER BY id DESC LIMIT 1
  `).get(plan, period);
}

function getReusableStripeProductId(plan) {
  const row = db.prepare(`
    SELECT stripe_product_id FROM stripe_plan_prices
    WHERE plan = ? AND stripe_product_id <> ''
    ORDER BY active DESC, id DESC LIMIT 1
  `).get(plan);
  return row?.stripe_product_id || null;
}

function getPricingDefinitionsFromPlansValue(rawValue) {
  const plans = JSON.parse(rawValue || '[]');
  if (!Array.isArray(plans)) throw new Error('Pricing plans must be a JSON array.');
  const defs = [];
  for (const plan of ['starter', 'pro', 'business']) {
    const source = plans.find(p => p?.id === plan || p?.checkoutPlanId === plan) || DEFAULT_STRIPE_PLAN_PRICES[plan];
    const name = source?.name || DEFAULT_STRIPE_PLAN_PRICES[plan].name;
    const monthly = parsePlanAmount(source?.monthlyPrice);
    const annualMonthly = parsePlanAmount(source?.yearlyPrice);
    const annualTotal = parsePlanAmount(source?.annualPrice);
    if (!monthly) throw new Error(`Monthly price for ${name} is missing or invalid.`);
    if (!annualMonthly) throw new Error(`Yearly price for ${name} is missing or invalid.`);
    defs.push({ plan, period: 'monthly', name, amountCents: Math.round(monthly * 100), currency: 'usd', interval: 'month' });
    defs.push({ plan, period: 'annual',  name, amountCents: Math.round((annualTotal || annualMonthly * 12) * 100), currency: 'usd', interval: 'year' });
  }
  return defs;
}

function syncPlanPriceSettingsToPricingContent(settings) {
  const row = db.prepare(
    "SELECT value FROM page_content WHERE page='pricing' AND section='plans' AND field='items'"
  ).get();
  let plans = DEFAULT_PRICING_PLANS;
  try {
    const parsed = JSON.parse(row?.value || '[]');
    if (Array.isArray(parsed) && parsed.length) plans = parsed;
  } catch {}

  const nextPlans = plans.map(plan => {
    const planId = String(plan?.id || plan?.checkoutPlanId || '').trim().toLowerCase();
    const keys = PLAN_PRICE_SETTING_MAP[planId];
    if (!keys) return plan;

    const monthly = parsePlanAmount(settings[keys.monthly]);
    const annual = parsePlanAmount(settings[keys.annual]);
    const next = { ...plan };
    if (monthly !== null) next.monthlyPrice = monthly;
    if (annual !== null) {
      next.annualPrice = annual;
      next.yearlyPrice = annual / 12;
      if (annual > 0 && next.annualPriceLabel) delete next.annualPriceLabel;
    }
    return next;
  });

  const value = JSON.stringify(nextPlans);
  db.prepare(`
    INSERT INTO page_content (page, section, field, value)
    VALUES ('pricing', 'plans', 'items', ?)
    ON CONFLICT(page, section, field) DO UPDATE SET value = excluded.value
  `).run(value);
  return value;
}

function pricingSettingsFromPricingContent() {
  const row = db.prepare(
    "SELECT value FROM page_content WHERE page='pricing' AND section='plans' AND field='items'"
  ).get();
  let plans = DEFAULT_PRICING_PLANS;
  try {
    const parsed = JSON.parse(row?.value || '[]');
    if (Array.isArray(parsed) && parsed.length) plans = parsed;
  } catch {}

  const settings = {};
  for (const plan of plans) {
    const planId = String(plan?.id || plan?.checkoutPlanId || '').trim().toLowerCase();
    const keys = PLAN_PRICE_SETTING_MAP[planId];
    if (!keys) continue;
    const monthly = parsePlanAmount(plan?.monthlyPrice);
    const annual = parsePlanAmount(plan?.annualPrice);
    if (monthly !== null) settings[keys.monthly] = monthly.toFixed(2);
    if (annual !== null) settings[keys.annual] = annual.toFixed(2);
  }
  return settings;
}

async function updateSubscriptionsToStripePrice(oldPriceId, newPriceId, plan, period) {
  if (!oldPriceId || oldPriceId === newPriceId) return 0;
  let updated = 0;
  await stripe.subscriptions.list({ price: oldPriceId, status: 'all', limit: 100 }).autoPagingEach(async sub => {
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) return;
    const item = sub.items?.data?.find(i => i.price?.id === oldPriceId);
    if (!item) return;
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: newPriceId, quantity: item.quantity || 1 }],
      proration_behavior: 'none',
      metadata: { ...(sub.metadata || {}), plan, period },
    });
    updated += 1;
  });
  return updated;
}

async function syncStripePricingFromPlansValue(rawValue) {
  if (!stripe) throw new Error('Stripe is not configured. Pricing changes were not saved because Stripe price sync is required.');
  const defs = getPricingDefinitionsFromPlansValue(rawValue);
  const synced = [];

  for (const def of defs) {
    const current = getActiveStripePrice(def.plan, def.period);
    if (
      current &&
      current.amount_cents === def.amountCents &&
      current.currency === def.currency &&
      current.stripe_price_id
    ) {
      synced.push({ ...def, stripePriceId: current.stripe_price_id, changed: false, subscriptionsUpdated: 0 });
      continue;
    }

    let productId = current?.stripe_product_id || getReusableStripeProductId(def.plan);
    if (!productId) {
      const product = await stripe.products.create({
        name: `${def.name} plan`,
        metadata: { plan: def.plan },
      });
      productId = product.id;
    } else {
      await stripe.products.update(productId, {
        name: `${def.name} plan`,
        metadata: { plan: def.plan },
      });
    }

    const price = await stripe.prices.create({
      product: productId,
      currency: def.currency,
      unit_amount: def.amountCents,
      recurring: { interval: def.interval },
      metadata: { plan: def.plan, period: def.period },
    });

    const subscriptionsUpdated = await updateSubscriptionsToStripePrice(
      current?.stripe_price_id,
      price.id,
      def.plan,
      def.period,
    );

    const saveMapping = db.transaction(() => {
      db.prepare(`
        UPDATE stripe_plan_prices
        SET active = 0, updated_at = datetime('now')
        WHERE plan = ? AND period = ? AND active = 1
      `).run(def.plan, def.period);
      db.prepare(`
        INSERT INTO stripe_plan_prices
          (plan, period, amount_cents, currency, stripe_product_id, stripe_price_id, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).run(def.plan, def.period, def.amountCents, def.currency, productId, price.id);
    });
    saveMapping();
    synced.push({ ...def, stripePriceId: price.id, changed: true, subscriptionsUpdated });
  }

  return synced;
}

/* ── Migrations tracking table ── */
db.exec(`CREATE TABLE IF NOT EXISTS db_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
function hasMigration(name) { return !!db.prepare('SELECT 1 FROM db_migrations WHERE name = ?').get(name); }
function markMigration(name) { db.prepare("INSERT OR IGNORE INTO db_migrations (name) VALUES (?)").run(name); }

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    verify_token_expires TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    user_agent TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE TABLE IF NOT EXISTS leaflets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    language_mode TEXT NOT NULL DEFAULT 'one',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS leaflet_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leaflet_id INTEGER NOT NULL REFERENCES leaflets(id),
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
    old_price REAL,
    current_price REAL
  );
  CREATE TABLE IF NOT EXISTS product_clicks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES leaflet_products(id) ON DELETE CASCADE,
    leaflet_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    clicked_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS stripe_plan_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan TEXT NOT NULL,
    period TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    stripe_product_id TEXT NOT NULL DEFAULT '',
    stripe_price_id TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS leaflet_pdf_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leaflet_id INTEGER NOT NULL REFERENCES leaflets(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    share_token TEXT NOT NULL DEFAULT '',
    allow_edit INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ai_cover_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leaflet_id INTEGER NOT NULL REFERENCES leaflets(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );
`);

/* ── Migrate: add origin ISO columns if missing ── */
function ensureProductColumn(name, definition) {
  const cols = db.pragma('table_info(leaflet_products)').map(c => c.name);
  if (!cols.includes(name)) db.exec(`ALTER TABLE leaflet_products ADD COLUMN ${name} ${definition}`);
}
ensureProductColumn('origin_lan1_iso', "TEXT NOT NULL DEFAULT ''");
ensureProductColumn('origin_lan2_iso', "TEXT NOT NULL DEFAULT ''");
ensureProductColumn('product_image_source', "TEXT NOT NULL DEFAULT ''");
ensureProductColumn('product_image_license', "TEXT NOT NULL DEFAULT ''");

/* ── Migrate: add layout_json to leaflets if missing ── */
const leafletCols = db.pragma('table_info(leaflets)').map(c => c.name);
if (!leafletCols.includes('layout_json')) {
  db.exec("ALTER TABLE leaflets ADD COLUMN layout_json TEXT");
}
if (!leafletCols.includes('thumbnail')) {
  db.exec("ALTER TABLE leaflets ADD COLUMN thumbnail TEXT");
}
if (!leafletCols.includes('quota_counted')) {
  db.exec("ALTER TABLE leaflets ADD COLUMN quota_counted INTEGER NOT NULL DEFAULT 0");
}
if (!leafletCols.includes('first_exported_at')) {
  db.exec("ALTER TABLE leaflets ADD COLUMN first_exported_at TEXT");
}
db.exec(`
  UPDATE leaflets
  SET quota_counted = 1,
      first_exported_at = COALESCE(first_exported_at, (
        SELECT MIN(created_at) FROM leaflet_pdf_exports WHERE leaflet_id = leaflets.id
      ))
  WHERE quota_counted = 0
    AND EXISTS (SELECT 1 FROM leaflet_pdf_exports WHERE leaflet_id = leaflets.id)
`);

/* ── Migrate: enable origin flags on all existing leaflets (one-time) ── */
if (!hasMigration('origin_flag_default_v1')) {
  try {
    db.exec(`
      UPDATE leaflets
      SET layout_json = json_set(layout_json, '$.show_origin_lan1_flag', json('true'), '$.show_origin_lan2_flag', json('true'))
      WHERE layout_json IS NOT NULL
        AND (json_extract(layout_json, '$.show_origin_lan1_flag') = 0
          OR json_extract(layout_json, '$.show_origin_lan2_flag') = 0)
    `);
    markMigration('origin_flag_default_v1');
  } catch (_) { /* ignore malformed JSON rows */ }
}

/* ── Card layout templates table ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS card_layout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    layout_json TEXT NOT NULL,
    is_platform INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
const cardTemplateCols = db.pragma('table_info(card_layout_templates)').map(c => c.name);
if (!cardTemplateCols.includes('is_platform')) {
  db.exec("ALTER TABLE card_layout_templates ADD COLUMN is_platform INTEGER NOT NULL DEFAULT 0");
}
const pdfExportCols = db.pragma('table_info(leaflet_pdf_exports)').map(c => c.name);
if (!pdfExportCols.includes('share_token')) {
  db.exec("ALTER TABLE leaflet_pdf_exports ADD COLUMN share_token TEXT NOT NULL DEFAULT ''");
}
if (!pdfExportCols.includes('allow_edit')) {
  db.exec("ALTER TABLE leaflet_pdf_exports ADD COLUMN allow_edit INTEGER NOT NULL DEFAULT 0");
}
if (!pdfExportCols.includes('export_type')) {
  db.exec("ALTER TABLE leaflet_pdf_exports ADD COLUMN export_type TEXT NOT NULL DEFAULT 'pdf'");
}
if (!pdfExportCols.includes('country_code')) {
  db.exec("ALTER TABLE leaflet_pdf_exports ADD COLUMN country_code TEXT NOT NULL DEFAULT ''");
}
if (!pdfExportCols.includes('country_name')) {
  db.exec("ALTER TABLE leaflet_pdf_exports ADD COLUMN country_name TEXT NOT NULL DEFAULT ''");
}
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, revoked_at, expires_at);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_sid ON user_sessions(session_id);
  CREATE INDEX IF NOT EXISTS idx_stripe_plan_prices_lookup ON stripe_plan_prices(plan, period, active);
  CREATE INDEX IF NOT EXISTS idx_stripe_plan_prices_price_id ON stripe_plan_prices(stripe_price_id);
  CREATE INDEX IF NOT EXISTS idx_ai_cover_generations_usage ON ai_cover_generations(user_id, leaflet_id, status);
  CREATE INDEX IF NOT EXISTS idx_leaflets_export_quota ON leaflets(user_id, quota_counted);
  CREATE INDEX IF NOT EXISTS idx_leaflet_pdf_exports_store ON leaflet_pdf_exports(user_id, export_type, country_code, created_at);
  CREATE INDEX IF NOT EXISTS idx_leaflet_pdf_exports_public_store ON leaflet_pdf_exports(export_type, country_code, created_at);
`);

const PLATFORM_DEFAULT_TEMPLATE_NAMES = Array.from({ length: 7 }, (_, i) => `Template ${i + 1}`);
const PLATFORM_DEFAULT_TEMPLATE_ORDER_SQL = PLATFORM_DEFAULT_TEMPLATE_NAMES
  .map((name, i) => `WHEN lower(name) = '${name.toLowerCase()}' THEN ${i + 1}`)
  .join(' ');
const PRIMARY_ADMIN_EMAIL = 'ziad.jarbou@gmail.com';
function isAdminUser(userId) {
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return String(row?.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
function isUnlimitedUser(user) {
  return String(user?.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

if (!hasMigration('platform_default_card_templates_v1')) {
  const normalizeDefaultTemplateNames = db.transaction(() => {
    for (const name of PLATFORM_DEFAULT_TEMPLATE_NAMES) {
      db.prepare('UPDATE card_layout_templates SET name = ? WHERE lower(name) = ?').run(name, name.toLowerCase());
    }
  });
  normalizeDefaultTemplateNames();
  markMigration('platform_default_card_templates_v1');
}

/* ── Migrate: subscription fields ── */
const userCols = db.pragma('table_info(users)').map(c => c.name);
if (!userCols.includes('stripe_customer_id'))  db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
if (!userCols.includes('subscription_plan'))   db.exec("ALTER TABLE users ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'free'");
if (!userCols.includes('subscription_status')) db.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active'");
if (!userCols.includes('subscription_period')) db.exec("ALTER TABLE users ADD COLUMN subscription_period TEXT NOT NULL DEFAULT 'monthly'");
if (!userCols.includes('subscription_start'))  db.exec("ALTER TABLE users ADD COLUMN subscription_start TEXT");
if (!userCols.includes('subscription_end'))    db.exec("ALTER TABLE users ADD COLUMN subscription_end TEXT");
if (!userCols.includes('subscription_email_key')) db.exec("ALTER TABLE users ADD COLUMN subscription_email_key TEXT");
if (!userCols.includes('subscription_expired_plan')) db.exec("ALTER TABLE users ADD COLUMN subscription_expired_plan TEXT");
if (!userCols.includes('subscription_expired_period')) db.exec("ALTER TABLE users ADD COLUMN subscription_expired_period TEXT");
if (!userCols.includes('subscription_expired_end')) db.exec("ALTER TABLE users ADD COLUMN subscription_expired_end TEXT");
if (!userCols.includes('subscription_expiry_notice_count')) db.exec("ALTER TABLE users ADD COLUMN subscription_expiry_notice_count INTEGER NOT NULL DEFAULT 0");
if (!userCols.includes('subscription_expiry_notice_last_sent')) db.exec("ALTER TABLE users ADD COLUMN subscription_expiry_notice_last_sent TEXT");
if (!userCols.includes('exported_leaflets_used')) db.exec("ALTER TABLE users ADD COLUMN exported_leaflets_used INTEGER NOT NULL DEFAULT 0");
if (!userCols.includes('role'))                db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
if (!hasMigration('exported_leaflet_usage_counter_v1')) {
  db.exec(`
    UPDATE users
    SET exported_leaflets_used = (
      SELECT COUNT(*) FROM leaflets
      WHERE leaflets.user_id = users.id
        AND leaflets.quota_counted = 1
    )
  `);
  markMigration('exported_leaflet_usage_counter_v1');
}
db.prepare(`
  UPDATE users
  SET subscription_start = COALESCE(
    subscription_start,
    CASE
      WHEN subscription_end IS NOT NULL AND subscription_period = 'annual' THEN datetime(subscription_end, '-1 year')
      WHEN subscription_end IS NOT NULL THEN datetime(subscription_end, '-1 month')
      ELSE created_at
    END
  )
  WHERE subscription_plan <> 'free'
`).run();
db.prepare("UPDATE users SET role = CASE WHEN lower(email) = lower(?) THEN 'admin' ELSE 'user' END").run(PRIMARY_ADMIN_EMAIL);
db.prepare(`
  UPDATE users
  SET subscription_plan = 'admin',
      subscription_status = 'active',
      subscription_period = 'monthly',
      subscription_end = NULL
  WHERE lower(email) = lower(?)
`).run(PRIMARY_ADMIN_EMAIL);

// one-time free exports
try { db.prepare("ALTER TABLE users ADD COLUMN free_pdf_used INTEGER DEFAULT 0").run(); } catch(e) {}
try { db.prepare("ALTER TABLE users ADD COLUMN free_book_used INTEGER DEFAULT 0").run(); } catch(e) {}

// default leaflet
try { db.prepare("ALTER TABLE users ADD COLUMN default_leaflet_id INTEGER DEFAULT NULL").run(); } catch(e) {}

// help center tables
db.exec(`
  CREATE TABLE IF NOT EXISTS help_article_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    icon       TEXT    NOT NULL DEFAULT '📄',
    label      TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS help_articles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL REFERENCES help_article_groups(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL,
    desc       TEXT    NOT NULL DEFAULT '',
    content    TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS icon_library (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    label      TEXT    NOT NULL,
    url        TEXT    NOT NULL,
    active     INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS icon_preset_overrides (
    icon_key   TEXT PRIMARY KEY,
    label      TEXT,
    active     INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted    INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ── SEO pages table ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS seo_pages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    page_key      TEXT NOT NULL UNIQUE,
    page_name     TEXT NOT NULL,
    page_path     TEXT NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    keywords      TEXT NOT NULL DEFAULT '',
    og_title      TEXT NOT NULL DEFAULT '',
    og_description TEXT NOT NULL DEFAULT '',
    og_image      TEXT NOT NULL DEFAULT '',
    canonical_url TEXT NOT NULL DEFAULT '',
    robots        TEXT NOT NULL DEFAULT 'index, follow',
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/* Seed default pages (INSERT OR IGNORE keeps existing edits) */
const seoDefaults = [
  { key:'home',            name:'Home Page',           path:'/',                   title:'LeafletAI — Create Leaflets That Sell', description:'Design and publish professional product leaflets in minutes with AI-powered tools.' },
  { key:'why',             name:'Why Us',              path:'/why',                title:'Why Choose LeafletAI',                   description:'Discover why thousands of businesses trust LeafletAI for their product catalogs.' },
  { key:'features',        name:'Features',            path:'/features',           title:'Features — LeafletAI',                   description:'Explore all the powerful features LeafletAI offers to create stunning product leaflets.' },
  { key:'faq',             name:'FAQ',                 path:'/faq',                title:'FAQ — LeafletAI',                         description:'Frequently asked questions about LeafletAI plans, features, and usage.' },
  { key:'pricing',         name:'Pricing',             path:'/pricing',            title:'Pricing — LeafletAI',                    description:'Simple and transparent pricing plans for individuals and teams.' },
  { key:'dashboard',       name:'Dashboard',           path:'/dashboard',          title:'Dashboard — LeafletAI',                  description:'Manage all your leaflets, track performance and insights from your dashboard.' },
  { key:'create_leaflet',  name:'Create Leaflet',      path:'/create-leaflet',     title:'Create a New Leaflet — LeafletAI',       description:'Build a professional product leaflet by uploading your product catalog.' },
  { key:'my_leaflets',     name:'My Leaflets',         path:'/my-leaflets',        title:'My Leaflets — LeafletAI',                description:'View and manage all your created leaflets in one place.' },
  { key:'settings',        name:'Settings',            path:'/settings',           title:'Account Settings — LeafletAI',           description:'Manage your account settings, subscription and preferences.' },
  { key:'leaflet_view',    name:'Leaflet Viewer',      path:'/app/leaflet/:id',    title:'View Leaflet — LeafletAI',               description:'View and share this interactive product leaflet.' },
  { key:'payment_success', name:'Payment Success',     path:'/payment/success',    title:'Payment Successful — LeafletAI',         description:'Your subscription has been activated successfully.' },
  { key:'forgot_password', name:'Forgot Password',     path:'/forgot-password',    title:'Reset Password — LeafletAI',             description:'Reset your LeafletAI account password.' },
];
const insSeo = db.prepare(`INSERT OR IGNORE INTO seo_pages (page_key,page_name,page_path,title,description,keywords,og_title,og_description,og_image,canonical_url,robots)
  VALUES (@key,@name,@path,@title,@description,'','','','','','index, follow')`);
if (shouldSeedDefaultContent()) {
  for (const r of seoDefaults) insSeo.run(r);
}
db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);
/* seed defaults */
const settingDefaults = {
  site_name: 'Leaflet Store',
  maintenance_mode: '0',
  allow_signups: '1',
  max_leaflets_free: '3',
  max_leaflets_starter: '5',
  max_leaflets_pro: '25',
  max_leaflets_business: '100',
  max_leaflets_agency: '1000',
  concurrent_logins_free: '1',
  concurrent_logins_starter: '2',
  concurrent_logins_pro: '3',
  concurrent_logins_business: '5',
  concurrent_logins_agency: '10',
  free_pdf_export_limit: '1',
  ai_cover_generations_free: '1',
  ai_cover_generations_starter: '2',
  ai_cover_generations_pro: '4',
  ai_cover_generations_business: '6',
  ai_cover_generations_agency: '10',
  plan_price_starter_monthly: '13.34',
  plan_price_starter_annual: '133.42',
  plan_price_pro_monthly: '26.96',
  plan_price_pro_annual: '269.57',
  plan_price_business_monthly: '67.80',
  plan_price_business_annual: '677.99',
  plan_price_agency_monthly: '163.10',
  plan_price_agency_annual: '',
  support_email: '',
  announcement_banner: '',
  stripe_secret_key: '',
  stripe_checkout_url: '',
  openai_api_key: '',
  default_card_template_id: '',
  nano_a4_enabled: '1',
  home_demo_video_url: '',
  help_video_1_url: '',
  help_video_2_url: '',
  help_video_3_url: '',
  help_video_4_url: '',
  help_video_5_url: '',
  help_video_6_url: '',
};
const insertSetting = db.prepare(`INSERT OR IGNORE INTO site_settings (key,value) VALUES (?,?)`);
if (shouldSeedDefaultContent()) {
  for (const [k,v] of Object.entries(settingDefaults)) insertSetting.run(k,v);
}

function stripeSecretKeyValue() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'stripe_secret_key'").get();
  return String(row?.value || '').trim() || STRIPE_SECRET_KEY;
}

function refreshStripeClient() {
  const secretKey = stripeSecretKeyValue();
  stripe = secretKey ? new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' }) : null;
}

refreshStripeClient();

function openAiApiKeyValue() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'openai_api_key'").get();
  return String(row?.value || '').trim() || OPENAI_API_KEY;
}

/* ── Page Content table ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS page_content (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    page    TEXT NOT NULL,
    section TEXT NOT NULL,
    field   TEXT NOT NULL,
    value   TEXT NOT NULL DEFAULT '',
    UNIQUE(page, section, field)
  );
`);

/* Seed page content defaults (INSERT OR IGNORE keeps existing edits) */
const insPC = db.prepare(`INSERT OR IGNORE INTO page_content (page,section,field,value) VALUES (?,?,?,?)`);
const pcDefaults = [
  /* HOME — hero */
  ['home','hero','title',        "Design leaflets that captivate.\nBuild stores that convert. Export PDFs instantly."],
  ['home','hero','subtitle',     "Create, publish, and sell professional leaflets — no skills required, no time wasted. Import PDFs, customize freely, link products, and export ready-to-share PDFs in minutes."],
  ['home','hero','cta_label',    "Create Leaflets That Sell"],
  ['home','hero','cta_link',     "/create-leaflet"],
  ['home','hero','demo_label',   "Watch Demo (60 sec)"],
  ['home','hero','proof_text',   "Trusted by 5,000+ creators, designers & businesses worldwide"],
  ['home','hero','visible',      "1"],
  /* HOME — features section */
  ['home','features','section_title',    "Feature highlights"],
  ['home','features','section_subtitle', "Everything you need to create premium leaflets and publish store-ready experiences — without the complexity."],
  ['home','features','cta_label',        "Start Building for Free"],
  ['home','features','visible',          "1"],
  ['home','features','items',            JSON.stringify([
    { ic:'⚡', title:'Easy Import',         desc:'Import PDFs in seconds — keep quality, skip complexity.' },
    { ic:'🧠', title:'Effortless Builder',  desc:'No design skills? No problem. It just works.' },
    { ic:'🧩', title:'Templates Library',   desc:'Pre-built layouts crafted for high conversion.' },
    { ic:'✨', title:'Interactive Leaflets', desc:'Turn static files into engaging digital experiences.' },
    { ic:'🛠️', title:'Full Customization',  desc:'Edit colors, fonts & layouts — make it uniquely yours.' },
    { ic:'🛒', title:'Product Linking',     desc:'Connect leaflets directly to your product pages.' },
  ])],
  /* HOME — pricing section */
  ['home','pricing','section_title',    "Pricing that scales with your ambition"],
  ['home','pricing','section_subtitle', "Start small, grow fast — switch to yearly and save more."],
  ['home','pricing','visible',          "1"],
  ['home','pricing','plans', JSON.stringify([
    { name:'Starter',      desc:'Perfect for personal projects & quick sharing.',    price:'$16', period:'/mo', save:'$192 billed annually — save $228', features:['Concurrent logins: 2 devices','5 flipbooks','Basic templates','Share links & QR codes','Export to PDF'] },
    { name:'Professional', desc:'Everything you need to create like a pro.',         price:'$16', period:'/mo', save:'$192 billed annually — save $228', features:['Concurrent logins: 3 devices','5 flipbooks','Full templates library','Customization controls','Export to PDF'] },
    { name:'Business',     desc:'Built for selling & growth.',                       price:'$16', period:'/mo', save:'$192 billed annually — save $228', features:['Concurrent logins: 5 devices','5 flipbooks','Unlimited product links','Priority support','Export to PDF'], best:true, badge:'Best Value — Save 20% + Priority support' },
    { name:'Enterprise',   desc:'Scale, control & dedicated support.',               price:'Custom', period:'', save:"Let's tailor a plan for your team", features:['Multi-user access','Advanced store limits','Dedicated support','Security & compliance options','Custom onboarding'] },
  ])],
  /* HOME — faq section */
  ['home','faq','section_title',    "Frequently asked questions"],
  ['home','faq','section_subtitle', "Quick answers to reduce friction and help you launch faster."],
  ['home','faq','visible',          "1"],
  ['home','faq','items', JSON.stringify([
    { q:'Do I need design skills?',              a:'No — use templates or start from your PDF and edit visually in minutes.' },
    { q:'Can I link products inside the leaflet?', a:'Yes — add clickable links to product pages and track better conversions.' },
    { q:'Can I export for print?',               a:'Absolutely — export print-ready PDFs anytime, optimized for sharing and printing.' },
    { q:'Is it good for creators and stores?',   a:"Yes — it's designed for creators who want conversion-focused leaflets and a store-like experience." },
  ])],
  /* FEATURES page */
  ['features','hero','title',    "Everything you need to create,\ncustomise, and publish leaflets"],
  ['features','hero','subtitle', "From a blank canvas to a polished, interactive flipbook — LeafletAI gives you every tool in one focused platform."],
  ['features','hero','cta_label','Start for free'],
  ['features','hero','visible',  "1"],
  /* PRIVACY */
  ['privacy','hero','title',  "Privacy Policy"],
  ['privacy','hero','visible',"1"],
  /* TERMS */
  ['terms','hero','title',  "Terms of Use"],
  ['terms','hero','visible',"1"],
  /* PRICING */
  ['pricing','hero','title',       "Simple, transparent pricing"],
  ['pricing','hero','subtitle',    "Start free. Upgrade when you're ready. No hidden fees, cancel anytime."],
  ['pricing','hero','visible',     "1"],
  ['pricing','plans','items', JSON.stringify(DEFAULT_PRICING_PLANS)],
  ['pricing','features','items', JSON.stringify(DEFAULT_PRICING_FEATURES)],
  ['pricing','annual','title',    "Annual Billing"],
  ['pricing','annual','subtitle', "Save up to 17% with annual billing. Get two months free when you pay annually."],
  ['pricing','annual','items',    JSON.stringify(DEFAULT_PRICING_ANNUAL_ITEMS)],
  ['pricing','annual','visible',  "1"],
  ['pricing','faq','items', JSON.stringify([
    { q:'Can I change plans at any time?',                     a:"Yes. You can upgrade or downgrade at any time. Changes take effect immediately and we'll prorate any charges." },
    { q:'Is there a free trial for paid plans?',               a:"Pro comes with a 14-day free trial — no credit card required. Business plans get a personalised demo." },
    { q:'What happens when I hit my leaflet limit?',           a:"You'll be prompted to upgrade. Existing leaflets remain fully accessible; you just can't create new ones until you upgrade or delete old ones." },
    { q:'Do you offer discounts for non-profits or education?',a:"Yes — contact us at sales@leafletai.com with proof of status and we'll apply a 40% discount." },
    { q:'What payment methods do you accept?',                 a:"We accept all major credit and debit cards via Stripe. Annual invoicing is available on Business plans." },
    { q:'Can I cancel anytime?',                               a:"Absolutely. Cancel from your account settings with one click. You keep access until the end of your billing period." },
  ])],
  ['pricing','banner','title',    "Ready to create stunning leaflets?"],
  ['pricing','banner','subtitle', "Join thousands of businesses already using LeafletAI."],
  ['pricing','banner','cta_label',"Get started free"],
  ['pricing','banner','visible',  "1"],
];
if (shouldSeedDefaultContent()) {
  for (const [page,section,field,value] of pcDefaults) insPC.run(page,section,field,value);
}

if (!hasMigration('pricing_tiers_2026_08_05_v1')) {
  const upsertPricingContent = db.prepare(`
    INSERT INTO page_content (page, section, field, value)
    VALUES ('pricing', ?, ?, ?)
    ON CONFLICT(page, section, field) DO UPDATE SET value = excluded.value
  `);
  const migratePricing = db.transaction(() => {
    upsertPricingContent.run('hero', 'title', "Simple, transparent pricing");
    upsertPricingContent.run('hero', 'subtitle', "Start free. Upgrade when you're ready. No hidden fees, cancel anytime.");
    upsertPricingContent.run('plans', 'items', JSON.stringify(DEFAULT_PRICING_PLANS));
    upsertPricingContent.run('features', 'items', JSON.stringify(DEFAULT_PRICING_FEATURES));
    upsertPricingContent.run('annual', 'title', 'Annual Billing');
    upsertPricingContent.run('annual', 'subtitle', 'Save up to 17% with annual billing. Get two months free when you pay annually.');
    upsertPricingContent.run('annual', 'items', JSON.stringify(DEFAULT_PRICING_ANNUAL_ITEMS));
    upsertPricingContent.run('annual', 'visible', '1');
    markMigration('pricing_tiers_2026_08_05_v1');
  });
  migratePricing();
}

if (!hasMigration('pricing_concurrent_logins_2026_08_24_v1')) {
  const loginFeatureByPlan = {
    free: 'Concurrent logins: 1 device',
    starter: 'Concurrent logins: 2 devices',
    pro: 'Concurrent logins: 3 devices',
    business: 'Concurrent logins: 5 devices',
    agency: 'Concurrent logins: 10+ devices',
  };
  const loginFeatureByName = {
    Starter: 'Concurrent logins: 2 devices',
    Professional: 'Concurrent logins: 3 devices',
    Business: 'Concurrent logins: 5 devices',
    Agency: 'Concurrent logins: 10+ devices',
  };
  const oldLoginFeatureRe = /\b(?:\d+\s+user|up to\s+\d+\s+team members|10 or more team members|concurrent logins?:|devices?)\b/i;
  const readContentJson = db.prepare('SELECT value FROM page_content WHERE page = ? AND section = ? AND field = ?');
  const writeContentJson = db.prepare(`
    INSERT INTO page_content (page, section, field, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(page, section, field) DO UPDATE SET value = excluded.value
  `);
  const migrateLoginPricing = db.transaction(() => {
    const plansRow = readContentJson.get('pricing', 'plans', 'items');
    let plans = DEFAULT_PRICING_PLANS;
    try {
      const parsed = JSON.parse(plansRow?.value || '[]');
      if (Array.isArray(parsed) && parsed.length) plans = parsed;
    } catch {}
    plans = plans.map(plan => {
      const loginFeature = loginFeatureByPlan[plan?.id] || loginFeatureByName[plan?.name];
      if (!loginFeature) return plan;
      const features = Array.isArray(plan.features) ? plan.features.filter(f => !oldLoginFeatureRe.test(String(f))) : [];
      return { ...plan, features: [...features, loginFeature] };
    });
    writeContentJson.run('pricing', 'plans', 'items', JSON.stringify(plans));

    writeContentJson.run('pricing', 'features', 'items', JSON.stringify(DEFAULT_PRICING_FEATURES));

    const homePlansRow = readContentJson.get('home', 'pricing', 'plans');
    if (homePlansRow?.value) {
      try {
        const homePlans = JSON.parse(homePlansRow.value);
        if (Array.isArray(homePlans)) {
          const nextHomePlans = homePlans.map(plan => {
            const loginFeature = loginFeatureByName[plan?.name];
            if (!loginFeature) return plan;
            const features = Array.isArray(plan.features) ? plan.features.filter(f => !oldLoginFeatureRe.test(String(f))) : [];
            return { ...plan, features: [loginFeature, ...features] };
          });
          writeContentJson.run('home', 'pricing', 'plans', JSON.stringify(nextHomePlans));
        }
      } catch {}
    }
    markMigration('pricing_concurrent_logins_2026_08_24_v1');
  });
  migrateLoginPricing();
}

const app = express();
app.set('trust proxy', true);
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-src 'self' https:",
      "media-src 'self' data: blob: https:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ')
  );
  next();
});
const appOrigin = (() => {
  try { return new URL(APP_URL).origin; } catch { return ''; }
})();
const configuredCorsOrigins = new Set(
  [
    appOrigin,
    'https://leafletai.ai',
    'https://www.leafletai.ai',
    ...String(process.env.CORS_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim().replace(/\/+$/, '')),
  ].filter(Boolean)
);
function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (configuredCorsOrigins.has(origin)) return true;
  if (/^https:\/\/([a-z0-9-]+\.)?leafletai\.ai$/i.test(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  return false;
}
app.use(cors({
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

/* ── Stripe webhook needs raw body — register BEFORE express.json ── */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) { res.status(503).json({ error: 'Stripe not configured' }); return; }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  /* helper: resolve plan + period from a Stripe price ID */
  function planFromPriceId(priceId) {
    return resolveStripePlanFromPriceId(priceId);
  }

  /* helper: ISO end-date string from unix timestamp */
  function toIso(ts) { return ts ? new Date(ts * 1000).toISOString() : null; }

  switch (event.type) {

    /* ── Payment confirmed / new subscription ── */
    case 'checkout.session.completed': {
      const session    = event.data.object;
      const userId     = session.metadata?.userId;
      let plan         = session.metadata?.plan;
      let period       = session.metadata?.period;
      const customerId = session.customer;
      let subscription = null;
      if (typeof session.subscription === 'string') {
        try {
          subscription = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ['items.data.price'],
          });
        } catch (err) {
          console.error('[webhook] checkout.session.completed subscription retrieve failed:', err instanceof Error ? err.message : err);
        }
      } else if (session.subscription && typeof session.subscription === 'object') {
        subscription = session.subscription;
      }
      const priceId = subscription?.items?.data?.[0]?.price?.id || '';
      const resolved = planFromPriceId(priceId) || (plan ? { plan, period: period || 'monthly' } : null);
      if (resolved) {
        plan = resolved.plan;
        period = resolved.period || 'monthly';
      }
      if (userId && plan) {
        const userIdNumber = parseInt(userId, 10);
        const status = subscription?.status === 'active' || subscription?.status === 'trialing'
          ? 'active'
          : (subscription?.status || 'active');
        const startDate = toIso(subscription?.current_period_start || subscription?.start_date || subscription?.created);
        const endDate = toIso(subscription?.current_period_end);
        db.prepare(`
          UPDATE users
          SET stripe_customer_id = COALESCE(?, stripe_customer_id),
              subscription_plan   = ?,
              subscription_status = ?,
              subscription_period = ?,
              subscription_start  = COALESCE(subscription_start, COALESCE(?, datetime('now'))),
              subscription_end    = COALESCE(?, subscription_end)
          WHERE id = ?
        `).run(customerId || null, plan, status, period || 'monthly', startDate, endDate, userIdNumber);
        resetSubscriptionExpiryNotices(userIdNumber);
        const paidUser = db.prepare('SELECT subscription_start, subscription_end FROM users WHERE id = ?').get(userIdNumber);
        sendSubscriptionDetailsEmail(userIdNumber, {
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : subscription?.id,
          plan,
          period: period || 'monthly',
          status,
          startDate: paidUser?.subscription_start || startDate,
          endDate: paidUser?.subscription_end || endDate,
        }).catch(err => console.error('[subscription-email] failed:', err instanceof Error ? err.message : err));
        console.log(`[webhook] checkout.session.completed — user ${userId} → ${plan}/${period}`);
      }
      break;
    }

    /* ── Subscription activated / renewed ── */
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub        = event.data.object;
      const customerId = sub.customer;
      const priceId    = sub.items?.data?.[0]?.price?.id;
      const resolved   = planFromPriceId(priceId) || (
        sub.metadata?.plan
          ? { plan: sub.metadata.plan, period: sub.metadata.period || 'monthly' }
          : null
      );
      const startDate  = toIso(sub.current_period_start || sub.start_date || sub.created);
      const endDate    = toIso(sub.current_period_end);

      if (resolved) {
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
        db.prepare(`
          UPDATE users
          SET subscription_plan   = ?,
              subscription_status = ?,
              subscription_period = ?,
              subscription_start  = COALESCE(subscription_start, ?),
              subscription_end    = ?
          WHERE stripe_customer_id = ?
        `).run(resolved.plan, status, resolved.period, startDate, endDate, customerId);
        const paidUser = db.prepare('SELECT id, subscription_start FROM users WHERE stripe_customer_id = ?').get(customerId);
        if (paidUser) {
          if (status === 'active') resetSubscriptionExpiryNotices(paidUser.id);
          sendSubscriptionDetailsEmail(paidUser.id, {
            subscriptionId: sub.id,
            plan: resolved.plan,
            period: resolved.period,
            status,
            startDate: paidUser.subscription_start || startDate,
            endDate,
          }).catch(err => console.error('[subscription-email] failed:', err instanceof Error ? err.message : err));
        }
        console.log(`[webhook] ${event.type} — customer ${customerId} → ${resolved.plan}/${resolved.period} status=${status}`);
      } else {
        /* status-only update (e.g. past_due, unpaid) */
        db.prepare(`
          UPDATE users SET subscription_status = ?, subscription_end = ?
          WHERE stripe_customer_id = ?
        `).run(sub.status, endDate, customerId);
        console.log(`[webhook] ${event.type} — customer ${customerId} status=${sub.status}`);
      }
      break;
    }

    /* ── Subscription cancelled / paused ── */
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused': {
      const sub        = event.data.object;
      const customerId = sub.customer;
      const status     = event.type === 'customer.subscription.paused' ? 'paused' : 'cancelled';
      const existingUser = db.prepare(`
        SELECT id,name,email,stripe_customer_id,subscription_plan,subscription_status,subscription_period,
               subscription_start,subscription_end
        FROM users WHERE stripe_customer_id = ?
      `).get(customerId);
      const resolved = resolveStripeSubscriptionPlan(sub);
      const endIso = toIso(sub.current_period_end) || existingUser?.subscription_end || new Date().toISOString();
      const endedAtOrBeforeNow = new Date(endIso).getTime() <= Date.now();
      const cancellationReason = String(sub.cancellation_details?.reason || '').toLowerCase();
      const shouldPromptPaymentUpdate = event.type === 'customer.subscription.deleted'
        && endedAtOrBeforeNow
        && cancellationReason !== 'cancellation_requested';
      db.prepare(`
        UPDATE users
        SET subscription_expired_plan = CASE WHEN ? THEN ? ELSE subscription_expired_plan END,
            subscription_expired_period = CASE WHEN ? THEN ? ELSE subscription_expired_period END,
            subscription_expired_end = CASE WHEN ? THEN ? ELSE subscription_expired_end END,
            subscription_plan   = 'free',
            subscription_status = ?,
            subscription_end    = ?
        WHERE stripe_customer_id = ?
      `).run(
        shouldPromptPaymentUpdate ? 1 : 0,
        normalizeSubscriptionPlan(resolved?.plan || existingUser?.subscription_plan || 'free'),
        shouldPromptPaymentUpdate ? 1 : 0,
        resolved?.period || existingUser?.subscription_period || 'monthly',
        shouldPromptPaymentUpdate ? 1 : 0,
        endIso,
        status,
        endIso,
        customerId,
      );
      if (shouldPromptPaymentUpdate && existingUser) {
        const reminderUser = db.prepare(`
          SELECT id,name,email,stripe_customer_id,subscription_plan,subscription_status,subscription_period,
                 subscription_start,subscription_end,subscription_expired_plan,subscription_expired_period,
                 subscription_expired_end,subscription_expiry_notice_count,subscription_expiry_notice_last_sent
          FROM users WHERE id = ?
        `).get(existingUser.id);
        sendSubscriptionPaymentUpdateEmail(reminderUser)
          .catch(err => console.error('[subscription-expiry-email] failed:', err instanceof Error ? err.message : err));
      }
      console.log(`[webhook] ${event.type} — customer ${customerId} downgraded to free`);
      break;
    }

    /* ── Payment failed / requires action ── */
    case 'invoice.payment_failed': {
      const inv        = event.data.object;
      const customerId = inv.customer;
      db.prepare(`
        UPDATE users SET subscription_status = 'past_due'
        WHERE stripe_customer_id = ?
      `).run(customerId);
      console.warn(`[webhook] invoice.payment_failed — customer ${customerId} marked past_due`);
      break;
    }

    /* ── Invoice paid (renewal) ── */
    case 'invoice.paid': {
      const inv        = event.data.object;
      const customerId = inv.customer;
      const paidUser = db.prepare(`
        SELECT id,name,email,stripe_customer_id,subscription_plan,subscription_status,subscription_period,
               subscription_start,subscription_end
        FROM users WHERE stripe_customer_id = ?
      `).get(customerId);
      const subscriptionId = typeof inv.subscription === 'string'
        ? inv.subscription
        : inv.subscription?.id;
      if (paidUser && subscriptionId && stripe) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price'],
          });
          await syncActiveStripeSubscriptionForUser(paidUser, sub, 'invoice-paid');
        } catch (err) {
          console.error('[webhook] invoice.paid subscription sync failed:', err instanceof Error ? err.message : err);
          db.prepare(`
            UPDATE users SET subscription_status = 'active'
            WHERE stripe_customer_id = ?
          `).run(customerId);
          resetSubscriptionExpiryNotices(paidUser.id);
        }
      } else {
        db.prepare(`
          UPDATE users SET subscription_status = 'active'
          WHERE stripe_customer_id = ?
        `).run(customerId);
        if (paidUser) resetSubscriptionExpiryNotices(paidUser.id);
      }
      console.log(`[webhook] invoice.paid — customer ${customerId} subscription renewed`);
      break;
    }

    default:
      console.log(`[webhook] unhandled event: ${event.type}`);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

/* ── Helpers ── */
function normalizeEmail(e) { return (e || '').trim().toLowerCase(); }
function normalizeName(n)  { return (n || '').trim().replace(/\s+/g, ' '); }
function makeToken()       { return crypto.randomBytes(32).toString('hex'); }
const SESSION_TTL_DAYS = 7;
const CONCURRENT_LOGIN_LIMITS = {
  free: 1,
  starter: 2,
  pro: 3,
  professional: 3,
  business: 5,
  agency: 10,
};
const CONCURRENT_LOGIN_SETTING_KEYS = {
  free: 'concurrent_logins_free',
  starter: 'concurrent_logins_starter',
  pro: 'concurrent_logins_pro',
  professional: 'concurrent_logins_pro',
  business: 'concurrent_logins_business',
  agency: 'concurrent_logins_agency',
};
const CONCURRENT_LOGIN_SETTING_KEY_SET = new Set(Object.values(CONCURRENT_LOGIN_SETTING_KEYS));
function sessionExpiresAt(from = Date.now()) {
  return new Date(from + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
function signJwt(user, sessionId) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role ?? 'user', ...(sessionId ? { sid: sessionId } : {}) },
    JWT_SECRET,
    { expiresIn: `${SESSION_TTL_DAYS}d` }
  );
}
function concurrentLoginLimitForUser(user) {
  if (isUnlimitedUser(user) || String(user?.role || '').toLowerCase() === 'admin') return Infinity;
  const plan = normalizeSubscriptionPlan(user?.subscription_plan);
  const fallback = CONCURRENT_LOGIN_LIMITS[plan] ?? CONCURRENT_LOGIN_LIMITS.free;
  const settingKey = CONCURRENT_LOGIN_SETTING_KEYS[plan];
  if (!settingKey) return fallback;
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(settingKey);
  const configured = Number.parseInt(String(row?.value || '').trim(), 10);
  return Number.isInteger(configured) && configured >= 1 ? configured : fallback;
}
function activeSessionCount(userId) {
  return db.prepare(`
    SELECT COUNT(*) AS count
    FROM user_sessions
    WHERE user_id = ?
      AND revoked_at IS NULL
      AND datetime(expires_at) > datetime('now')
  `).get(userId)?.count ?? 0;
}
function describeUserAgent(userAgent) {
  const ua = String(userAgent || '');
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Device';
  return `${browser} on ${os}`;
}
function listActiveSessions(userId) {
  return db.prepare(`
    SELECT session_id, user_agent, ip_address, created_at, last_seen_at, expires_at
    FROM user_sessions
    WHERE user_id = ?
      AND revoked_at IS NULL
      AND datetime(expires_at) > datetime('now')
    ORDER BY datetime(last_seen_at) DESC, datetime(created_at) DESC
  `).all(userId).map(row => ({
    id: row.session_id,
    device: describeUserAgent(row.user_agent),
    ip_address: row.ip_address || '',
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    expires_at: row.expires_at,
  }));
}
function createLoginSession(user, req) {
  db.prepare(`
    UPDATE user_sessions
    SET revoked_at = datetime('now')
    WHERE user_id = ?
      AND revoked_at IS NULL
      AND datetime(expires_at) <= datetime('now')
  `).run(user.id);
  const limit = concurrentLoginLimitForUser(user);
  const active = activeSessionCount(user.id);
  if (Number.isFinite(limit) && active >= limit) {
    const deviceLabel = limit === 1 ? '1 device' : `${limit} devices`;
    const planLabel = String(user.subscription_plan || 'free').trim().toLowerCase();
    const err = new Error(`Your ${planLabel} plan allows concurrent logins on ${deviceLabel}. Log out on another device or upgrade your plan.`);
    err.status = 403;
    err.authErrors = { general: err.message };
    err.deviceLimit = {
      plan: planLabel,
      limit,
      sessions: listActiveSessions(user.id),
      canChooseDevices: limit > 1,
    };
    throw err;
  }
  const sessionId = makeToken();
  db.prepare(`
    INSERT INTO user_sessions (user_id, session_id, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    user.id,
    sessionId,
    String(req.headers['user-agent'] || '').slice(0, 500),
    String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 120),
    sessionExpiresAt()
  );
  return sessionId;
}
function googleOAuthRedirectUri() {
  return `${APP_URL}/api/oauth/google/callback`;
}
function validatePasswordRules(password) {
  const errs = {};
  if (!password || password.length < 8) {
    errs.password = 'Password must be at least 8 characters.';
  } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    errs.password = 'Password must include uppercase, lowercase, and a number.';
  }
  return errs;
}
const ADMIN_SUBSCRIPTION_PLANS = new Set(['free', 'starter', 'pro', 'business', 'agency']);
const ADMIN_SUBSCRIPTION_STATUSES = new Set(['active', 'cancelled', 'past_due', 'expired', 'paused']);
const ADMIN_SUBSCRIPTION_PERIODS = new Set(['monthly', 'annual']);
function validateAdminSubscription({ plan = 'free', status = 'active', period = 'monthly' } = {}) {
  const nextPlan = String(plan || 'free').trim().toLowerCase();
  const nextStatus = String(status || 'active').trim().toLowerCase();
  const nextPeriod = String(period || 'monthly').trim().toLowerCase();
  if (!ADMIN_SUBSCRIPTION_PLANS.has(nextPlan)) return { error: 'Invalid subscription plan' };
  if (!ADMIN_SUBSCRIPTION_STATUSES.has(nextStatus)) return { error: 'Invalid subscription status' };
  if (!ADMIN_SUBSCRIPTION_PERIODS.has(nextPeriod)) return { error: 'Invalid subscription period' };
  return { plan: nextPlan, status: nextPlan === 'free' ? 'active' : nextStatus, period: nextPeriod };
}
function adminSubscriptionEndDate(period, from = new Date()) {
  const end = new Date(from);
  if (period === 'annual') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function isSmtpConfigured() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}
function createMailer() {
  if (!isSmtpConfigured()) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}
async function sendVerificationEmail({ email, name, verifyLink }) {
  const mailer = createMailer();
  if (!mailer) {
    console.log(`[verify-email] SMTP not configured. Verification link for ${email}: ${verifyLink}`);
    return false;
  }

  const info = await mailer.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: 'Verify your LeafletAI email',
    text: [
      `Hi ${name || 'there'},`,
      '',
      'Welcome to LeafletAI. Please verify your email address to unlock all features.',
      '',
      verifyLink,
      '',
      'This link expires in 30 minutes.',
      '',
      'LeafletAI Team',
      'Create smarter leaflets with AI.',
      '',
      'Email: info@leafletai.ai',
      'Website: www.leafletai.ai',
      '',
      'LeafletAI - Design. Automate. Publish.',
    ].join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
        <a href="${escapeHtml(APP_URL)}" style="display:inline-block;margin:0 0 18px;text-decoration:none;">
          <img src="${escapeHtml(`${APP_URL}/leafletai_email_logo_black.png?v=20260729`)}" alt="LeafletAI" style="display:block;width:180px;max-width:100%;height:auto;border:0;"/>
        </a>
        <h1 style="font-size:22px;margin:0 0 12px;">Verify your email</h1>
        <p>Hi ${escapeHtml(name || 'there')},</p>
        <p>Welcome to LeafletAI. Please verify your email address to unlock all features.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(verifyLink)}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;display:inline-block;">Verify email</a>
        </p>
        <p style="color:#6b7280;font-size:14px;">This link expires in 30 minutes.</p>
        <p style="color:#6b7280;font-size:14px;">If the button does not work, copy and paste this link into your browser:<br>${escapeHtml(verifyLink)}</p>
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;color:#374151;font-size:14px;">
          <p style="margin:0 0 4px;"><strong>LeafletAI Team</strong></p>
          <p style="margin:0 0 12px;"><em>Create smarter leaflets with AI.</em></p>
          <p style="margin:0;">&#128231; <a href="mailto:info@leafletai.ai" style="color:#0f766e;text-decoration:none;">info@leafletai.ai</a></p>
          <p style="margin:0 0 12px;">&#127760; <a href="https://www.leafletai.ai" style="color:#0f766e;text-decoration:none;">www.leafletai.ai</a></p>
          <p style="margin:0;"><strong>LeafletAI</strong> &mdash; Design. Automate. Publish.</p>
        </div>
      </div>
    `,
  });
  console.log('[verify-email] sent', {
    to: email,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });
  return true;
}
function formatEmailDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
function subscriptionEmailKey(details) {
  return [
    'subscription-details-v2',
    details.subscriptionId || '',
    details.plan,
    details.period,
    details.status,
    details.endDate || '',
  ].join('|');
}
const SUBSCRIPTION_EXPIRY_NOTICE_MAX = 5;
const SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isPaidSubscriptionPlan(plan) {
  const safePlan = normalizeSubscriptionPlan(plan);
  return safePlan !== 'free' && safePlan !== 'admin' && safePlan !== 'contact';
}

function resetSubscriptionExpiryNotices(userId) {
  db.prepare(`
    UPDATE users
    SET subscription_expired_plan = NULL,
        subscription_expired_period = NULL,
        subscription_expired_end = NULL,
        subscription_expiry_notice_count = 0,
        subscription_expiry_notice_last_sent = NULL
    WHERE id = ?
  `).run(userId);
}

function downgradeExpiredUserToFree(user) {
  const expiredPlan = normalizeSubscriptionPlan(user.subscription_plan);
  if (!isPaidSubscriptionPlan(expiredPlan)) return false;
  db.prepare(`
    UPDATE users
    SET subscription_expired_plan = ?,
        subscription_expired_period = ?,
        subscription_expired_end = ?,
        subscription_plan = 'free',
        subscription_status = 'expired',
        subscription_period = 'monthly'
    WHERE id = ?
  `).run(
    expiredPlan,
    user.subscription_period || 'monthly',
    user.subscription_end || new Date().toISOString(),
    user.id,
  );
  console.warn('[subscription-expiry] downgraded user to free', {
    userId: user.id,
    plan: expiredPlan,
    end: user.subscription_end,
  });
  return true;
}

async function sendSubscriptionDetailsEmail(userId, details) {
  const plan = String(details?.plan || '').toLowerCase();
  if (!isPaidSubscriptionPlan(plan)) return false;

  const user = db.prepare('SELECT id,name,email,subscription_email_key FROM users WHERE id = ?').get(userId);
  if (!user?.email) return false;

  const emailKey = subscriptionEmailKey({ ...details, plan });
  if (user.subscription_email_key === emailKey) {
    console.log('[subscription-email] already sent', { userId, emailKey });
    return false;
  }

  const mailer = createMailer();
  if (!mailer) {
    console.warn('[subscription-email] SMTP not configured', { userId, email: user.email });
    return false;
  }

  const reserved = db.prepare(`
    UPDATE users
    SET subscription_email_key = ?
    WHERE id = ?
      AND COALESCE(subscription_email_key, '') <> ?
  `).run(emailKey, userId, emailKey);
  if (reserved.changes === 0) {
    console.log('[subscription-email] already reserved', { userId, emailKey });
    return false;
  }

  const planLabel = `${titleCase(plan)} Plan`;
  const periodLabel = String(details.period || 'monthly') === 'annual' ? 'Annual' : 'Monthly';
  const statusLabel = titleCase(details.status || 'active');
  const startLabel = formatEmailDate(details.startDate);
  const endLabel = formatEmailDate(details.endDate);
  const settingsUrl = `${APP_URL}/settings`;
  const rows = [
    ['Plan', planLabel],
    ['Billing period', periodLabel],
    ['Status', statusLabel],
    ['Subscription date', startLabel],
    ['End date', endLabel],
    ['Account email', user.email],
  ];

  let info;
  try {
    info = await mailer.sendMail({
      from: SUBSCRIPTION_MAIL_FROM,
      to: user.email,
      subject: `Your LeafletAI ${planLabel} subscription details`,
      text: [
        `Hi ${user.name || 'there'},`,
        '',
        'Your LeafletAI subscription is active. Here are the details:',
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        `Manage your subscription and invoices: ${settingsUrl}`,
        '',
        'LeafletAI Team',
        'Create smarter leaflets with AI.',
        '',
        'Email: info@leafletai.ai',
        'Website: www.leafletai.ai',
        '',
        'LeafletAI - Design. Automate. Publish.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
          <a href="${escapeHtml(APP_URL)}" style="display:inline-block;margin:0 0 18px;text-decoration:none;">
            <img src="${escapeHtml(`${APP_URL}/leafletai_email_logo_black.png?v=20260729`)}" alt="LeafletAI" style="display:block;width:180px;max-width:100%;height:auto;border:0;"/>
          </a>
          <h1 style="font-size:22px;margin:0 0 12px;">Your subscription details</h1>
          <p>Hi ${escapeHtml(user.name || 'there')},</p>
          <p>Your LeafletAI subscription is active. Here are the details for your account.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tbody>
              ${rows.map(([label, value]) => `
                <tr>
                  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#4b5563;font-size:14px;width:42%;">${escapeHtml(label)}</td>
                  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;font-size:14px;">${escapeHtml(value)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(settingsUrl)}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;display:inline-block;">Manage subscription</a>
          </p>
          <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;color:#374151;font-size:14px;">
            <p style="margin:0 0 4px;"><strong>LeafletAI Team</strong></p>
            <p style="margin:0 0 12px;"><em>Create smarter leaflets with AI.</em></p>
            <p style="margin:0;">&#128231; <a href="mailto:info@leafletai.ai" style="color:#0f766e;text-decoration:none;">info@leafletai.ai</a></p>
            <p style="margin:0 0 12px;">&#127760; <a href="https://www.leafletai.ai" style="color:#0f766e;text-decoration:none;">www.leafletai.ai</a></p>
            <p style="margin:0;"><strong>LeafletAI</strong> &mdash; Design. Automate. Publish.</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    db.prepare(`
      UPDATE users
      SET subscription_email_key = ?
      WHERE id = ?
        AND subscription_email_key = ?
    `).run(user.subscription_email_key || null, userId, emailKey);
    throw err;
  }
  console.log('[subscription-email] sent', {
    to: user.email,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });
  return true;
}

async function sendSubscriptionPaymentUpdateEmail(user) {
  const noticeCount = Number(user.subscription_expiry_notice_count || 0);
  if (noticeCount >= SUBSCRIPTION_EXPIRY_NOTICE_MAX) return false;

  const todayKey = new Date().toISOString().slice(0, 10);
  if (String(user.subscription_expiry_notice_last_sent || '') === todayKey) return false;

  const mailer = createMailer();
  if (!mailer) {
    console.warn('[subscription-expiry-email] SMTP not configured', { userId: user.id, email: user.email });
    return false;
  }

  const plan = normalizeSubscriptionPlan(user.subscription_expired_plan || user.subscription_plan);
  const planLabel = `${titleCase(plan)} Plan`;
  const periodLabel = String(user.subscription_expired_period || user.subscription_period || 'monthly') === 'annual' ? 'Yearly' : 'Monthly';
  const endLabel = formatEmailDate(user.subscription_expired_end || user.subscription_end);
  const pricingUrl = `${APP_URL}/pricing`;
  const settingsUrl = `${APP_URL}/settings`;
  const remaining = Math.max(0, SUBSCRIPTION_EXPIRY_NOTICE_MAX - noticeCount - 1);

  const info = await mailer.sendMail({
    from: MAIL_FROM,
    to: user.email,
    subject: 'Action required: update your LeafletAI payment',
    text: [
      `Hi ${user.name || 'there'},`,
      '',
      `Your LeafletAI ${planLabel} subscription expired on ${endLabel}.`,
      'Your account has been moved to the Free plan because Stripe did not confirm a successful renewal payment.',
      '',
      `Expired plan: ${planLabel}`,
      `Billing period: ${periodLabel}`,
      `Expiry date: ${endLabel}`,
      '',
      `Update your payment or renew your plan: ${pricingUrl}`,
      `Manage your account: ${settingsUrl}`,
      '',
      remaining > 0
        ? `We will send this reminder once per day for ${remaining} more ${remaining === 1 ? 'day' : 'days'} unless your plan is renewed.`
        : 'This is the final payment reminder for this expired subscription.',
      '',
      'LeafletAI Team',
      'Create smarter leaflets with AI.',
    ].join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827;max-width:600px;margin:0 auto;padding:24px;">
        <a href="${escapeHtml(APP_URL)}" style="display:inline-block;margin:0 0 18px;text-decoration:none;">
          <img src="${escapeHtml(`${APP_URL}/leafletai_email_logo_black.png?v=20260729`)}" alt="LeafletAI" style="display:block;width:180px;max-width:100%;height:auto;border:0;"/>
        </a>
        <h1 style="font-size:22px;margin:0 0 12px;">Update your payment to renew LeafletAI</h1>
        <p>Hi ${escapeHtml(user.name || 'there')},</p>
        <p>Your LeafletAI <strong>${escapeHtml(planLabel)}</strong> subscription expired on <strong>${escapeHtml(endLabel)}</strong>. Your account has been moved to the Free plan because Stripe did not confirm a successful renewal payment.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <tbody>
            ${[
              ['Expired plan', planLabel],
              ['Billing period', periodLabel],
              ['Expiry date', endLabel],
              ['Account email', user.email],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#4b5563;font-size:14px;width:42%;">${escapeHtml(label)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;font-size:14px;">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(pricingUrl)}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;display:inline-block;">Renew plan</a>
        </p>
        <p style="color:#6b7280;font-size:14px;">${remaining > 0
          ? `We will send this reminder once per day for ${remaining} more ${remaining === 1 ? 'day' : 'days'} unless your plan is renewed.`
          : 'This is the final payment reminder for this expired subscription.'}</p>
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;color:#374151;font-size:14px;">
          <p style="margin:0 0 4px;"><strong>LeafletAI Team</strong></p>
          <p style="margin:0 0 12px;"><em>Create smarter leaflets with AI.</em></p>
          <p style="margin:0;">&#128231; <a href="mailto:info@leafletai.ai" style="color:#0f766e;text-decoration:none;">info@leafletai.ai</a></p>
          <p style="margin:0 0 12px;">&#127760; <a href="https://www.leafletai.ai" style="color:#0f766e;text-decoration:none;">www.leafletai.ai</a></p>
        </div>
      </div>
    `,
  });

  db.prepare(`
    UPDATE users
    SET subscription_expiry_notice_count = subscription_expiry_notice_count + 1,
        subscription_expiry_notice_last_sent = ?
    WHERE id = ?
  `).run(todayKey, user.id);
  console.log('[subscription-expiry-email] sent', {
    to: user.email,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });
  return true;
}

function stripeTimestampToIso(ts) {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function resolveStripeSubscriptionPlan(sub) {
  const priceId = sub?.items?.data?.[0]?.price?.id || '';
  return resolveStripePlanFromPriceId(priceId) || (
    sub?.metadata?.plan
      ? { plan: sub.metadata.plan, period: sub.metadata.period || 'monthly' }
      : null
  );
}

async function syncActiveStripeSubscriptionForUser(user, sub, source = 'subscription-sync') {
  const resolved = resolveStripeSubscriptionPlan(sub);
  if (!resolved || !isPaidSubscriptionPlan(resolved.plan)) return false;
  const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
  const startDate = stripeTimestampToIso(sub.current_period_start || sub.start_date || sub.created);
  const endDate = stripeTimestampToIso(sub.current_period_end);

  db.prepare(`
    UPDATE users
    SET subscription_plan = ?,
        subscription_status = ?,
        subscription_period = ?,
        subscription_start = COALESCE(subscription_start, ?),
        subscription_end = ?
    WHERE id = ?
  `).run(resolved.plan, status, resolved.period, startDate, endDate, user.id);
  resetSubscriptionExpiryNotices(user.id);

  sendSubscriptionDetailsEmail(user.id, {
    subscriptionId: sub.id,
    plan: resolved.plan,
    period: resolved.period,
    status,
    startDate: user.subscription_start || startDate,
    endDate,
  }).catch(err => console.error('[subscription-email] failed:', err instanceof Error ? err.message : err));

  console.log(`[${source}] synced active Stripe subscription`, {
    userId: user.id,
    plan: resolved.plan,
    period: resolved.period,
    endDate,
  });
  return true;
}

async function findCurrentStripeSubscriptionForUser(user) {
  if (!stripe || !user?.stripe_customer_id) return null;
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'all',
    limit: 20,
    expand: ['data.items.data.price'],
  });
  const nowSeconds = Math.floor(Date.now() / 1000);
  return subscriptions.data.find(sub => (
    ['active', 'trialing'].includes(sub.status) &&
    Number(sub.current_period_end || 0) > nowSeconds &&
    resolveStripeSubscriptionPlan(sub)
  )) || null;
}

async function enforceExpiredSubscriptions() {
  const rows = db.prepare(`
    SELECT id,name,email,stripe_customer_id,subscription_plan,subscription_status,subscription_period,
           subscription_start,subscription_end,subscription_expired_plan,subscription_expired_period,
           subscription_expired_end,subscription_expiry_notice_count,subscription_expiry_notice_last_sent
    FROM users
    WHERE (
      subscription_plan <> 'free'
      AND subscription_plan <> 'admin'
      AND subscription_end IS NOT NULL
      AND datetime(subscription_end) <= datetime('now')
    )
    OR (
      subscription_plan = 'free'
      AND subscription_expired_plan IS NOT NULL
      AND subscription_expiry_notice_count < ?
    )
  `).all(SUBSCRIPTION_EXPIRY_NOTICE_MAX);

  for (const user of rows) {
    try {
      const activeSub = await findCurrentStripeSubscriptionForUser(user);
      if (activeSub) {
        await syncActiveStripeSubscriptionForUser(user, activeSub, 'subscription-expiry');
        continue;
      }

      if (user.subscription_plan !== 'free') {
        downgradeExpiredUserToFree(user);
      }

      const reminderUser = db.prepare(`
        SELECT id,name,email,stripe_customer_id,subscription_plan,subscription_status,subscription_period,
               subscription_start,subscription_end,subscription_expired_plan,subscription_expired_period,
               subscription_expired_end,subscription_expiry_notice_count,subscription_expiry_notice_last_sent
        FROM users WHERE id = ?
      `).get(user.id);
      if (reminderUser?.subscription_expired_plan) {
        await sendSubscriptionPaymentUpdateEmail(reminderUser);
      }
    } catch (err) {
      console.error('[subscription-expiry] failed for user', {
        userId: user.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
async function sendContactMessage({ name, email, topic, message }) {
  const mailer = createMailer();
  if (!mailer) {
    console.warn('[contact-email] SMTP not configured', { email, topic });
    return false;
  }

  const submittedAt = new Date().toISOString();
  const info = await mailer.sendMail({
    from: MAIL_FROM,
    to: CONTACT_TO_EMAIL,
    replyTo: email,
    subject: `LeafletAI ${topic} request`,
    text: [
      'New LeafletAI contact form message',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${topic}`,
      `Submitted: ${submittedAt}`,
      '',
      message,
    ].join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827;max-width:620px;margin:0 auto;padding:24px;">
        <a href="${escapeHtml(APP_URL)}" style="display:inline-block;margin:0 0 18px;text-decoration:none;">
          <img src="${escapeHtml(`${APP_URL}/leafletai_email_logo_black.png?v=20260729`)}" alt="LeafletAI" style="display:block;width:180px;max-width:100%;height:auto;border:0;"/>
        </a>
        <h1 style="font-size:22px;margin:0 0 12px;">New contact form message</h1>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <tbody>
            ${[
              ['Name', name],
              ['Email', email],
              ['Topic', topic],
              ['Submitted', submittedAt],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#4b5563;font-size:14px;width:34%;">${escapeHtml(label)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;font-size:14px;">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;color:#111827;">${escapeHtml(message)}</div>
      </div>
    `,
  });

  console.log('[contact-email] sent', {
    to: CONTACT_TO_EMAIL,
    from: email,
    topic,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });
  return true;
}
function verificationEmailFailureMessage(err) {
  if (!isSmtpConfigured()) {
    return 'Verification email is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in Hostinger.';
  }

  const code = err?.code || '';
  const responseCode = err?.responseCode || '';
  const message = err instanceof Error ? err.message : String(err || '');
  if (code === 'EAUTH' || responseCode === 535 || /Username and Password not accepted/i.test(message)) {
    if (/gmail\.com$/i.test(SMTP_HOST)) {
      return 'Google rejected the email login. Use a Google App Password for no-reply@leafletai.ai, then redeploy the app.';
    }
    if (/hostinger\.com$/i.test(SMTP_HOST)) {
      return 'Hostinger rejected the email login. Use the mailbox password for no-reply@leafletai.ai, then restart or redeploy the app.';
    }
    return 'Google rejected the email login. Use a Google App Password for no-reply@leafletai.ai, then redeploy the app.';
  }
  if (code === 'EENVELOPE' || /sender|from/i.test(message)) {
    return 'The email sender address was rejected. Make sure MAIL_FROM is LeafletAI <no-reply@leafletai.ai>.';
  }
  if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ESOCKET') {
    return 'The app could not connect to the email server. Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE in Hostinger.';
  }
  return 'The verification email could not be sent. Please check the SMTP settings in Hostinger and try again.';
}
async function logSmtpStartupStatus() {
  if (!isSmtpConfigured()) {
    console.warn('[smtp] not configured', {
      hostLoaded: Boolean(SMTP_HOST),
      userLoaded: Boolean(SMTP_USER),
      passLoaded: Boolean(SMTP_PASS),
      from: MAIL_FROM,
    });
    return;
  }

  try {
    const mailer = createMailer();
    await mailer.verify();
    console.log('[smtp] ready', {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: SMTP_USER,
      from: MAIL_FROM,
    });
  } catch (err) {
    console.error('[smtp] verification failed', {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: SMTP_USER,
      from: MAIL_FROM,
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/* ── Auth middleware ── */
function authMiddleware(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token ? String(req.query.token) : null);
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.sid) {
      const session = db.prepare(`
        SELECT id
        FROM user_sessions
        WHERE user_id = ?
          AND session_id = ?
          AND revoked_at IS NULL
          AND datetime(expires_at) > datetime('now')
      `).get(payload.id, payload.sid);
      if (!session) {
        res.status(401).json({ error: 'This login session is no longer active. Please log in again.' });
        return;
      }
      db.prepare("UPDATE user_sessions SET last_seen_at = datetime('now') WHERE id = ?").run(session.id);
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/* ── Admin middleware ── */
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    const row = db.prepare('SELECT email, role FROM users WHERE id=?').get(req.user.id);
    const isPrimaryAdmin = String(row?.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
    if (!isPrimaryAdmin) {
      res.status(403).json({ error: 'Forbidden: admin only' }); return;
    }
    if (row.role !== 'admin') {
      db.prepare("UPDATE users SET role='admin' WHERE id=?").run(req.user.id);
    }
    next();
  });
}

/* ── File uploads setup ── */
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const PDF_EXPORTS_DIR = path.join(DATA_DIR, 'pdf_exports');
if (!fs.existsSync(PDF_EXPORTS_DIR)) fs.mkdirSync(PDF_EXPORTS_DIR, { recursive: true });

/* ══════════════════════════════════════════════════════════════════
   BACKUP ENGINE
═══════════════════════════════════════════════════════════════════ */
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

function getSetting(key) {
  const row = db.prepare('SELECT value FROM site_settings WHERE key=?').get(key);
  return row ? row.value : null;
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tempDb    = path.join(BACKUPS_DIR, `_tmp_${timestamp}.db`);
  const backupFile = path.join(BACKUPS_DIR, `backup-${timestamp}.db.gz`);

  // Hot-safe SQLite backup via better-sqlite3
  await db.backup(tempDb);

  // Gzip the database snapshot
  await new Promise((resolve, reject) => {
    const inp  = fs.createReadStream(tempDb);
    const out  = fs.createWriteStream(backupFile);
    const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
    inp.pipe(gzip).pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    inp.on('error', reject);
  });
  fs.unlinkSync(tempDb);

  // Enforce max-backup retention
  const maxKeep = parseInt(getSetting('backup_max_keep') || '20', 10);
  const existing = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db.gz'))
    .sort();
  while (existing.length >= maxKeep) {
    try { fs.unlinkSync(path.join(BACKUPS_DIR, existing.shift())); } catch { /* ignore */ }
  }

  console.log(`[backup] Created ${path.basename(backupFile)}`);
  return path.basename(backupFile);
}

/* ── Auto-backup scheduler ───────────────────────────────────────── */
let autoBackupTimer = null;

function startAutoBackup() {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
  const enabled = getSetting('backup_auto_enabled');
  const hours   = parseFloat(getSetting('backup_auto_hours') || '24');
  if (enabled !== '1' || !hours || hours <= 0) return;
  const ms = hours * 60 * 60 * 1000;
  autoBackupTimer = setInterval(() => {
    createBackup().catch(e => console.error('[auto-backup error]', e));
  }, ms);
  console.log(`[backup] Auto-backup scheduled every ${hours}h`);
}

// Seed default backup settings and start scheduler after DB is ready
if (shouldSeedDefaultContent()) {
  db.prepare("INSERT OR IGNORE INTO site_settings (key,value) VALUES ('backup_auto_enabled','0')").run();
  db.prepare("INSERT OR IGNORE INTO site_settings (key,value) VALUES ('backup_auto_hours','24')").run();
  db.prepare("INSERT OR IGNORE INTO site_settings (key,value) VALUES ('backup_max_keep','20')").run();
}
startAutoBackup();

let subscriptionExpiryTimer = null;
function startSubscriptionExpiryScheduler() {
  if (subscriptionExpiryTimer) clearInterval(subscriptionExpiryTimer);
  setTimeout(() => {
    enforceExpiredSubscriptions().catch(err => console.error('[subscription-expiry] startup check failed:', err));
  }, 10 * 1000);
  subscriptionExpiryTimer = setInterval(() => {
    enforceExpiredSubscriptions().catch(err => console.error('[subscription-expiry] scheduled check failed:', err));
  }, SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS);
  console.log('[subscription-expiry] scheduler started');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif|avif|svg\+xml)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, svg, webp, gif, avif).'));
  },
});
const pdfExportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '')) cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  },
});
const backupImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.db\.gz$/i.test(file.originalname || '')) cb(null, true);
    else cb(new Error('Only .db.gz backup files are allowed.'));
  },
});

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOADS_DIR));

function isPrivateAddress(address) {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 169 && parts[1] === 254)
      || parts[0] === 0;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }
  return false;
}

async function assertPublicImageUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    const err = new Error('Invalid image URL.');
    err.status = 400;
    throw err;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const err = new Error('Only HTTP(S) image URLs are supported.');
    err.status = 400;
    throw err;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') {
    const err = new Error('Local image URLs cannot be proxied.');
    err.status = 400;
    throw err;
  }
  if (net.isIP(host) && isPrivateAddress(host)) {
    const err = new Error('Private image URLs cannot be proxied.');
    err.status = 400;
    throw err;
  }
  const addresses = await dns.lookup(host, { all: true, verbatim: false });
  if (addresses.some(entry => isPrivateAddress(entry.address))) {
    const err = new Error('Private image URLs cannot be proxied.');
    err.status = 400;
    throw err;
  }
  return parsed;
}

app.get('/api/image-proxy', async (req, res) => {
  try {
    const imageUrl = await assertPublicImageUrl(req.query.url);
    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (imageUrl.hostname.toLowerCase() === 'cdn.mafrservices.com') {
      upstreamHeaders.Referer = 'https://www.carrefouruae.com/';
    }
    const upstream = await fetch(imageUrl, {
      redirect: 'follow',
      headers: upstreamHeaders,
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Image request failed.' });
      return;
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType)) {
      res.status(415).json({ error: 'URL did not return an image.' });
      return;
    }
    const contentLength = Number(upstream.headers.get('content-length') || '0');
    if (contentLength > 20 * 1024 * 1024) {
      res.status(413).json({ error: 'Image is too large.' });
      return;
    }
    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
      res.status(413).json({ error: 'Image is too large.' });
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || 'Image proxy failed.' });
  }
});

/* ── POST /api/upload ── */
app.post('/api/upload', authMiddleware, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.message || 'Upload failed.';
      return res.status(400).json({ error: msg });
    }
    if (!req.file) { res.status(400).json({ error: 'No image file provided.' }); return; }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

/* ── POST /api/contact ── */
app.post('/api/contact', async (req, res, next) => {
  try {
    const name = normalizeName(req.body.name || '');
    const email = normalizeEmail(req.body.email || '');
    const topic = String(req.body.topic || 'Support').trim().replace(/\s+/g, ' ');
    const message = String(req.body.message || '').trim();
    const topics = new Set(['Support', 'Billing', 'Sales', 'Feature request']);

    const errors = {};
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 120) errors.name = 'Name is too long.';
    if (!email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email.';
    else if (email.length > 190) errors.email = 'Email is too long.';
    if (!topics.has(topic)) errors.topic = 'Please select a valid topic.';
    if (!message) errors.message = 'Message is required.';
    else if (message.length > 5000) errors.message = 'Message is too long.';
    if (Object.keys(errors).length) {
      res.status(422).json({ errors });
      return;
    }

    const sent = await sendContactMessage({ name, email, topic, message });
    if (!sent) {
      res.status(503).json({ error: 'Contact email is not configured yet. Please email info@leafletai.ai directly.' });
      return;
    }
    res.json({ message: 'Your message was sent to info@leafletai.ai.' });
  } catch (err) { next(err); }
});

/* ── POST /api/signup ── */
app.post('/api/signup', async (req, res, next) => {
  try {
    const name     = normalizeName(req.body.name || '');
    const email    = normalizeEmail(req.body.email || '');
    const password = req.body.password || '';

    const errors = {};
    if (name.length < 2)  errors.name = 'Name must be at least 2 characters.';
    if (name.length > 120) errors.name = 'Name is too long.';
    if (!email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email.';
    else if (email.length > 190) errors.email = 'Email is too long.';
    Object.assign(errors, validatePasswordRules(password));

    if (Object.keys(errors).length) {
      res.status(422).json({ errors, old: { name, email } }); return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(422).json({ errors: { email: 'This email is already registered.' }, old: { name, email } }); return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken  = makeToken();
    const verifyExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, email_verified, verify_token, verify_token_expires)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(name, email, passwordHash, verifyToken, verifyExpires);

    const user  = { id: result.lastInsertRowid, name, email, role: 'user', subscription_plan: 'free' };
    const sessionId = createLoginSession(user, req);
    const token = signJwt(user, sessionId);
    const verifyLink = `${APP_URL}/verify-email?token=${verifyToken}&email=${encodeURIComponent(email)}`;
    let emailSent = false;
    let emailError = null;
    try {
      emailSent = await sendVerificationEmail({ email, name, verifyLink });
    } catch (mailErr) {
      emailError = mailErr;
      console.error('[verify-email] failed to send:', mailErr instanceof Error ? mailErr.message : mailErr);
      console.log(`[verify-email] fallback link for ${email}: ${verifyLink}`);
    }
    if (!emailSent) {
      const emailMessage = verificationEmailFailureMessage(emailError);
      console.warn('[verify-email] signup allowed without email delivery', {
        userId: user.id,
        email,
        reason: emailMessage,
      });
      res.json({
        user, token,
        notice: 'Account created, but the verification email could not be sent. You can sign in now while we fix email delivery.',
        emailSent: false,
        emailWarning: emailMessage,
      });
      return;
    }
    res.json({
      user, token,
      notice: 'Verification email sent. Please check your inbox to unlock all features.',
    });
  } catch (err) {
    if (err?.authErrors) { res.status(err.status || 403).json({ errors: err.authErrors }); return; }
    next(err);
  }
});

/* ── POST /api/login ── */
app.post('/api/login', async (req, res, next) => {
  try {
    const email    = normalizeEmail(req.body.email || '');
    const password = req.body.password || '';

    const errors = {};
    if (!email)    errors.email    = 'Email is required.';
    if (!password) errors.password = 'Password is required.';
    if (Object.keys(errors).length) { res.status(422).json({ errors }); return; }

    const user = db.prepare('SELECT id, name, email, password_hash, role, subscription_plan FROM users WHERE email = ?').get(email);
    if (!user) {
      res.status(422).json({
        switchTo: 'signup',
        errors: {
          general: 'No account found with this email. Create your account to continue.',
          email:   'This email is not registered yet.',
        },
        old: { email },
      }); return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(422).json({ errors: { password: 'Incorrect password.' }, old: { email } }); return;
    }

    const sessionId = createLoginSession(user, req);
    const token = signJwt(user, sessionId);
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    if (err?.authErrors) {
      res.status(err.status || 403).json({ errors: err.authErrors, deviceLimit: err.deviceLimit || null });
      return;
    }
    next(err);
  }
});

/* ── POST /api/login/sessions/revoke ── revoke devices after password verification ── */
app.post('/api/login/sessions/revoke', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email || '');
    const password = req.body.password || '';
    const all = req.body.all === true;
    const sessionIds = Array.isArray(req.body.session_ids) ? req.body.session_ids.map(String).filter(Boolean) : [];

    if (!email || !password) {
      res.status(422).json({ errors: { general: 'Email and password are required to manage logged-in devices.' } });
      return;
    }
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(422).json({ errors: { general: 'Email or password is incorrect.' } });
      return;
    }
    if (!all && sessionIds.length === 0) {
      res.status(422).json({ errors: { general: 'Choose at least one device to log out.' } });
      return;
    }

    if (all) {
      db.prepare(`
        UPDATE user_sessions
        SET revoked_at = datetime('now')
        WHERE user_id = ? AND revoked_at IS NULL
      `).run(user.id);
    } else {
      const revoke = db.prepare(`
        UPDATE user_sessions
        SET revoked_at = datetime('now')
        WHERE user_id = ? AND session_id = ? AND revoked_at IS NULL
      `);
      const tx = db.transaction(ids => {
        for (const sid of ids) revoke.run(user.id, sid);
      });
      tx(sessionIds);
    }
    res.json({ ok: true, sessions: listActiveSessions(user.id) });
  } catch (err) { next(err); }
});

/* ── Google OAuth ── */
app.get('/api/config/status', (req, res) => {
  const googleClientId = GOOGLE_OAUTH_CLIENT_ID;
  res.json({
    appUrl: APP_URL,
    googleOAuth: {
      clientIdPresent: !!googleClientId,
      clientIdLooksValid: /\.apps\.googleusercontent\.com$/.test(googleClientId),
      clientIdSuffix: googleClientId ? googleClientId.slice(-28) : '',
      clientSecretPresent: !!GOOGLE_OAUTH_CLIENT_SECRET,
    },
    smtp: {
      configured: isSmtpConfigured(),
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: SMTP_USER,
      from: MAIL_FROM,
      passwordLoaded: Boolean(SMTP_PASS),
    },
  });
});

function startGoogleOAuth(req, res) {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    res.status(503).send('Google login is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.');
    return;
  }

  const state = jwt.sign({ nonce: makeToken(), mode: req.path.endsWith('/signup') ? 'signup' : 'login' }, JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: googleOAuthRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

app.get('/api/oauth/google', startGoogleOAuth);
app.get('/api/oauth/google/signup', startGoogleOAuth);

app.get('/api/oauth/google/callback', async (req, res, next) => {
  try {
    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      res.redirect(`${APP_URL}/oauth/callback?error=${encodeURIComponent('Google login is not configured.')}`);
      return;
    }

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      res.redirect(`${APP_URL}/oauth/callback?error=${encodeURIComponent('Google login was cancelled or incomplete.')}`);
      return;
    }

    try {
      jwt.verify(state, JWT_SECRET);
    } catch {
      res.redirect(`${APP_URL}/oauth/callback?error=${encodeURIComponent('Google login expired. Please try again.')}`);
      return;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: googleOAuthRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[google-oauth] token exchange failed:', tokenData);
      res.redirect(`${APP_URL}/oauth/callback?error=${encodeURIComponent('Google login failed. Please try again.')}`);
      return;
    }

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json().catch(() => ({}));
    const email = normalizeEmail(profile.email || '');
    const name = normalizeName(profile.name || email.split('@')[0] || 'Google user');
    if (!profileRes.ok || !email || profile.email_verified === false) {
      console.error('[google-oauth] profile lookup failed:', profile);
      res.redirect(`${APP_URL}/oauth/callback?error=${encodeURIComponent('Google did not return a verified email address.')}`);
      return;
    }

    let user = db.prepare('SELECT id, name, email, role, subscription_plan FROM users WHERE email = ?').get(email);
    if (user) {
      db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?').run(user.id);
    } else {
      const passwordHash = await bcrypt.hash(makeToken(), 12);
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, email_verified, verify_token, verify_token_expires)
        VALUES (?, ?, ?, 1, NULL, NULL)
      `).run(name, email, passwordHash);
      user = { id: result.lastInsertRowid, name, email, role: 'user', subscription_plan: 'free' };
    }

    let sessionId;
    try {
      sessionId = createLoginSession(user, req);
    } catch (sessionErr) {
      const message = sessionErr?.authErrors?.general || 'This account has reached its concurrent login limit.';
      res.redirect(`${APP_URL}/oauth/callback?error=${encodeURIComponent(message)}`);
      return;
    }
    const appToken = signJwt(user, sessionId);
    const fragment = new URLSearchParams({
      token: appToken,
      user: JSON.stringify({ id: user.id, name: user.name, email: user.email }),
    });
    res.redirect(`${APP_URL}/oauth/callback#${fragment.toString()}`);
  } catch (err) { next(err); }
});

/* ── GET /api/me ── */
app.get('/api/me', authMiddleware, (req, res, next) => {
  try {
    const user = db.prepare('SELECT id, name, email, email_verified FROM users WHERE id = ?').get(req.user.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) { next(err); }
});

/* ── GET /api/user/default-leaflet ── */
app.get('/api/user/default-leaflet', authMiddleware, (req, res, next) => {
  try {
    const user = db.prepare('SELECT default_leaflet_id FROM users WHERE id = ?').get(req.user.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const leafletId = user.default_leaflet_id;
    if (!leafletId) { res.json({ default_leaflet_id: null, default_leaflet: null }); return; }
    const leaflet = db.prepare('SELECT id, title, layout_json FROM leaflets WHERE id = ? AND user_id = ?').get(leafletId, req.user.id);
    if (!leaflet) {
      // default was deleted — clear it
      db.prepare('UPDATE users SET default_leaflet_id = NULL WHERE id = ?').run(req.user.id);
      res.json({ default_leaflet_id: null, default_leaflet: null }); return;
    }
    res.json({ default_leaflet_id: leaflet.id, default_leaflet: leaflet });
  } catch (err) { next(err); }
});

/* ── PUT /api/user/default-leaflet ── */
app.put('/api/user/default-leaflet', authMiddleware, (req, res, next) => {
  try {
    const { leaflet_id } = req.body;
    if (leaflet_id === null || leaflet_id === undefined) {
      // clear default
      db.prepare('UPDATE users SET default_leaflet_id = NULL WHERE id = ?').run(req.user.id);
      res.json({ ok: true, default_leaflet_id: null }); return;
    }
    const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(leaflet_id, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    db.prepare('UPDATE users SET default_leaflet_id = ? WHERE id = ?').run(leaflet_id, req.user.id);
    res.json({ ok: true, default_leaflet_id: leaflet_id });
  } catch (err) { next(err); }
});

/* ── POST /api/logout ── */
app.post('/api/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload?.id && payload?.sid) {
        db.prepare(`
          UPDATE user_sessions
          SET revoked_at = datetime('now')
          WHERE user_id = ? AND session_id = ? AND revoked_at IS NULL
        `).run(payload.id, payload.sid);
      }
    } catch {}
  }
  res.json({ ok: true });
});

/* ── POST /api/forgot-password ── */
app.post('/api/forgot-password', (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email || '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.json({ notice: 'If that email exists, we sent a reset link.' }); return;
    }
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (user) {
      const token   = makeToken();
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);
      console.log(`[reset-link] ${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
    }
    res.json({ notice: 'If that email exists, we sent a reset link.' });
  } catch (err) { next(err); }
});

/* ── GET /api/verify-email ── */
app.get('/api/verify-email', (req, res, next) => {
  try {
    const email = normalizeEmail(req.query.email || '');
    const token = req.query.token || '';
    if (!email || !token) { res.status(400).json({ message: 'Invalid verification link.' }); return; }

    const user = db.prepare(
      'SELECT id, email_verified, verify_token, verify_token_expires FROM users WHERE email = ?'
    ).get(email);
    if (!user) { res.status(400).json({ message: 'Invalid link.' }); return; }
    if (user.email_verified) { res.json({ message: 'Your email is already verified.' }); return; }
    if (user.verify_token !== token) { res.status(400).json({ message: 'Verification token is invalid.' }); return; }
    if (!user.verify_token_expires || new Date() > new Date(user.verify_token_expires)) {
      res.status(400).json({ message: 'Verification link expired. Please request a new one.' }); return;
    }

    db.prepare(
      'UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?'
    ).run(user.id);
    res.json({ message: 'Email verified successfully!' });
  } catch (err) { next(err); }
});

/* ── POST /api/leaflets/:id/duplicate ── */
app.post('/api/leaflets/:id/duplicate', authMiddleware, (req, res, next) => {
  try {
    const src = db.prepare('SELECT * FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!src) { res.status(404).json({ error: 'Leaflet not found.' }); return; }

    const newTitle = (req.body?.title || '').trim() || `${src.title} (Copy)`;
    const ins = db.prepare(`INSERT INTO leaflets (user_id, title, description, language_mode, layout_json) VALUES (?, ?, ?, ?, ?)`);
    const { lastInsertRowid: newId } = ins.run(req.user.id, newTitle, src.description || '', src.language_mode || 'one', src.layout_json || null);

    // Copy products
    const srcProducts = db.prepare('SELECT * FROM leaflet_products WHERE leaflet_id = ? ORDER BY row_index').all(req.params.id);
    const insP = db.prepare(`INSERT INTO leaflet_products
      (leaflet_id, row_index, product_name_lan1, product_name_lan2, product_img_url, product_url,
       origin_lan1, origin_lan2, origin_lan1_iso, origin_lan2_iso, old_price, current_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const copyAll = db.transaction((rows) => {
      for (const p of rows) {
        insP.run(newId, p.row_index, p.product_name_lan1, p.product_name_lan2,
          p.product_img_url, p.product_url, p.origin_lan1, p.origin_lan2,
          p.origin_lan1_iso, p.origin_lan2_iso, p.old_price, p.current_price);
      }
    });
    copyAll(srcProducts);

    res.status(201).json({ id: newId, title: newTitle });
  } catch (err) { next(err); }
});

/* ── Default layout for new leaflets = first saved template (Template 1) ── */
const DEFAULT_LEAFLET_LAYOUT = {
  // ── Card style ────────────────────────────────────────────────
  card_background: '#ffffff', card_border_radius: 0, accent_color: '#49f2b6',
  image_aspect_ratio: 72, card_shadow: true, card_height_ratio: 150,
  show_image: true, show_name_lan1: true, show_name_lan2: true,
  show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
  show_origin_lan1_flag: false, show_origin_lan2_flag: false,
  show_old_price: true, show_current_price: true, show_product_url: true,
  show_discount_badge: true,
  badge_color: '#ff5c5c', badge_text_color: '#000000', badge_font_size: 11, badge_radius: 20, badge_show_bg: true,
  url_icon: 'external', url_icon_size: 26, url_icon_url: '', url_text: 'View product', url_show_text: false,
  url_icon_color: '#000000', url_custom_icon: '',
  name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 17, old_price_size: 12, url_size: 12,
  name_lan1_color: '#000000', name_lan2_color: '#000000',
  origin_color: '#000000', origin_lan1_color: '#000000', origin_lan2_color: '#000000',
  price_color: '#000000', old_price_color: '#000000', url_color: '#000000',
  name_lan1_bold: true, name_lan2_italic: true,
  card_border_width: 1, card_border_top: 1, card_border_right: 1, card_border_bottom: 1, card_border_left: 1,
  card_border_color: '#cccccc', card_border_style: 'solid',
  card_radius_mode: 'all', card_radius_tl: 0, card_radius_tr: 0, card_radius_br: 0, card_radius_bl: 0,
  locked_elems: [], elem_groups: [],
  // ── Positions ─────────────────────────────────────────────────
  positions: {
    image:            { x: 0,                   y: 0,                    w: 100,               h: 46                },
    name_lan1:        { x: 3,                   y: 48,                   w: 94,                h: 9                 },
    name_lan2:        { x: 3,                   y: 58,                   w: 94,                h: 7                 },
    origin_lan1:      { x: 4.293103448275862,   y: 2.7816091954022966,   w: 44,                h: 6                 },
    origin_lan2:      { x: 4.448275862068968,   y: 9.390804597701148,    w: 46,                h: 6                 },
    origin_lan1_flag: { x: 3,                   y: 66,                   w: 6,                 h: 6                 },
    origin_lan2_flag: { x: 51,                  y: 66,                   w: 6,                 h: 6                 },
    old_price:        { x: 3.4310344827586206,  y: 76.01149425287356,    w: 32,                h: 7                 },
    current_price:    { x: 4.672413793103445,   y: 83.34482758620689,    w: 45,                h: 9                 },
    product_url:      { x: 84.4655172413793,    y: 87.44827586206897,    w: 13.448275862068968,h: 8.011494252873563 },
    discount_badge:   { x: 65,                  y: 4.586206896551724,    w: 32,                h: 8                 },
  },
  // ── Element styles ────────────────────────────────────────────
  element_styles: {
    name_lan1:      { bold: true,  italic: false, transform: 'none', script: 'none', align: 'center', valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    name_lan2:      { bold: true,  italic: false, transform: 'none', script: 'none', align: 'center', valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    origin_lan1:    { bold: false, italic: false, transform: 'none', script: 'none', align: 'left',   valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    origin_lan2:    { bold: false, italic: false, transform: 'none', script: 'none', align: 'left',   valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    old_price:      { bold: false, italic: false, transform: 'none', script: 'none', align: 'left',   valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    current_price:  { bold: true,  italic: false, transform: 'none', script: 'none', align: 'left',   valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    product_url:    { bold: false, italic: false, transform: 'none', script: 'none', align: 'left',   valign: 'top',    padding: 2, radius: 3,  bg: '',       bg_opacity: 0.15 },
    discount_badge: { bold: true,  italic: false, transform: 'none', script: 'none', align: 'center', valign: 'middle', padding: 2, radius: 38, bg: '#ff0000', bg_opacity: 1   },
  },
  // ── Page layout ───────────────────────────────────────────────
  page_settings: {
    bgType: 'solid', bgColor: '#ffffff', gradFrom: '#ffffff', gradTo: '#e8f4fd',
    gradAngle: 135, colGap: 0, rowGap: 0,
    orientation: 'portrait', gridWidthPct: 95, gridHeightPct: 100,
  },
  // ── Header ────────────────────────────────────────────────────
  header_settings: {
    show: true, text: 'Header', showText: true,
    textAlign: 'center', blockAlign: 'center',
    widthMode: 'full', widthPct: 100, height: 70, marginTop: 0, marginBottom: 0,
    bgType: 'solid', bgColor: '#cccccc', gradFrom: '#cccccc', gradTo: '#aaaaaa', gradAngle: 90, bgImage: '',
    fontSize: 13, fontColor: '#1e293b', fontWeight: 'bold', fontItalic: false,
    borderWidth: 0, borderColor: '#000000', borderStyle: 'solid',
    borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0,
    perSide: false, radiusMode: 'all', radius: 0, radiusTL: 0, radiusTR: 0, radiusBR: 0, radiusBL: 0,
  },
  // ── Footer ────────────────────────────────────────────────────
  footer_settings: {
    show: true, text: '', showText: true, showPageNum: true,
    textAlign: 'left', blockAlign: 'center', widthMode: 'full', widthPct: 100,
    height: 36, position: 'bottom', marginTop: 0,
    bgType: 'solid', bgColor: '#cccccc', gradFrom: '#cccccc', gradTo: '#aaaaaa', gradAngle: 90, bgImage: '',
    fontSize: 13, fontColor: '#1e293b', fontWeight: 'bold', fontItalic: false,
    borderWidth: 0, borderColor: '#000000', borderStyle: 'solid',
    borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0,
    perSide: false, radiusMode: 'all', radius: 0, radiusTL: 0, radiusTR: 0, radiusBR: 0, radiusBL: 0,
  },
  cols_per_page: 3, rows_per_page: 3,
};

/* ── POST /api/leaflets ── */
function defaultLayoutForNewLeaflet() {
  const setting = db.prepare("SELECT value FROM site_settings WHERE key = 'default_card_template_id'").get();
  const templateId = parseInt(String(setting?.value || ''), 10);
  if (!Number.isNaN(templateId) && templateId > 0) {
    const selected = db.prepare(`
      SELECT layout_json
      FROM card_layout_templates
      WHERE id = ?
      LIMIT 1
    `).get(templateId);
    if (selected?.layout_json) {
      try {
        const layout = JSON.parse(selected.layout_json);
        if (layout && typeof layout === 'object') return layout;
      } catch (_) {}
    }
  }
  const row = db.prepare(`
    SELECT layout_json
    FROM card_layout_templates
    WHERE lower(name) = lower('Template 2')
    ORDER BY created_at DESC
    LIMIT 1
  `).get();
  if (!row?.layout_json) return DEFAULT_LEAFLET_LAYOUT;
  try {
    const layout = JSON.parse(row.layout_json);
    return layout && typeof layout === 'object' ? layout : DEFAULT_LEAFLET_LAYOUT;
  } catch (_) {
    return DEFAULT_LEAFLET_LAYOUT;
  }
}

function defaultCardTemplateRows() {
  let fallbackLayouts = {};
  try {
    fallbackLayouts = JSON.parse(fs.readFileSync(path.join(__dirname, 'default-card-templates.json'), 'utf8'));
  } catch (_) {
    fallbackLayouts = {};
  }

  return PLATFORM_DEFAULT_TEMPLATE_NAMES.map((name, index) => {
    const row = db.prepare(
      `SELECT t.id, t.user_id, t.name, t.layout_json, t.is_platform, t.created_at, u.role AS owner_role
       FROM card_layout_templates t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE lower(t.name) = lower(?)
       ORDER BY t.created_at DESC
       LIMIT 1`
    ).get(name);

    return row || {
      id: -(index + 1),
      user_id: null,
      name,
      layout_json: JSON.stringify(fallbackLayouts[name] || DEFAULT_LEAFLET_LAYOUT),
      is_platform: 1,
      created_at: new Date(0).toISOString(),
      owner_role: 'admin',
    };
  });
}

app.post('/api/leaflets', authMiddleware, (req, res, next) => {
  try {
    const { title, description = '', languageMode = 'one', products = [] } = req.body;
    if (!title || !String(title).trim()) {
      res.status(422).json({ error: 'Title is required.' }); return;
    }
    const user = db.prepare('SELECT email, subscription_plan FROM users WHERE id = ?').get(req.user.id);
    const productLimit = productImportLimitForUser(user);
    const incomingProducts = Array.isArray(products) ? products : [];
    const productsToInsert = Number.isFinite(productLimit)
      ? incomingProducts.slice(0, productLimit)
      : incomingProducts;

    const leafletStmt   = db.prepare(`INSERT INTO leaflets (user_id, title, description, language_mode, layout_json) VALUES (?, ?, ?, ?, ?)`);
    const leafletResult = leafletStmt.run(
      req.user.id, String(title).trim(), String(description).trim(),
      languageMode === 'two' ? 'two' : 'one',
      JSON.stringify(defaultLayoutForNewLeaflet()),
    );
    const leafletId     = leafletResult.lastInsertRowid;

    const insertProduct = db.prepare(`
      INSERT INTO leaflet_products
        (leaflet_id, row_index, product_name_lan1, product_name_lan2,
         product_img_url, product_url, origin_lan1, origin_lan2,
         origin_lan1_iso, origin_lan2_iso, old_price, current_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAll = db.transaction((rows) => {
      for (const p of rows) {
        insertProduct.run(
          leafletId, p.rowIndex ?? null,
          p.product_name_lan1 ?? '', p.product_name_lan2 ?? '',
          p.product_img_url   ?? '', p.product_url       ?? '',
          p.origin_lan1       ?? '', p.origin_lan2       ?? '',
          p.origin_lan1_iso   ?? '', p.origin_lan2_iso   ?? '',
          typeof p.old_price     === 'number' ? p.old_price     : null,
          typeof p.current_price === 'number' ? p.current_price : null,
        );
      }
    });
    if (productsToInsert.length > 0) insertAll(productsToInsert);

    const leaflet = db.prepare('SELECT * FROM leaflets WHERE id = ?').get(leafletId);
    res.status(201).json({
      id: leaflet.id,
      title: leaflet.title,
      createdAt: leaflet.created_at,
      productsImported: productsToInsert.length,
      productsRequested: incomingProducts.length,
      productLimit: Number.isFinite(productLimit) ? productLimit : null,
    });
  } catch (err) { next(err); }
});

/* ── GET /api/leaflets ── */
app.get('/api/leaflets', authMiddleware, (req, res, next) => {
  try {
    const leaflets = db.prepare(
      'SELECT id, title, description, language_mode, created_at, thumbnail FROM leaflets WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json({ leaflets });
  } catch (err) { next(err); }
});

/* ── PUT /api/leaflets/:id/thumbnail ── */
app.put('/api/leaflets/:id/thumbnail', authMiddleware, (req, res, next) => {
  try {
    const { thumbnail } = req.body;
    if (!thumbnail || typeof thumbnail !== 'string') {
      res.status(400).json({ error: 'thumbnail is required' }); return;
    }
    const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    db.prepare('UPDATE leaflets SET thumbnail = ? WHERE id = ?').run(thumbnail, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

const saveExportedPdfRecord = db.transaction(details => {
  const leaflet = db.prepare('SELECT id, title, quota_counted FROM leaflets WHERE id = ? AND user_id = ?')
    .get(details.leafletId, details.userId);
  if (!leaflet) throw httpError(404, 'Leaflet not found.');

  const usage = countLeafletTowardExportQuota(details.userId, leaflet.id, leaflet);

  const result = db.prepare(`
    INSERT INTO leaflet_pdf_exports (user_id, leaflet_id, filename, original_name, size, share_token, allow_edit, export_type, country_code, country_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    details.userId,
    leaflet.id,
    details.filename,
    details.originalName,
    details.size,
    details.shareToken,
    details.allowEdit ? 1 : 0,
    details.exportType || 'pdf',
    details.countryCode || '',
    details.countryName || ''
  );

  return { exportId: result.lastInsertRowid, leaflet, usage };
});

const countLeafletTowardExportQuota = db.transaction((userId, leafletId, knownLeaflet = null) => {
  const leaflet = knownLeaflet || db.prepare('SELECT id, title, quota_counted FROM leaflets WHERE id = ? AND user_id = ?')
    .get(leafletId, userId);
  if (!leaflet) throw httpError(404, 'Leaflet not found.');

  if (!Number(leaflet.quota_counted || 0)) {
    const quota = assertCanCountExportedLeaflet(userId);
    const result = db.prepare(`
      UPDATE leaflets
      SET quota_counted = 1,
          first_exported_at = COALESCE(first_exported_at, datetime('now'))
      WHERE id = ? AND user_id = ? AND quota_counted = 0
    `).run(leaflet.id, userId);
    const countedNow = result.changes > 0;
    if (countedNow) {
      db.prepare('UPDATE users SET exported_leaflets_used = exported_leaflets_used + 1 WHERE id = ?').run(userId);
    }
    return {
      used: quota.used + (countedNow ? 1 : 0),
      limit: Number.isFinite(quota.limit) ? quota.limit : null,
      plan: normalizeSubscriptionPlan(quota.user.subscription_plan),
      counted: countedNow,
    };
  }

  const user = db.prepare('SELECT email, role, subscription_plan FROM users WHERE id = ?').get(userId);
  const limit = leafletCreationLimitForUser(user);
  return {
    used: Number.isFinite(limit) ? exportedLeafletUsageForUser(userId) : 0,
    limit: Number.isFinite(limit) ? limit : null,
    plan: isUnlimitedUser(user) ? 'admin' : normalizeSubscriptionPlan(user?.subscription_plan),
    counted: false,
  };
});

function cleanCountryName(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function handleExportedPdfUpload(req, res) {
  pdfExportUpload.single('pdf')(req, res, (err) => {
    let fullPath = '';
    try {
      if (err) return res.status(400).json({ error: err.message || 'PDF upload failed.' });
      if (!req.file) { res.status(400).json({ error: 'No PDF file provided.' }); return; }
      const leaflet = db.prepare('SELECT id, title FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
      const allowEdit = req.body?.allow_edit === '1' || req.body?.allow_edit === 'true';
      const exportType = String(req.body?.export_type || 'pdf').trim().toLowerCase() === 'flipbook' ? 'flipbook' : 'pdf';
      const countryCode = normalizeCountryCode(req.body?.country_code);
      const countryName = cleanCountryName(req.body?.country_name);
      if (exportType === 'flipbook' && (!countryCode || !countryName)) {
        res.status(400).json({ error: 'Select a country before exporting the flipbook to Leaflet Store.' });
        return;
      }
      const shareToken = crypto.randomBytes(24).toString('hex');

      const userDir = path.join(PDF_EXPORTS_DIR, String(req.user.id));
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      const safeBase = String(leaflet.title || 'leaflet').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'leaflet';
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeBase}.pdf`;
      fullPath = path.join(userDir, filename);
      fs.writeFileSync(fullPath, req.file.buffer);

      const saved = saveExportedPdfRecord({
        userId: req.user.id,
        leafletId: leaflet.id,
        filename,
        originalName: req.file.originalname || `${safeBase}.pdf`,
        size: req.file.size || req.file.buffer.length,
        shareToken,
        allowEdit,
        exportType,
        countryCode,
        countryName,
      });

      res.status(201).json({
        export: {
          id: saved.exportId,
          leaflet_id: leaflet.id,
          filename,
          original_name: req.file.originalname || `${safeBase}.pdf`,
          size: req.file.size || req.file.buffer.length,
          allow_edit: allowEdit,
          export_type: exportType,
          country_code: countryCode,
          country_name: countryName,
          url: `/api/leaflets/${leaflet.id}/exported-pdfs/${filename}`,
          share_url: `/api/shared-pdfs/${shareToken}`,
          share_token: shareToken,
          quota_counted: saved.usage.counted,
        },
        usage: saved.usage,
      });
    } catch (saveErr) {
      if (fullPath && fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
      console.error('[save exported pdf]', saveErr);
      const status = saveErr?.status || 500;
      res.status(status).json({
        error: saveErr?.message || 'Unable to save exported PDF.',
        limitReached: !!saveErr?.limitReached,
        usage: saveErr?.usage,
      });
    }
  });
}

/* ── POST /api/leaflets/:id/exported-pdfs ── */
app.post('/api/leaflets/:id/exported-pdfs', authMiddleware, (req, res) => {
  handleExportedPdfUpload(req, res);
});

/* ── POST /api/leaflets/:id/count-export ── */
app.post('/api/leaflets/:id/count-export', authMiddleware, (req, res) => {
  try {
    const usage = countLeafletTowardExportQuota(req.user.id, req.params.id);
    res.json({
      success: true,
      quota_counted: usage.counted,
      usage,
    });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({
      error: err?.message || 'Unable to count this exported leaflet.',
      limitReached: !!err?.limitReached,
      usage: err?.usage,
    });
  }
});

/* ── GET /api/shared-pdfs/:token ── */
app.get('/api/shared-pdfs/:token', (req, res) => {
  const row = db.prepare(`
    SELECT e.user_id, e.filename, e.original_name, e.allow_edit, l.title
    FROM leaflet_pdf_exports e
    JOIN leaflets l ON l.id = e.leaflet_id
    WHERE e.share_token = ?
  `).get(req.params.token);
  if (!row) { res.status(404).json({ error: 'Shared PDF not found.' }); return; }
  const fullPath = path.join(PDF_EXPORTS_DIR, String(row.user_id), row.filename);
  if (!fs.existsSync(fullPath)) { res.status(404).json({ error: 'Shared PDF file is missing.' }); return; }
  const name = String(row.original_name || row.filename).replace(/"/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.setHeader('X-LeafletAI-Allow-Edit', row.allow_edit ? 'true' : 'false');
  res.sendFile(fullPath);
});

/* ── GET /api/shared-pdfs/:token/meta ── */
app.get('/api/shared-pdfs/:token/meta', (req, res) => {
  const row = db.prepare(`
    SELECT e.id, e.original_name, e.size, e.allow_edit, e.created_at, l.title
    FROM leaflet_pdf_exports e
    JOIN leaflets l ON l.id = e.leaflet_id
    WHERE e.share_token = ?
  `).get(req.params.token);
  if (!row) { res.status(404).json({ error: 'Shared PDF not found.' }); return; }
  res.json({
    title: row.title,
    original_name: row.original_name,
    size: row.size,
    allow_edit: !!row.allow_edit,
    created_at: row.created_at,
  });
});

/* ── GET /api/region-country ── public country detected from request IP ── */
app.get('/api/region-country', async (req, res) => {
  const countryCode = await detectRequestCountry(req, req.query.country);
  res.json({ country_code: countryCode });
});

/* ── GET /api/leaflets/:id/exported-pdfs ── */
app.get('/api/leaflets/:id/exported-pdfs', authMiddleware, (req, res) => {
  const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
  const rows = db.prepare(`
    SELECT id, leaflet_id, filename, original_name, size, created_at
    FROM leaflet_pdf_exports
    WHERE user_id = ? AND leaflet_id = ?
    ORDER BY created_at DESC
    LIMIT 25
  `).all(req.user.id, leaflet.id).map(row => ({
    ...row,
    url: `/api/leaflets/${leaflet.id}/exported-pdfs/${row.filename}`,
  }));
  res.json({ exports: rows });
});

/* ── GET /api/leaflets/:id/exported-pdfs/:filename ── */
app.get('/api/leaflets/:id/exported-pdfs/:filename', (req, res) => {
  const row = db.prepare(`
    SELECT e.user_id, e.filename, e.original_name, e.export_type, e.share_token
    FROM leaflet_pdf_exports e
    JOIN leaflets l ON l.id = e.leaflet_id
    WHERE e.leaflet_id = ? AND e.filename = ?
  `).get(req.params.id, req.params.filename);
  if (!row) { res.status(404).json({ error: 'Saved PDF not found.' }); return; }
  const user = authPayloadFromRequest(req);
  const isPublicFlipbook = row.export_type === 'flipbook' && row.share_token;
  if (!isPublicFlipbook && (!user || Number(user.id) !== Number(row.user_id))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const fullPath = path.join(PDF_EXPORTS_DIR, String(row.user_id), row.filename);
  if (!fs.existsSync(fullPath)) { res.status(404).json({ error: 'Saved PDF file is missing.' }); return; }
  res.setHeader('Content-Type', 'application/pdf');
  const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${String(row.original_name || row.filename).replace(/"/g, '')}"`);
  res.sendFile(fullPath);
});

/* ── GET /api/leaflet-store ── public exported flipbooks grouped by country ── */
app.get('/api/leaflet-store', (req, res) => {
  const country = normalizeCountryCode(req.query.country);
  const params = [];
  let whereCountry = '';
  if (country) {
    whereCountry = 'AND e.country_code = ?';
    params.push(country);
  }
  const rows = db.prepare(`
    SELECT e.id, e.leaflet_id, e.filename, e.original_name, e.size, e.share_token,
           e.country_code, e.country_name, e.created_at,
           l.title, l.description, l.thumbnail
    FROM leaflet_pdf_exports e
    JOIN leaflets l ON l.id = e.leaflet_id
    WHERE e.export_type = 'flipbook'
      AND e.share_token <> ''
      ${whereCountry}
    ORDER BY e.country_name ASC, e.created_at DESC
    LIMIT 200
  `).all(...params).map(row => ({
    id: row.id,
    leaflet_id: row.leaflet_id,
    title: row.title || row.original_name || 'Leaflet flipbook',
    description: row.description || '',
    country_code: row.country_code,
    country_name: row.country_name,
    created_at: row.created_at,
    size: row.size,
    thumbnail_url: row.thumbnail || null,
    url: row.share_token ? `/api/shared-pdfs/${row.share_token}` : '',
    share_url: row.share_token ? `/api/shared-pdfs/${row.share_token}` : '',
    share_token: row.share_token || '',
  }));
  const countries = db.prepare(`
    SELECT country_code, country_name, COUNT(*) AS count
    FROM leaflet_pdf_exports
    WHERE export_type = 'flipbook'
      AND share_token <> ''
      AND country_code <> ''
    GROUP BY country_code, country_name
    ORDER BY country_name ASC
  `).all();
  res.json({ flipbooks: rows, countries });
});

/* ── DELETE /api/leaflets/:id ── */
app.delete('/api/leaflets/:id', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    db.prepare('DELETE FROM leaflet_products WHERE leaflet_id = ?').run(leaflet.id);
    db.prepare('DELETE FROM leaflets WHERE id = ?').run(leaflet.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* ── GET /api/leaflets/:id ── */
app.get('/api/leaflets/:id', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare(
      'SELECT id, title, description, language_mode, created_at, quota_counted, first_exported_at FROM leaflets WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }

    const products = db.prepare(`
      SELECT id, row_index, product_name_lan1, product_name_lan2,
             product_img_url, product_url, origin_lan1, origin_lan2,
             origin_lan1_iso, origin_lan2_iso, old_price, current_price
      FROM leaflet_products WHERE leaflet_id = ? ORDER BY row_index ASC
    `).all(leaflet.id);

    res.json({ leaflet, products });
  } catch (err) { next(err); }
});

/* ── POST /api/leaflets/:lid/products  (add single product) ── */
app.get('/api/admin/leaflets/:id', adminMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare(
      'SELECT id, title, description, language_mode, created_at, quota_counted, first_exported_at FROM leaflets WHERE id = ?'
    ).get(req.params.id);

    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }

    const products = db.prepare(`
      SELECT id, row_index, product_name_lan1, product_name_lan2,
             product_img_url, product_url, origin_lan1, origin_lan2,
             origin_lan1_iso, origin_lan2_iso, old_price, current_price
      FROM leaflet_products WHERE leaflet_id = ? ORDER BY row_index ASC
    `).all(leaflet.id);

    res.json({ leaflet, products });
  } catch (err) { next(err); }
});

app.get('/api/admin/leaflets/:id/layout', adminMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare('SELECT id, layout_json FROM leaflets WHERE id = ?').get(req.params.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    const raw = leaflet.layout_json ? JSON.parse(leaflet.layout_json) : null;
    res.json({ layout: raw || defaultCardLayout() });
  } catch (err) { next(err); }
});

app.post('/api/leaflets/:lid/products', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.lid, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    const user = db.prepare('SELECT subscription_plan FROM users WHERE id = ?').get(req.user.id);
    const productLimit = productImportLimitForUser(user);
    if (Number.isFinite(productLimit)) {
      const currentCount = db.prepare('SELECT COUNT(*) AS n FROM leaflet_products WHERE leaflet_id = ?').get(leaflet.id)?.n || 0;
      if (currentCount >= productLimit) {
        res.status(403).json({
          error: `Your ${productImportLimitPayload(user).plan} plan allows ${productLimit} products per leaflet.`,
          productLimit,
          productsImported: currentCount,
        });
        return;
      }
    }

    const {
      product_name_lan1 = '', product_name_lan2 = '',
      product_img_url   = '', product_url       = '',
      product_image_source = '', product_image_license = '',
      origin_lan1       = '', origin_lan2       = '',
      origin_lan1_iso   = '', origin_lan2_iso   = '',
      old_price, current_price,
    } = req.body;

    const maxRow = db.prepare('SELECT COALESCE(MAX(row_index),0) AS m FROM leaflet_products WHERE leaflet_id = ?').get(leaflet.id);
    const rowIndex = (maxRow?.m ?? 0) + 1;

    const result = db.prepare(`
      INSERT INTO leaflet_products
        (leaflet_id, row_index, product_name_lan1, product_name_lan2,
         product_img_url, product_image_source, product_image_license, product_url, origin_lan1, origin_lan2,
         origin_lan1_iso, origin_lan2_iso, old_price, current_price)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      leaflet.id, rowIndex,
      product_name_lan1, product_name_lan2,
      product_img_url,   product_image_source, product_image_license, product_url,
      origin_lan1,       origin_lan2,
      origin_lan1_iso,   origin_lan2_iso,
      typeof old_price     === 'number' ? old_price     : null,
      typeof current_price === 'number' ? current_price : null,
    );

    const product = db.prepare('SELECT * FROM leaflet_products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ product });
  } catch (err) { next(err); }
});

/* ── PUT /api/leaflets/:lid/products/:pid ── */
app.put('/api/leaflets/:lid/products/:pid', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare(
      'SELECT id FROM leaflets WHERE id = ? AND user_id = ?'
    ).get(req.params.lid, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }

    const product = db.prepare(
      'SELECT id FROM leaflet_products WHERE id = ? AND leaflet_id = ?'
    ).get(req.params.pid, leaflet.id);
    if (!product) { res.status(404).json({ error: 'Product not found.' }); return; }

    const {
      product_name_lan1, product_name_lan2,
      product_img_url,   product_url,
      product_image_source, product_image_license,
      origin_lan1,       origin_lan2,
      origin_lan1_iso,   origin_lan2_iso,
      old_price,         current_price,
    } = req.body;

    db.prepare(`
      UPDATE leaflet_products SET
        product_name_lan1 = ?,
        product_name_lan2 = ?,
        product_img_url   = ?,
        product_image_source = ?,
        product_image_license = ?,
        product_url       = ?,
        origin_lan1       = ?,
        origin_lan2       = ?,
        origin_lan1_iso   = ?,
        origin_lan2_iso   = ?,
        old_price         = ?,
        current_price     = ?
      WHERE id = ?
    `).run(
      product_name_lan1 ?? '',
      product_name_lan2 ?? '',
      product_img_url   ?? '',
      product_image_source ?? '',
      product_image_license ?? '',
      product_url       ?? '',
      origin_lan1       ?? '',
      origin_lan2       ?? '',
      origin_lan1_iso   ?? '',
      origin_lan2_iso   ?? '',
      typeof old_price     === 'number' ? old_price     : null,
      typeof current_price === 'number' ? current_price : null,
      product.id,
    );

    const updated = db.prepare('SELECT * FROM leaflet_products WHERE id = ?').get(product.id);
    res.json({ product: updated });
  } catch (err) { next(err); }
});

/* ── DELETE /api/leaflets/:lid/products/:pid ── */
app.delete('/api/leaflets/:lid/products/:pid', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare(
      'SELECT id FROM leaflets WHERE id = ? AND user_id = ?'
    ).get(req.params.lid, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }

    const product = db.prepare(
      'SELECT id FROM leaflet_products WHERE id = ? AND leaflet_id = ?'
    ).get(req.params.pid, leaflet.id);
    if (!product) { res.status(404).json({ error: 'Product not found.' }); return; }

    db.prepare('DELETE FROM leaflet_products WHERE id = ?').run(product.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* ── GET /api/leaflets/:id/layout ── */
app.get('/api/leaflets/:id/layout', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare('SELECT id, layout_json FROM leaflets WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    const raw = leaflet.layout_json ? JSON.parse(leaflet.layout_json) : null;
    if (!raw) { res.json({ layout: defaultCardLayout() }); return; }
    /* Backfill missing fields so old records get valign/padding defaults */
    const defs = defaultElementStyles();
    if (raw.element_styles && typeof raw.element_styles === 'object') {
      const filled = {};
      for (const k of TEXT_ELEM_KEYS) { filled[k] = sanitizeElemStyle(raw.element_styles[k], defs[k]); }
      raw.element_styles = filled;
    } else {
      raw.element_styles = defs;
    }
    /* Backfill new top-level fields for old records */
    const def = defaultCardLayout();
    const TOP_FIELDS = ['show_product_url','show_origin','show_origin_lan1','show_origin_lan2',
      'show_origin_lan1_flag','show_origin_lan2_flag','flag_icon_size',
      'flag_color','flag_bg','flag_border_width','flag_border_color',
      'flag_radius','flag_radius_mode','flag_radius_tl','flag_radius_tr','flag_radius_br','flag_radius_bl',
      'flag_element_style',
      'currency_symbol','currency_code','currency_symbol_position','currency_symbol_position_current',
      'currency_symbol_icon','currency_symbol_icon_color','currency_symbol_icon_color_current','currency_symbol_icon_color_old',
      'currency_symbol_icon_size','currency_symbol_icon_size_current','currency_symbol_icon_size_old',
      'currency_symbol_size','currency_symbol_size_current','currency_symbol_size_old',
      'currency_symbol_gap','currency_spacing',
      'show_currency_current','show_currency_old',
      'origin_lan1_size','origin_lan2_size','origin_lan1_color','origin_lan2_color',
      'old_price_size',
      'show_old_price','show_current_price',
      'show_name_lan1','show_name_lan2','show_image','show_discount_badge',
      'badge_font_size','badge_radius','badge_show_bg','badge_color','badge_text_color','badge_display_mode',
      'url_icon','url_icon_size','url_icon_url','url_text','url_show_text','url_icon_color','url_custom_icon',
      'card_bg_type','card_bg_color2','card_bg_gradient_angle',
      'card_border_radius','card_border_width','card_border_color','card_border_style',
      'card_border_top','card_border_right','card_border_bottom','card_border_left',
      'shapes'];
    for (const f of TOP_FIELDS) {
      if (raw[f] === undefined || raw[f] === null) raw[f] = def[f];
    }
    raw.shapes = Array.isArray(raw.shapes)
      ? raw.shapes.slice(0, 50).map((s, i) => sanitizeShape(s, i)).filter(Boolean)
      : [];
    /* Backfill positions: migrate old keys and add any missing entries */
    if (raw.positions) {
      const dp = defaultPositions();
      if (!raw.positions.origin_lan1 && raw.positions.origin) raw.positions.origin_lan1 = raw.positions.origin;
      if (!raw.positions.origin_lan2)       raw.positions.origin_lan2      = dp.origin_lan2;
      if (!raw.positions.origin_lan1_flag)  raw.positions.origin_lan1_flag = dp.origin_lan1_flag;
      if (!raw.positions.origin_lan2_flag)  raw.positions.origin_lan2_flag = dp.origin_lan2_flag;
    }
    res.json({ layout: raw });
  } catch (err) { next(err); }
});

/* ── PUT /api/leaflets/:id/layout ── */
app.put('/api/leaflets/:id/layout', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }

    const body = req.body;
    const layout = {
      card_background:    sanitizeBackground(body.card_background, '#1e1e2e'),
      card_bg_type:       ['solid','gradient'].includes(body.card_bg_type) ? body.card_bg_type : 'solid',
      card_bg_color2:     sanitizeColor(body.card_bg_color2, '#ffffff'),
      card_bg_gradient_angle: clampInt(body.card_bg_gradient_angle, 0, 360, 135),
      card_border_radius: clampInt(body.card_border_radius,     0, 48, 16),
      card_border_width:  clampFloat(body.card_border_width,      0, 20,  0),
      card_border_top:    body.card_border_top    != null ? clampFloat(body.card_border_top,    0, 20, 0) : clampFloat(body.card_border_width, 0, 20, 0),
      card_border_right:  body.card_border_right  != null ? clampFloat(body.card_border_right,  0, 20, 0) : clampFloat(body.card_border_width, 0, 20, 0),
      card_border_bottom: body.card_border_bottom != null ? clampFloat(body.card_border_bottom, 0, 20, 0) : clampFloat(body.card_border_width, 0, 20, 0),
      card_border_left:   body.card_border_left   != null ? clampFloat(body.card_border_left,   0, 20, 0) : clampFloat(body.card_border_width, 0, 20, 0),
      card_border_color:  sanitizeColor(body.card_border_color, '#49f2b6'),
      card_border_style:  ['solid','dashed','dotted'].includes(body.card_border_style) ? body.card_border_style : 'solid',
      accent_color:      sanitizeColor(body.accent_color,       '#49f2b6'),
      image_aspect_ratio: clampInt(body.image_aspect_ratio,    20, 200, 72),
      show_image:        boolDef(body.show_image,        true),
      show_name_lan1:    boolDef(body.show_name_lan1,    true),
      show_name_lan2:    boolDef(body.show_name_lan2,    true),
      show_origin:       boolDef(body.show_origin,       true),
      show_origin_lan1:  boolDef(body.show_origin_lan1,  true),
      show_origin_lan2:  boolDef(body.show_origin_lan2,  true),
      show_origin_lan1_flag: boolDef(body.show_origin_lan1_flag, true),
      show_origin_lan2_flag: boolDef(body.show_origin_lan2_flag, true),
      flag_icon_size:        clampInt(body.flag_icon_size, 10, 64, 18),
      flag_color:            sanitizeColor(body.flag_color, ''),
      flag_bg:               sanitizeColor(body.flag_bg, ''),
      flag_border_width:     clampFloat(body.flag_border_width, 0, 20, 0),
      flag_border_color:     sanitizeColor(body.flag_border_color, '#000000'),
      flag_radius:           clampInt(body.flag_radius, 0, 100, 0),
      flag_radius_mode:      ['all','each'].includes(body.flag_radius_mode) ? body.flag_radius_mode : 'all',
      flag_radius_tl:        clampInt(body.flag_radius_tl, 0, 100, 0),
      flag_radius_tr:        clampInt(body.flag_radius_tr, 0, 100, 0),
      flag_radius_br:        clampInt(body.flag_radius_br, 0, 100, 0),
      flag_radius_bl:        clampInt(body.flag_radius_bl, 0, 100, 0),
      flag_element_style:    (body.flag_element_style && typeof body.flag_element_style === 'object')
        ? sanitizeElemStyle(body.flag_element_style, defaultElementStyles().name_lan1)
        : null,
      currency_symbol:           (typeof body.currency_symbol === 'string' && body.currency_symbol.length <= 16) ? body.currency_symbol : '',
      currency_code:             (typeof body.currency_code === 'string' && body.currency_code.length <= 8) ? body.currency_code : '',
      currency_symbol_position:         ['before','after','left','right','top','bottom'].includes(body.currency_symbol_position) ? body.currency_symbol_position : 'before',
      currency_symbol_position_current: ['before','after','left','right','top','bottom'].includes(body.currency_symbol_position_current) ? body.currency_symbol_position_current : null,
      show_currency_current: boolDef(body.show_currency_current, true),
      show_currency_old:     boolDef(body.show_currency_old,     true),
      currency_symbol_size:         clampInt(body.currency_symbol_size,         6, 72, 14),
      currency_symbol_size_current: body.currency_symbol_size_current != null ? clampInt(body.currency_symbol_size_current, 6, 72, 14) : null,
      currency_symbol_size_old:     body.currency_symbol_size_old     != null ? clampInt(body.currency_symbol_size_old,     6, 72, 14) : null,
      show_old_price:    boolDef(body.show_old_price,    true),
      show_current_price:boolDef(body.show_current_price,true),
      show_product_url:  boolDef(body.show_product_url,  true),
      show_discount_badge: boolDef(body.show_discount_badge, true),
      badge_color:         sanitizeColor(body.badge_color,      '#ff5c5c'),
      badge_text_color:    sanitizeColor(body.badge_text_color,  '#ffffff'),
      badge_font_size:     clampInt(body.badge_font_size, 8, 28, 11),
      badge_radius:        clampInt(body.badge_radius,    0, 48, 20),
      badge_show_bg:       boolDef(body.badge_show_bg, true),
      url_icon:            ['arrow','external','cart','eye','chevron','link','plus','none','custom'].includes(body.url_icon) ? body.url_icon : 'arrow',
      url_icon_size:       clampInt(body.url_icon_size, 8, 48, 16),
      url_icon_url:        (typeof body.url_icon_url === 'string' && (body.url_icon_url.startsWith('http') || body.url_icon_url.startsWith('/')) && body.url_icon_url.length <= 512) ? body.url_icon_url : '',
      url_text:            (typeof body.url_text === 'string' && body.url_text.length <= 60) ? body.url_text : 'View product',
      url_show_text:       boolDef(body.url_show_text, true),
      url_icon_color:      sanitizeColor(body.url_icon_color, ''),
      url_custom_icon:     (typeof body.url_custom_icon === 'string' && body.url_custom_icon.length <= 10) ? body.url_custom_icon : '',
      name_lan1_size:    clampInt(body.name_lan1_size,    8, 48, 14),
      name_lan2_size:    clampInt(body.name_lan2_size,    8, 48, 12),
      origin_size:       clampInt(body.origin_size,       8, 48, 11),
      origin_lan1_size:  clampInt(body.origin_lan1_size,  8, 48, 11),
      origin_lan2_size:  clampInt(body.origin_lan2_size,  8, 48, 11),
      price_size:        clampInt(body.price_size,        8, 48, 17),
      old_price_size:    clampInt(body.old_price_size,    8, 48, 12),
      url_size:          clampInt(body.url_size,          8, 48, 12),
      name_lan1_color:   sanitizeColor(body.name_lan1_color,   '#e2e8f0'),
      name_lan2_color:   sanitizeColor(body.name_lan2_color,   '#94a3b8'),
      origin_color:      sanitizeColor(body.origin_color,      '#888888'),
      origin_lan1_color: sanitizeColor(body.origin_lan1_color, '#888888'),
      origin_lan2_color: sanitizeColor(body.origin_lan2_color, '#888888'),
      price_color:       sanitizeColor(body.price_color,       '#49f2b6'),
      old_price_color:   sanitizeColor(body.old_price_color,   '#94a3b8'),
      url_color:         sanitizeColor(body.url_color,         '#49f2b6'),
      card_shadow:       boolDef(body.card_shadow,       true),
      name_lan1_bold:    boolDef(body.name_lan1_bold,    true),
      name_lan2_italic:  boolDef(body.name_lan2_italic,  true),
      card_height_ratio: clampInt(body.card_height_ratio, 80, 300, 150),
      element_styles: (() => {
        const defs = defaultElementStyles();
        const es = (body.element_styles && typeof body.element_styles === 'object') ? body.element_styles : {};
        const result = {};
        for (const k of TEXT_ELEM_KEYS) { result[k] = sanitizeElemStyle(es[k], defs[k]); }
        return result;
      })(),
      positions: (() => {
        const defs = defaultPositions();
        const p = body.positions || {};
        return {
          image:             sanitizePos(p.image,             defs.image),
          name_lan1:         sanitizePos(p.name_lan1,         defs.name_lan1),
          name_lan2:         sanitizePos(p.name_lan2,         defs.name_lan2),
          origin_lan1:       sanitizePos(p.origin_lan1 ?? p.origin, defs.origin_lan1),
          origin_lan2:       sanitizePos(p.origin_lan2,       defs.origin_lan2),
          origin_lan1_flag:  sanitizePos(p.origin_lan1_flag,  defs.origin_lan1_flag),
          origin_lan2_flag:  sanitizePos(p.origin_lan2_flag,  defs.origin_lan2_flag),
          old_price:         sanitizePos(p.old_price,         defs.old_price),
          current_price:     sanitizePos(p.current_price,     defs.current_price),
          product_url:       sanitizePos(p.product_url,       defs.product_url),
          discount_badge:    sanitizePos(p.discount_badge,    defs.discount_badge),
        };
      })(),
      cover_page: (() => {
        const cp = body.cover_page;
        if (!cp || typeof cp !== 'object') return { image: '', show: false };
        return {
          image: (typeof cp.image === 'string' && cp.image.length <= 20971520) ? cp.image : '',
          show:  boolDef(cp.show, false),
        };
      })(),
      back_page: (() => {
        const bp = body.back_page;
        if (!bp || typeof bp !== 'object') return { image: '', show: false };
        return {
          image: (typeof bp.image === 'string' && bp.image.length <= 20971520) ? bp.image : '',
          show:  boolDef(bp.show, false),
        };
      })(),
      cover_builder: (body.cover_builder && typeof body.cover_builder === 'object') ? body.cover_builder : undefined,
      locked_elems: Array.isArray(body.locked_elems)
        ? body.locked_elems.filter(k => typeof k === 'string')
        : [],
      elem_groups: Array.isArray(body.elem_groups)
        ? body.elem_groups.filter(g => Array.isArray(g)).map(g => g.filter(k => typeof k === 'string'))
        : [],
      shapes: Array.isArray(body.shapes)
        ? body.shapes.slice(0, 50).map((s, i) => sanitizeShape(s, i)).filter(Boolean)
        : [],
      font_family: (typeof body.font_family === 'string' && body.font_family.length <= 128)
        ? body.font_family
        : '',
      custom_fonts: Array.isArray(body.custom_fonts)
        ? body.custom_fonts.filter(f => typeof f === 'string' && f.length <= 128).slice(0, 50)
        : [],
      header_settings: (body.header_settings && typeof body.header_settings === 'object') ? body.header_settings : undefined,
      footer_settings: (body.footer_settings && typeof body.footer_settings === 'object') ? body.footer_settings : undefined,
      page_settings:   (body.page_settings   && typeof body.page_settings   === 'object') ? body.page_settings   : undefined,
      cols_per_page:   (typeof body.cols_per_page === 'number') ? Math.max(1, Math.min(6, Math.round(body.cols_per_page))) : undefined,
      rows_per_page:   (typeof body.rows_per_page === 'number') ? Math.max(1, Math.min(6, Math.round(body.rows_per_page))) : undefined,
      page_overrides:  (body.page_overrides && typeof body.page_overrides === 'object') ? body.page_overrides : undefined,
    };

    db.prepare('UPDATE leaflets SET layout_json = ? WHERE id = ?')
      .run(JSON.stringify(layout), leaflet.id);
    res.json({ layout });
  } catch (err) { next(err); }
});

/* ── PUT /api/leaflets/:id/layout/reset ── */
app.put('/api/leaflets/:id/layout/reset', authMiddleware, (req, res, next) => {
  try {
    const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
    db.prepare('UPDATE leaflets SET layout_json = NULL WHERE id = ?').run(leaflet.id);
    res.json({ layout: defaultCardLayout() });
  } catch (err) { next(err); }
});

function defaultCardLayout() {
  return {
    card_background: '#1e1e2e', card_border_radius: 16, accent_color: '#49f2b6',
    image_aspect_ratio: 72,
    show_image: true, show_name_lan1: true, show_name_lan2: true,
    show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
    show_origin_lan1_flag: true, show_origin_lan2_flag: true, flag_icon_size: 18,
    show_old_price: true, show_current_price: true, show_product_url: true,
    show_discount_badge: true, badge_color: '#ff5c5c', badge_text_color: '#ffffff', badge_font_size: 11, badge_radius: 20, badge_show_bg: true,
    url_icon: 'arrow', url_icon_size: 16, url_icon_url: '', url_text: 'View product', url_show_text: true, url_icon_color: '', url_custom_icon: '',
    name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 17, old_price_size: 12, url_size: 12,
    name_lan1_color: '#e2e8f0', name_lan2_color: '#94a3b8', origin_color: '#888888', origin_lan1_color: '#888888', origin_lan2_color: '#888888',
    price_color: '#49f2b6', old_price_color: '#94a3b8', url_color: '#49f2b6',
    card_shadow: true, name_lan1_bold: true, name_lan2_italic: true,
    positions: defaultPositions(),
    card_height_ratio: 150,
    card_border_width: 0, card_border_top: 0, card_border_right: 0, card_border_bottom: 0, card_border_left: 0,
    card_border_color: '#49f2b6', card_border_style: 'solid',
    element_styles: defaultElementStyles(),
    shapes: [],
  };
}
const VALID_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'title_case'];
const VALID_SCRIPTS    = ['none', 'superscript', 'subscript'];
const VALID_ALIGNS     = ['left', 'center', 'right'];
const VALID_VALIGNS    = ['top', 'middle', 'bottom'];
const TEXT_ELEM_KEYS   = ['name_lan1', 'name_lan2', 'origin_lan1', 'origin_lan2', 'old_price', 'current_price', 'product_url', 'discount_badge'];

function defaultElemStyle(bold, italic) {
  return { bold: !!bold, italic: !!italic, transform: 'none', script: 'none', align: 'left', valign: 'top', padding: 2, radius: 3, bg: '', bg_opacity: 0.15 };
}
function defaultElementStyles() {
  return {
    name_lan1:       defaultElemStyle(true,  false),
    name_lan2:       defaultElemStyle(false, true),
    origin_lan1:     defaultElemStyle(false, false),
    origin_lan2:     defaultElemStyle(false, false),
    old_price:       defaultElemStyle(false, false),
    current_price:   defaultElemStyle(true,  false),
    product_url:     defaultElemStyle(false, false),
    discount_badge:  defaultElemStyle(true,  false),
  };
}
function sanitizeElemStyle(v, def) {
  if (!v || typeof v !== 'object') return def;
  return {
    bold:       boolDef(v.bold,       def.bold),
    italic:     boolDef(v.italic,     def.italic),
    transform:  VALID_TRANSFORMS.includes(v.transform) ? v.transform : def.transform,
    script:     VALID_SCRIPTS.includes(v.script)       ? v.script    : def.script,
    align:      VALID_ALIGNS.includes(v.align)         ? v.align     : def.align,
    valign:     VALID_VALIGNS.includes(v.valign)       ? v.valign    : def.valign,
    padding:    clampInt(v.padding, 0, 40, def.padding),
    radius:     clampInt(v.radius,  0, 48, def.radius),
    bg:          (typeof v.bg === 'string' && (/^#[0-9a-fA-F]{6}$/.test(v.bg) || v.bg === '')) ? v.bg : def.bg,
    bg_opacity:  clampFloat(v.bg_opacity, 0, 1, def.bg_opacity),
    border_width: clampFloat(v.border_width, 0, 20, 0),
    border_color: sanitizeColor(v.border_color, ''),
    border_style: ['solid','dashed','dotted'].includes(v.border_style) ? v.border_style : 'solid',
    border_gap:   clampFloat(v.border_gap, 1, 30, 4),
    border_top:   v.border_top    != null ? clampFloat(v.border_top,    0, 20, 0) : clampFloat(v.border_width, 0, 20, 0),
    border_right: v.border_right  != null ? clampFloat(v.border_right,  0, 20, 0) : clampFloat(v.border_width, 0, 20, 0),
    border_bottom:v.border_bottom != null ? clampFloat(v.border_bottom, 0, 20, 0) : clampFloat(v.border_width, 0, 20, 0),
    border_left:  v.border_left   != null ? clampFloat(v.border_left,   0, 20, 0) : clampFloat(v.border_width, 0, 20, 0),
    radius_mode:  ['all','each'].includes(v.radius_mode) ? v.radius_mode : 'all',
    radius_tl:    clampInt(v.radius_tl, 0, 48, 0),
    radius_tr:    clampInt(v.radius_tr, 0, 48, 0),
    radius_br:    clampInt(v.radius_br, 0, 48, 0),
    radius_bl:    clampInt(v.radius_bl, 0, 48, 0),
  };
}
function sanitizeColor(v, fallback) {
  if (v === 'transparent') return v;
  if (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim())) return v.trim();
  return fallback;
}
function sanitizeBackground(v, fallback) {
  if (typeof v !== 'string') return fallback;
  const t = v.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
  if (/^linear-gradient\(.{1,512}\)$/.test(t)) return t;
  return fallback;
}
function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10); return isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
}
function clampFloat(v, min, max, fallback) {
  const n = parseFloat(v); return isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
}
function boolDef(v, fallback) {
  return v === undefined || v === null ? fallback : Boolean(v);
}
function sanitizePos(v, def) {
  if (!v || typeof v !== 'object') return def;
  return {
    x: clampFloat(v.x, 0,  95, def.x),
    y: clampFloat(v.y, 0,  95, def.y),
    w: clampFloat(v.w, 2, 100, def.w),
    h: clampFloat(v.h, 1, 100, def.h),
    ...(v.z !== undefined && v.z !== null ? { z: Math.round(Number(v.z)) } : {}),
  };
}
function sanitizeShape(v, idx) {
  if (!v || typeof v !== 'object') return null;
  const type = ['rectangle','triangle','ellipse','polygon','star','line'].includes(v.type) ? v.type : 'rectangle';
  return {
    id: typeof v.id === 'string' && v.id.length <= 80 ? v.id : `shape_${idx}`,
    type,
    x: clampFloat(v.x, 0, 95, 18),
    y: clampFloat(v.y, 0, 95, 18),
    w: clampFloat(v.w, 2, 100, type === 'line' ? 46 : 24),
    h: clampFloat(v.h, 1, 100, type === 'line' ? 4 : 18),
    rotation: clampFloat(v.rotation, -360, 360, 0),
    fillType: ['solid','gradient'].includes(v.fillType) ? v.fillType : 'solid',
    fill: sanitizeColor(v.fill, type === 'line' ? 'transparent' : '#49f2b6'),
    fillColor2: sanitizeColor(v.fillColor2, '#ffffff'),
    fillGradientAngle: clampFloat(v.fillGradientAngle, 0, 360, 135),
    stroke: sanitizeColor(v.stroke, '#49f2b6'),
    strokeWidth: clampFloat(v.strokeWidth, 0, 20, type === 'line' ? 3 : 1.5),
    strokeStyle: ['solid','dashed','dotted'].includes(v.strokeStyle) ? v.strokeStyle : 'solid',
    opacity: clampFloat(v.opacity, 0, 1, type === 'line' ? 1 : 0.35),
    radiusMode: ['all','each'].includes(v.radiusMode) ? v.radiusMode : 'all',
    radius: clampFloat(v.radius, 0, 50, type === 'rectangle' ? 4 : 0),
    radiusTl: clampFloat(v.radiusTl, 0, 50, type === 'rectangle' ? 4 : 0),
    radiusTr: clampFloat(v.radiusTr, 0, 50, type === 'rectangle' ? 4 : 0),
    radiusBr: clampFloat(v.radiusBr, 0, 50, type === 'rectangle' ? 4 : 0),
    radiusBl: clampFloat(v.radiusBl, 0, 50, type === 'rectangle' ? 4 : 0),
    sides: type === 'polygon' ? clampInt(v.sides, 3, 12, 6) : undefined,
    points: type === 'star' ? clampInt(v.points, 3, 12, 5) : undefined,
    z: clampInt(v.z, -1000, 1000, 30 + idx),
  };
}
function defaultPositions() {
  return {
    image:            { x: 0,  y: 0,  w: 100, h: 46 },
    name_lan1:        { x: 3,  y: 48, w: 94,  h: 9  },
    name_lan2:        { x: 3,  y: 58, w: 94,  h: 7  },
    origin_lan1_flag: { x: 3,  y: 66, w: 6,   h: 6  },
    origin_lan1:      { x: 10, y: 66, w: 37,  h: 6  },
    origin_lan2_flag: { x: 51, y: 66, w: 6,   h: 6  },
    origin_lan2:      { x: 58, y: 66, w: 39,  h: 6  },
    old_price:        { x: 3,  y: 74, w: 32,  h: 7  },
    current_price:    { x: 37, y: 73, w: 45,  h: 9  },
    product_url:      { x: 3,  y: 84, w: 60,  h: 6  },
    discount_badge:   { x: 65, y: 2,  w: 32,  h: 8  },
  };
}

/* ── GET /api/layout-templates ── */
app.get('/api/layout-templates', authMiddleware, (req, res) => {
  const defaultRows = defaultCardTemplateRows();
  const platformRows = db.prepare(
    `SELECT t.id, t.user_id, t.name, t.layout_json, t.is_platform, t.created_at, u.role AS owner_role
     FROM card_layout_templates t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE (COALESCE(t.is_platform, 0) = 1 OR u.role = 'admin')
       AND lower(t.name) NOT IN (${PLATFORM_DEFAULT_TEMPLATE_NAMES.map(() => 'lower(?)').join(',')})
     ORDER BY t.created_at DESC`
  ).all(...PLATFORM_DEFAULT_TEMPLATE_NAMES);
  const userRows = db.prepare(
    `SELECT t.id, t.user_id, t.name, t.layout_json, t.is_platform, t.created_at, u.role AS owner_role
     FROM card_layout_templates t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.user_id = ?
       AND COALESCE(t.is_platform, 0) = 0
       AND COALESCE(u.role, 'user') <> 'admin'
       AND lower(t.name) NOT IN (${PLATFORM_DEFAULT_TEMPLATE_NAMES.map(() => 'lower(?)').join(',')})
     ORDER BY t.created_at DESC`
  ).all(req.user.id, ...PLATFORM_DEFAULT_TEMPLATE_NAMES);
  const rows = [...defaultRows, ...platformRows, ...userRows];
  const templates = rows.map(r => {
    let layout = null;
    try { layout = JSON.parse(r.layout_json); } catch {}
    const isDefaultTemplate = PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(r.name);
    const isPlatformTemplate = isDefaultTemplate || Number(r.is_platform) === 1 || r.owner_role === 'admin';
    return {
      id: r.id,
      name: r.name,
      layout,
      created_at: r.created_at,
      owner_id: r.user_id,
      is_default: isDefaultTemplate,
      is_platform: isPlatformTemplate,
      can_delete: !isDefaultTemplate && (r.user_id === req.user.id || isAdminUser(req.user.id)),
    };
  });
  res.json({ templates });
});

/* -- POST /api/leaflets/:id/exported-pdfs -- */
app.post('/api/leaflets/:id/exported-pdfs', authMiddleware, (req, res) => {
  handleExportedPdfUpload(req, res);
});

/* -- GET /api/leaflets/:id/exported-pdfs -- */
app.get('/api/leaflets/:id/exported-pdfs', authMiddleware, (req, res) => {
  const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!leaflet) { res.status(404).json({ error: 'Leaflet not found.' }); return; }
  const rows = db.prepare(`
    SELECT id, leaflet_id, filename, original_name, size, created_at
    FROM leaflet_pdf_exports
    WHERE user_id = ? AND leaflet_id = ?
    ORDER BY created_at DESC
    LIMIT 25
  `).all(req.user.id, leaflet.id).map(row => ({
    ...row,
    url: `/api/leaflets/${leaflet.id}/exported-pdfs/${row.filename}`,
  }));
  res.json({ exports: rows });
});

/* -- GET /api/leaflets/:id/exported-pdfs/:filename -- */
app.get('/api/leaflets/:id/exported-pdfs/:filename', (req, res) => {
  const row = db.prepare(`
    SELECT e.user_id, e.filename, e.original_name, e.export_type, e.share_token
    FROM leaflet_pdf_exports e
    JOIN leaflets l ON l.id = e.leaflet_id
    WHERE e.leaflet_id = ? AND e.filename = ?
  `).get(req.params.id, req.params.filename);
  if (!row) { res.status(404).json({ error: 'Saved PDF not found.' }); return; }
  const user = authPayloadFromRequest(req);
  const isPublicFlipbook = row.export_type === 'flipbook' && row.share_token;
  if (!isPublicFlipbook && (!user || Number(user.id) !== Number(row.user_id))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const fullPath = path.join(PDF_EXPORTS_DIR, String(row.user_id), row.filename);
  if (!fs.existsSync(fullPath)) { res.status(404).json({ error: 'Saved PDF file is missing.' }); return; }
  res.setHeader('Content-Type', 'application/pdf');
  const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${String(row.original_name || row.filename).replace(/"/g, '')}"`);
  res.sendFile(fullPath);
});

/* -- GET /api/product-image-search -- */
app.get('/api/product-image-search', authMiddleware, async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 160);
  if (!query) {
    res.json({ images: [] });
    return;
  }

  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '8',
      gsrsearch: `${query} product image`,
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata',
      iiurlwidth: '360',
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { 'User-Agent': 'LeafletAI/1.0 product-image-search' },
    });
    if (!response.ok) throw new Error(`Image search failed with ${response.status}`);
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});
    const images = pages
      .map(page => {
        const info = page?.imageinfo?.[0];
        if (!info?.url) return null;
        return {
          title: String(page.title || '').replace(/^File:/, ''),
          url: info.url,
          thumb: info.thumburl || info.url,
          source: 'Wikimedia Commons',
          license: info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || 'Creative Commons / reusable media',
          licenseUrl: info.extmetadata?.LicenseUrl?.value || '',
          mime: info.mime || '',
        };
      })
      .filter(Boolean);
    res.json({ images });
  } catch (err) {
    res.status(502).json({ error: 'Image search is temporarily unavailable.', images: [] });
  }
});

/* ── POST /api/layout-templates ── */
app.post('/api/layout-templates', authMiddleware, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) { res.status(400).json({ error: 'Template name is required.' }); return; }
  if (name.length > 80) { res.status(400).json({ error: 'Template name must be 80 characters or fewer.' }); return; }
  if (!req.body.layout || typeof req.body.layout !== 'object') {
    res.status(400).json({ error: 'Layout data is required.' }); return;
  }
  const isAdmin = isAdminUser(req.user.id);
  const isPlatform = req.body.is_platform === true;
  if (isPlatform && !isAdmin) {
    res.status(403).json({ error: 'Only admins can create platform templates.' });
    return;
  }
  const layoutJson = JSON.stringify(req.body.layout);
  const result = db.prepare(
    'INSERT INTO card_layout_templates (user_id, name, layout_json, is_platform) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, layoutJson, isPlatform ? 1 : 0);
  res.status(201).json({
    template: {
      id: result.lastInsertRowid,
      name,
      layout: req.body.layout,
      created_at: new Date().toISOString(),
      owner_id: req.user.id,
      is_platform: isPlatform,
      is_default: false,
    },
  });
});

app.get('/api/admin/card-templates', adminMiddleware, (req, res) => {
  const platformRows = db.prepare(
    `SELECT id, user_id, name, layout_json, is_platform, created_at
     FROM card_layout_templates
     WHERE is_platform = 1
     ORDER BY created_at DESC`
  ).all();
  const rows = [
    ...defaultCardTemplateRows().map(row => ({ ...row, is_platform: 1 })),
    ...platformRows.filter(row => !PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(row.name)),
  ];
  const templates = rows.map(r => {
    let layout = null;
    try { layout = JSON.parse(r.layout_json); } catch {}
    return {
      id: r.id,
      name: r.name,
      layout,
      created_at: r.created_at,
      owner_id: r.user_id,
      is_platform: true,
      is_default: PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(r.name),
    };
  });
  res.json({ templates });
});

app.post('/api/admin/card-templates', adminMiddleware, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) { res.status(400).json({ error: 'Template name is required.' }); return; }
  if (name.length > 80) { res.status(400).json({ error: 'Template name must be 80 characters or fewer.' }); return; }
  if (!req.body.layout || typeof req.body.layout !== 'object') {
    res.status(400).json({ error: 'Layout data is required.' }); return;
  }
  const layoutJson = JSON.stringify(req.body.layout);
  const result = db.prepare(
    'INSERT INTO card_layout_templates (user_id, name, layout_json, is_platform) VALUES (?, ?, ?, 1)'
  ).run(req.user.id, name, layoutJson);
  res.status(201).json({
    template: {
      id: result.lastInsertRowid,
      name,
      layout: req.body.layout,
      created_at: new Date().toISOString(),
      owner_id: req.user.id,
      is_platform: true,
    },
  });
});

function adminCardTemplateResponse(row, layoutOverride) {
  let layout = layoutOverride;
  if (!layout) {
    try { layout = JSON.parse(row.layout_json); } catch { layout = DEFAULT_LEAFLET_LAYOUT; }
  }
  return {
    id: row.id,
    name: row.name,
    layout,
    created_at: row.created_at,
    owner_id: row.user_id,
    is_platform: true,
    is_default: PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(row.name),
    can_delete: !PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(row.name),
  };
}

function resolveVirtualDefaultTemplateId(rawId) {
  const id = parseInt(String(rawId || ''), 10);
  if (Number.isNaN(id) || id >= 0) return null;
  const index = Math.abs(id) - 1;
  const name = PLATFORM_DEFAULT_TEMPLATE_NAMES[index];
  return name ? { id, name } : null;
}

app.put('/api/admin/card-templates/default', adminMiddleware, (req, res) => {
  const id = parseInt(String(req.body.template_id || ''), 10);
  if (Number.isNaN(id) || id === 0) {
    res.status(400).json({ error: 'Valid template_id is required.' });
    return;
  }
  const virtualDefault = resolveVirtualDefaultTemplateId(id);
  let row = id > 0
    ? db.prepare('SELECT id, name FROM card_layout_templates WHERE id = ?').get(id)
    : null;
  if (!row && virtualDefault) {
    row = db.prepare('SELECT id, name FROM card_layout_templates WHERE lower(name) = lower(?) ORDER BY created_at DESC LIMIT 1').get(virtualDefault.name);
    if (!row) {
      const fallbackRow = defaultCardTemplateRows().find(template => template.name === virtualDefault.name);
      const layoutJson = fallbackRow?.layout_json || JSON.stringify(DEFAULT_LEAFLET_LAYOUT);
      const result = db.prepare(
        'INSERT INTO card_layout_templates (user_id, name, layout_json, is_platform) VALUES (?, ?, ?, 1)'
      ).run(req.user.id, virtualDefault.name, layoutJson);
      row = { id: result.lastInsertRowid, name: virtualDefault.name };
    }
  }
  if (!row) {
    res.status(404).json({ error: 'Template not found.' });
    return;
  }
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run('default_card_template_id', String(row.id));
  res.json({ ok: true, template_id: row.id, template_name: row.name });
});

app.put('/api/admin/card-templates/:id', adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id === 0) { res.status(400).json({ error: 'Invalid template id.' }); return; }
  const virtualDefault = resolveVirtualDefaultTemplateId(id);
  let row = id > 0
    ? db.prepare('SELECT id, user_id, name, layout_json, is_platform, created_at FROM card_layout_templates WHERE id = ?').get(id)
    : null;
  if (!row && virtualDefault) {
    row = db.prepare('SELECT id, user_id, name, layout_json, is_platform, created_at FROM card_layout_templates WHERE lower(name) = lower(?) ORDER BY created_at DESC LIMIT 1').get(virtualDefault.name);
  }

  const fallbackRow = virtualDefault ? defaultCardTemplateRows().find(template => template.name === virtualDefault.name) : null;
  const existingLayout = row?.layout_json || fallbackRow?.layout_json || JSON.stringify(DEFAULT_LEAFLET_LAYOUT);
  const name = virtualDefault ? virtualDefault.name : (req.body.name !== undefined ? String(req.body.name || '').trim() : row?.name);
  if (!name) { res.status(400).json({ error: 'Template name is required.' }); return; }
  if (name.length > 80) { res.status(400).json({ error: 'Template name must be 80 characters or fewer.' }); return; }
  const layout = req.body.layout !== undefined ? req.body.layout : JSON.parse(existingLayout);
  if (!layout || typeof layout !== 'object') {
    res.status(400).json({ error: 'Layout data is required.' });
    return;
  }

  if (row) {
    db.prepare('UPDATE card_layout_templates SET name = ?, layout_json = ?, is_platform = 1 WHERE id = ?')
      .run(name, JSON.stringify(layout), row.id);
    const updated = { ...row, name, layout_json: JSON.stringify(layout), is_platform: 1 };
    res.json({ template: adminCardTemplateResponse(updated, layout) });
    return;
  }

  const result = db.prepare(
    'INSERT INTO card_layout_templates (user_id, name, layout_json, is_platform) VALUES (?, ?, ?, 1)'
  ).run(req.user.id, name, JSON.stringify(layout));
  res.status(201).json({
    template: adminCardTemplateResponse({
      id: result.lastInsertRowid,
      user_id: req.user.id,
      name,
      layout_json: JSON.stringify(layout),
      is_platform: 1,
      created_at: new Date().toISOString(),
    }, layout),
  });
});

app.delete('/api/admin/card-templates/:id', adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id <= 0) { res.status(400).json({ error: 'Invalid template id.' }); return; }
  const row = db.prepare('SELECT id, name FROM card_layout_templates WHERE id = ?').get(id);
  if (!row) { res.status(404).json({ error: 'Template not found.' }); return; }
  if (PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(row.name)) {
    res.status(403).json({ error: 'Default platform templates cannot be deleted.' });
    return;
  }
  db.prepare('DELETE FROM card_layout_templates WHERE id = ?').run(id);
  res.json({ success: true });
});

app.put('/api/layout-templates/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid template id.' }); return; }
  const row = db.prepare('SELECT id, user_id, name, layout_json, is_platform, created_at FROM card_layout_templates WHERE id = ?').get(id);
  if (!row) { res.status(404).json({ error: 'Template not found.' }); return; }
  const isAdmin = isAdminUser(req.user.id);
  if (row.user_id !== req.user.id && !isAdmin) {
    res.status(403).json({ error: 'Only the template owner or an admin can edit this template.' });
    return;
  }
  const name = req.body.name !== undefined ? String(req.body.name || '').trim() : row.name;
  if (!name) { res.status(400).json({ error: 'Template name is required.' }); return; }
  if (name.length > 80) { res.status(400).json({ error: 'Template name must be 80 characters or fewer.' }); return; }
  const layout = req.body.layout !== undefined ? req.body.layout : JSON.parse(row.layout_json);
  if (!layout || typeof layout !== 'object') {
    res.status(400).json({ error: 'Layout data is required.' });
    return;
  }
  const requestedPlatform = req.body.is_platform !== undefined ? req.body.is_platform === true : Number(row.is_platform) === 1;
  if (requestedPlatform && !isAdmin) {
    res.status(403).json({ error: 'Only admins can create platform templates.' });
    return;
  }
  db.prepare('UPDATE card_layout_templates SET name = ?, layout_json = ?, is_platform = ? WHERE id = ?')
    .run(name, JSON.stringify(layout), requestedPlatform ? 1 : 0, id);
  res.json({
    template: {
      id,
      name,
      layout,
      created_at: row.created_at,
      owner_id: row.user_id,
      is_platform: requestedPlatform,
      is_default: PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(name),
      can_delete: !PLATFORM_DEFAULT_TEMPLATE_NAMES.includes(name) && (row.user_id === req.user.id || isAdmin),
    },
  });
});

app.delete('/api/layout-templates/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid template id.' }); return; }
  const row = db.prepare('SELECT id, user_id FROM card_layout_templates WHERE id = ?').get(id);
  if (!row) { res.status(404).json({ error: 'Template not found.' }); return; }
  const defaultRow = db.prepare(`SELECT id FROM card_layout_templates WHERE id = ? AND name IN (${PLATFORM_DEFAULT_TEMPLATE_NAMES.map(() => '?').join(',')})`).get(id, ...PLATFORM_DEFAULT_TEMPLATE_NAMES);
  if (defaultRow) {
    res.status(403).json({ error: 'Default platform templates cannot be deleted.' });
    return;
  }
  if (row.user_id !== req.user.id && !isAdminUser(req.user.id)) {
    res.status(403).json({ error: 'Only the template owner or an admin can delete this template.' });
    return;
  }
  db.prepare('DELETE FROM card_layout_templates WHERE id = ?').run(id);
  res.json({ success: true });
});

/* ── POST /api/track/click  (product-click tracking, no auth required) ── */
app.post('/api/track/click', (req, res) => {
  const { product_id, leaflet_id, user_id } = req.body;
  if (!product_id || !leaflet_id) { res.status(400).json({ error: 'Missing fields' }); return; }
  db.prepare(
    'INSERT INTO product_clicks (product_id, leaflet_id, user_id, clicked_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(Number(product_id), Number(leaflet_id), Number(user_id) || 0);
  res.json({ ok: true });
});

/* ── GET /api/user/insights ── */
app.get('/api/user/insights', authMiddleware, (req, res) => {
  const uid = req.user.id;

  /* 1. All leaflets with created_at */
  const allLeaflets = db.prepare(
    'SELECT id, created_at FROM leaflets WHERE user_id = ? ORDER BY created_at ASC'
  ).all(uid);

  /* 2. Total products */
  const totalProducts = db.prepare(`
    SELECT COUNT(*) AS cnt FROM leaflet_products lp
    JOIN leaflets l ON l.id = lp.leaflet_id WHERE l.user_id = ?
  `).get(uid).cnt ?? 0;

  const totalLeaflets = allLeaflets.length;

  /* 3. Average leaflets per week */
  let avgPerWeek = 0;
  if (totalLeaflets > 0) {
    const first = new Date(allLeaflets[0].created_at);
    const now   = new Date();
    const weeks = Math.max(1, (now - first) / (1000 * 60 * 60 * 24 * 7));
    avgPerWeek  = Math.round((totalLeaflets / weeks) * 10) / 10;
  }

  /* 4. Products per leaflet average */
  const avgProducts = totalLeaflets > 0
    ? Math.round((totalProducts / totalLeaflets) * 10) / 10
    : 0;

  /* 5. Most productive day */
  const dayRows = db.prepare(`
    SELECT strftime('%w', created_at) AS dow, COUNT(*) AS cnt
    FROM leaflets WHERE user_id = ?
    GROUP BY dow ORDER BY cnt DESC LIMIT 1
  `).get(uid);
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mostProductiveDay = dayRows ? DAY_NAMES[Number(dayRows.dow)] : null;

  /* 6. Time since last leaflet */
  const lastRow = db.prepare(
    'SELECT created_at FROM leaflets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(uid);
  const lastCreatedAt = lastRow ? lastRow.created_at : null;

  /* 7. Product click counts — top 10 */
  const topClicks = db.prepare(`
    SELECT lp.id, lp.product_name_lan1 AS name, lp.leaflet_id,
           COUNT(pc.id) AS clicks
    FROM leaflet_products lp
    JOIN leaflets l ON l.id = lp.leaflet_id
    LEFT JOIN product_clicks pc ON pc.product_id = lp.id
    WHERE l.user_id = ?
    GROUP BY lp.id
    ORDER BY clicks DESC
    LIMIT 10
  `).all(uid);

  /* 8. Weekly click activity (last 8 weeks) */
  const weeklyClicks = db.prepare(`
    SELECT strftime('%Y-W%W', pc.clicked_at) AS week,
           COUNT(*) AS clicks
    FROM product_clicks pc
    JOIN leaflet_products lp ON lp.id = pc.product_id
    JOIN leaflets l ON l.id = lp.leaflet_id
    WHERE l.user_id = ?
      AND pc.clicked_at >= datetime('now', '-56 days')
    GROUP BY week ORDER BY week ASC
  `).all(uid);

  res.json({
    avg_leaflets_per_week: avgPerWeek,
    avg_products_per_leaflet: avgProducts,
    most_productive_day: mostProductiveDay,
    last_leaflet_created_at: lastCreatedAt,
    top_clicked_products: topClicks,
    weekly_clicks: weeklyClicks,
    total_clicks: db.prepare(`
      SELECT COUNT(*) AS cnt FROM product_clicks pc
      JOIN leaflet_products lp ON lp.id = pc.product_id
      JOIN leaflets l ON l.id = lp.leaflet_id WHERE l.user_id = ?
    `).get(uid).cnt ?? 0,
  });
});

/* ── GET /api/user/stats ── */
app.get('/api/user/stats', authMiddleware, (req, res) => {
  const leaflets = db.prepare(`
    SELECT COUNT(*) as count FROM leaflets WHERE user_id = ?
  `).get(req.user.id);
  const products = db.prepare(`
    SELECT COUNT(*) as count FROM leaflet_products lp
    JOIN leaflets l ON l.id = lp.leaflet_id WHERE l.user_id = ?
  `).get(req.user.id);
  const recent = db.prepare(`
    SELECT id, title AS name, created_at, thumbnail AS thumbnail_url FROM leaflets
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 6
  `).all(req.user.id);
  const user = db.prepare(
    'SELECT email, role, subscription_plan, subscription_status, subscription_period, subscription_start, subscription_end, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  const firstLeaflet = db.prepare(`
    SELECT created_at FROM leaflets WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
  `).get(req.user.id);
  const unlimited = isUnlimitedUser(user);
  const exportedLeafletLimit = leafletCreationLimitForUser(user);
  res.json({
    leaflets_count:   leaflets?.count ?? 0,
    products_count:   products?.count ?? 0,
    recent_leaflets:  recent,
    exported_leaflets_used:  Number.isFinite(exportedLeafletLimit) ? exportedLeafletUsageForUser(req.user.id) : 0,
    exported_leaflets_limit: Number.isFinite(exportedLeafletLimit) ? exportedLeafletLimit : null,
    subscription_plan:    unlimited ? 'admin' : (user?.subscription_plan ?? 'free'),
    subscription_status:  user?.subscription_status  ?? 'active',
    subscription_period:  user?.subscription_period  ?? 'monthly',
    subscription_start:   user?.subscription_start   ?? null,
    subscription_end:     user?.subscription_end     ?? null,
    member_since:         user?.created_at           ?? firstLeaflet?.created_at ?? null,
    unlimited,
  });
});

/* ── PUT /api/user/profile ── */
app.put('/api/user/profile', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) { res.status(400).json({ error: 'Name is required.' }); return; }
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
  const token = signJwt({ ...user, role: req.user.role }, req.user.sid);
  res.json({ token, name: user.name });
});

/* ── PUT /api/user/password ── */
app.put('/api/user/password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Both current and new password are required.' }); return;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const match = await bcrypt.compare(current_password, user.password_hash);
  if (!match) { res.status(400).json({ error: 'Current password is incorrect.' }); return; }
  const errs = validatePasswordRules(new_password);
  if (Object.keys(errs).length) { res.status(400).json({ errors: errs }); return; }
  const hash = await bcrypt.hash(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated successfully.' });
});

/* ── DELETE /api/user/account ── */
app.delete('/api/user/account', authMiddleware, async (req, res) => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: 'Password is required to delete your account.' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) { res.status(400).json({ error: 'Password is incorrect.' }); return; }
  db.prepare('DELETE FROM leaflet_products WHERE leaflet_id IN (SELECT id FROM leaflets WHERE user_id = ?)').run(req.user.id);
  db.prepare('DELETE FROM leaflets WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ message: 'Account deleted.' });
});

/* ── GET /api/user/export-quota  — returns free export usage for current user ── */
app.get('/api/user/export-quota', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT email, role, subscription_plan, free_pdf_used, free_book_used FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const pdfLimitRow = db.prepare("SELECT value FROM site_settings WHERE key = 'free_pdf_export_limit'").get();
  const freePdfLimit = Math.max(0, Math.min(10000, Number.parseInt(pdfLimitRow?.value || '1', 10) || 0));
  const exportedLeafletLimit = leafletCreationLimitForUser(user);
  const exportedLeafletsUsed = Number.isFinite(exportedLeafletLimit) ? exportedLeafletUsageForUser(req.user.id) : 0;
  if (isUnlimitedUser(user)) {
    res.json({
      plan: 'admin',
      free_pdf_used: 0,
      free_pdf_limit: freePdfLimit,
      free_book_used: 0,
      exported_leaflets_used: 0,
      exported_leaflets_limit: null,
      unlimited: true,
    });
    return;
  }
  res.json({
    plan: user.subscription_plan || 'free',
    free_pdf_used: user.free_pdf_used || 0,
    free_pdf_limit: freePdfLimit,
    free_book_used: user.free_book_used || 0,
    exported_leaflets_used: exportedLeafletsUsed,
    exported_leaflets_limit: Number.isFinite(exportedLeafletLimit) ? exportedLeafletLimit : null,
  });
});

/* ── POST /api/user/consume-export  — marks a free export as used ── */
app.post('/api/user/consume-export', authMiddleware, (req, res) => {
  const { type } = req.body; // 'pdf' or 'book'
  if (!['pdf', 'book'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const user = db.prepare('SELECT email, role, subscription_plan, free_pdf_used, free_book_used FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (isUnlimitedUser(user)) {
    res.json({ ok: true, consumed: false, plan: 'admin', unlimited: true });
    return;
  }
  if (type === 'pdf') {
    const limit = leafletCreationLimitForUser(user);
    res.json({
      ok: true,
      consumed: false,
      used: Number.isFinite(limit) ? exportedLeafletUsageForUser(req.user.id) : 0,
      limit: Number.isFinite(limit) ? limit : null,
    });
    return;
  }
  const plan = user.subscription_plan || 'free';
  if (plan !== 'free') return res.json({ ok: true, consumed: false }); // paid users: no book limit
  const col = type === 'pdf' ? 'free_pdf_used' : 'free_book_used';
  const current = user[col] || 0;
  const limit = type === 'pdf'
    ? Math.max(0, Math.min(10000, Number.parseInt(
        db.prepare("SELECT value FROM site_settings WHERE key = 'free_pdf_export_limit'").get()?.value || '1',
        10
      ) || 0))
    : 1;
  if (current >= limit) return res.status(403).json({ error: 'Free export limit reached', limitReached: true, limit });
  db.prepare(`UPDATE users SET ${col} = ${col} + 1 WHERE id = ?`).run(req.user.id);
  res.json({ ok: true, consumed: true, used: current + 1, limit });
});

/* ── GET /api/stripe/subscription ── returns current user plan ── */
app.get('/api/stripe/subscription', authMiddleware, (req, res) => {
  const row = db.prepare(
    'SELECT email, role, subscription_plan, subscription_status, subscription_period, subscription_start, subscription_end FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!row) {
    res.json({ subscription_plan: 'free', subscription_status: 'active', subscription_period: 'monthly', subscription_start: null, subscription_end: null, unlimited: false });
    return;
  }
  res.json({
    subscription_plan: isUnlimitedUser(row) ? 'admin' : (row.subscription_plan || 'free'),
    subscription_status: row.subscription_status || 'active',
    subscription_period: row.subscription_period || 'monthly',
    subscription_start: row.subscription_start ?? null,
    subscription_end: row.subscription_end ?? null,
    unlimited: isUnlimitedUser(row),
  });
});

app.get('/api/user/product-import-limit', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT email, role, subscription_plan FROM users WHERE id = ?').get(req.user.id);
  res.json(productImportLimitPayload(row));
});

app.post('/api/stripe/confirm-session', authMiddleware, async (req, res) => {
  if (!stripe) { res.status(503).json({ error: 'Stripe not configured' }); return; }
  const sessionId = String(req.body?.session_id || '').trim();
  if (!sessionId || !sessionId.startsWith('cs_')) {
    res.status(400).json({ error: 'Valid Stripe session_id is required.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    const sessionUserId = String(session.metadata?.userId || '');
    if (sessionUserId && sessionUserId !== String(req.user.id)) {
      res.status(403).json({ error: 'This checkout session does not belong to the current user.' });
      return;
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      res.json({ confirmed: false, status: session.status || '', payment_status: session.payment_status || '' });
      return;
    }

    const subscription = session.subscription && typeof session.subscription === 'object'
      ? session.subscription
      : null;
    const priceId = subscription?.items?.data?.[0]?.price?.id || '';
    const resolved = resolveStripePlanFromPriceId(priceId) || {
      plan: session.metadata?.plan || 'pro',
      period: session.metadata?.period || 'monthly',
    };
    const subscriptionStatus = subscription?.status === 'active' || subscription?.status === 'trialing'
      ? 'active'
      : (subscription?.status || 'active');
    const endDate = subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const startDate = subscription?.current_period_start || subscription?.start_date || subscription?.created
      ? new Date((subscription.current_period_start || subscription.start_date || subscription.created) * 1000).toISOString()
      : null;

    db.prepare(`
      UPDATE users
      SET stripe_customer_id = COALESCE(?, stripe_customer_id),
          subscription_plan = ?,
          subscription_status = ?,
          subscription_period = ?,
          subscription_start = COALESCE(subscription_start, ?),
          subscription_end = ?
      WHERE id = ?
    `).run(
      session.customer || null,
      resolved.plan,
      subscriptionStatus,
      resolved.period,
      startDate,
      endDate,
      req.user.id,
    );
    resetSubscriptionExpiryNotices(req.user.id);

    const updatedUser = db.prepare('SELECT subscription_start FROM users WHERE id = ?').get(req.user.id);
    sendSubscriptionDetailsEmail(req.user.id, {
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : subscription?.id,
      plan: resolved.plan,
      period: resolved.period,
      status: subscriptionStatus,
      startDate: updatedUser?.subscription_start || startDate,
      endDate,
    }).catch(err => console.error('[subscription-email] failed:', err instanceof Error ? err.message : err));

    res.json({
      confirmed: true,
      subscription_plan: resolved.plan,
      subscription_status: subscriptionStatus,
      subscription_period: resolved.period,
      subscription_start: startDate,
      subscription_end: endDate,
    });
  } catch (err) {
    console.error('[stripe-confirm-session] failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to confirm Stripe checkout session.' });
  }
});

/* ── POST /api/stripe/create-checkout-session ── */
app.get('/api/stripe/localized-pricing', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const queryCountry = normalizeCountryCode(req.query.country);
  const quoteCountry = detectCheckoutCountry(req, queryCountry);
  const plans = {};
  try {
    for (const plan of ['starter', 'pro', 'business', 'agency']) {
      const monthlyBase = getCheckoutPlanPrice(plan, 'monthly');
      const annualBase = getCheckoutPlanPrice(plan, 'annual');
      if (!monthlyBase) continue;
      const monthly = await quoteLocalizedPlanPrice(monthlyBase, quoteCountry);
      const quote = {
        monthly: {
          currency: monthly.currency,
          amount: monthly.amount,
        }
      };
      if (annualBase) {
        const annualTotal = await quoteLocalizedPlanPrice(annualBase, quoteCountry);
        quote.annual = {
          currency: annualTotal.currency,
          amount: annualTotal.amount / 12,
          totalAmount: annualTotal.amount,
        };
      }
      plans[plan] = quote;
    }
    res.json({
      country: quoteCountry === ['U', 'S'].join('') ? '' : (quoteCountry || ''),
      currency: plans.pro?.monthly?.currency || plans.starter?.monthly?.currency || 'USD',
      plans,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to localize pricing.' });
  }
});

function isStripeMissingCustomerError(err) {
  const message = err instanceof Error ? err.message : String(err || '');
  return err?.code === 'resource_missing'
    && (err?.param === 'customer' || /No such customer/i.test(message));
}

async function getOrCreateStripeCustomer(user) {
  let customerId = user?.stripe_customer_id || '';
  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if (!existing?.deleted) return customerId;
    } catch (err) {
      if (!isStripeMissingCustomerError(err)) throw err;
      console.warn('[stripe] clearing missing customer id', { userId: user.id, customerId });
    }
    db.prepare('UPDATE users SET stripe_customer_id = NULL WHERE id = ?').run(user.id);
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user.id) },
  });
  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, user.id);
  return customer.id;
}

app.post('/api/stripe/create-checkout-session', authMiddleware, async (req, res) => {
  if (!stripe) {
    const configuredCheckoutUrl = getSetting('stripe_checkout_url', '').trim();
    if (configuredCheckoutUrl) {
      res.json({ url: configuredCheckoutUrl });
      return;
    }
    res.status(503).json({ error: 'Stripe is not configured on the server. Add STRIPE_SECRET_KEY to your environment or set a Stripe Checkout Link in Admin Settings.' });
    return;
  }

  const { plan, period, country } = req.body;
  if (!plan || !['starter', 'pro', 'business'].includes(plan)) {
    res.status(400).json({ error: 'Invalid plan.' });
    return;
  }
  if (!period || !['monthly', 'annual'].includes(period)) {
    res.status(400).json({ error: 'Invalid period.' });
    return;
  }

  let checkoutPrice = getActiveStripePrice(plan, period);
  const platformPrice = getCheckoutPlanPrice(plan, period);
  const mappingIsStale = checkoutPrice && platformPrice && (
    checkoutPrice.amount_cents !== platformPrice.unitAmount ||
    checkoutPrice.currency !== platformPrice.currency
  );
  if (!checkoutPrice || mappingIsStale) {
    const row = db.prepare(
      "SELECT value FROM page_content WHERE page='pricing' AND section='plans' AND field='items'"
    ).get();
    await syncStripePricingFromPlansValue(row?.value || JSON.stringify(Object.entries(DEFAULT_STRIPE_PLAN_PRICES).map(([id, p]) => ({ id, ...p }))));
    checkoutPrice = getActiveStripePrice(plan, period);
  }
  if (!checkoutPrice?.stripe_price_id) {
    res.status(400).json({ error: `The Stripe price for ${plan}/${period} is missing or invalid. Please save pricing in Admin again.` });
    return;
  }
  let localizedPrice = null;
  const checkoutCountry = detectCheckoutCountry(req, country);
  try {
    localizedPrice = await localizeCheckoutPrice(checkoutPrice.amount_cents, checkoutCountry);
  } catch (err) {
    console.warn('[stripe-localization] falling back to USD:', err instanceof Error ? err.message : err);
  }

  const user = db.prepare('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?').get(req.user.id);

  const customerId = await getOrCreateStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items:           [localizedPrice ? {
      price_data: {
        currency: localizedPrice.currency,
        unit_amount: localizedPrice.unitAmount,
        recurring: { interval: period === 'annual' ? 'year' : 'month' },
        product_data: {
          name: `${platformPrice?.name || (plan === 'pro' ? 'Pro' : 'Business')} plan`,
          metadata: { plan },
        },
      },
      quantity: 1,
    } : { price: checkoutPrice.stripe_price_id, quantity: 1 }],
    mode:                 'subscription',
    success_url:          `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:           `${APP_URL}/pricing?cancelled=1`,
    metadata:             {
      userId: String(user.id),
      plan,
      period,
      baseCurrency: checkoutPrice.currency,
      baseAmountCents: String(checkoutPrice.amount_cents),
      localizedCurrency: localizedPrice?.currency || checkoutPrice.currency,
      localizedCountry: localizedPrice?.country || checkoutCountry || '',
      exchangeRate: localizedPrice?.rate ? String(localizedPrice.rate) : '',
    },
    subscription_data:    {
      metadata: {
        userId: String(user.id),
        plan,
        period,
        baseCurrency: checkoutPrice.currency,
        baseAmountCents: String(checkoutPrice.amount_cents),
        localizedCurrency: localizedPrice?.currency || checkoutPrice.currency,
        localizedCountry: localizedPrice?.country || checkoutCountry || '',
      },
    },
    adaptive_pricing:     { enabled: true },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

/* ── POST /api/stripe/create-portal-session ── billing portal for manage/cancel ── */
app.post('/api/stripe/create-portal-session', authMiddleware, async (req, res) => {
  if (!stripe) { res.status(503).json({ error: 'Stripe not configured' }); return; }
  const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.user.id);
  if (!user?.stripe_customer_id) {
    res.status(400).json({ error: 'No active subscription found.' });
    return;
  }
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${APP_URL}/pricing`,
    });
    res.json({ url: portalSession.url });
  } catch (err) {
    if (isStripeMissingCustomerError(err)) {
      db.prepare('UPDATE users SET stripe_customer_id = NULL WHERE id = ?').run(req.user.id);
      res.status(400).json({ error: 'Your saved Stripe customer was not found in the active Stripe account. Start checkout again to create a fresh customer.' });
      return;
    }
    throw err;
  }
});

/* ── Global JSON error handler ── */
const a4GenerationJobs = new Map();
const A4_GENERATION_JOB_TTL_MS = 30 * 60 * 1000;
function setA4GenerationJob(jobId, patch) {
  const previous = a4GenerationJobs.get(jobId) || {};
  a4GenerationJobs.set(jobId, { ...previous, ...patch, updatedAt: Date.now() });
}
function cleanupA4GenerationJobs() {
  const cutoff = Date.now() - A4_GENERATION_JOB_TTL_MS;
  for (const [jobId, job] of a4GenerationJobs.entries()) {
    if ((job.updatedAt || job.createdAt || 0) < cutoff) {
      a4GenerationJobs.delete(jobId);
    }
  }
}
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
function normalizeAiCoverPlan(plan) {
  const safePlan = String(plan || 'free').trim().toLowerCase();
  return safePlan === 'professional' ? 'pro' : (safePlan || 'free');
}
function aiCoverGenerationLimitForPlan(plan) {
  const safePlan = normalizeAiCoverPlan(plan);
  const fallback = AI_COVER_GENERATION_LIMIT_BY_PLAN[safePlan] ?? AI_COVER_GENERATION_LIMIT_BY_PLAN.free;
  const settingKey = AI_COVER_GENERATION_SETTING_KEYS[safePlan];
  if (!settingKey) return fallback;
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(settingKey);
  const configured = Number.parseInt(String(row?.value || '').trim(), 10);
  return Number.isInteger(configured) && configured >= 0 ? configured : fallback;
}
function aiCoverPlanLabel(plan) {
  const safePlan = normalizeAiCoverPlan(plan);
  if (safePlan === 'pro') return 'Professional';
  return safePlan.charAt(0).toUpperCase() + safePlan.slice(1);
}
function aiCoverUsageCount(userId, leafletId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM ai_cover_generations
    WHERE user_id = ?
      AND leaflet_id = ?
      AND status IN ('queued', 'running', 'complete')
  `).get(userId, leafletId);
  return Number(row?.count || 0);
}
const reserveAiCoverGeneration = db.transaction((userId, leafletId, jobId) => {
  const safeLeafletId = Number(leafletId);
  if (!Number.isInteger(safeLeafletId) || safeLeafletId <= 0) {
    throw httpError(400, 'leafletId is required for AI cover image generation.');
  }
  const user = db.prepare('SELECT id, email, role, subscription_plan FROM users WHERE id = ?').get(userId);
  if (!user) throw httpError(401, 'User was not found.');
  const leaflet = db.prepare('SELECT id FROM leaflets WHERE id = ? AND user_id = ?').get(safeLeafletId, userId);
  if (!leaflet) throw httpError(404, 'Leaflet was not found.');

  if (isUnlimitedUser(user) || String(user.role || '').toLowerCase() === 'admin') {
    return { leafletId: safeLeafletId, used: 0, limit: null, unlimited: true };
  }

  const limit = aiCoverGenerationLimitForPlan(user.subscription_plan);
  const used = aiCoverUsageCount(userId, safeLeafletId);
  if (used >= limit) {
    const label = aiCoverPlanLabel(user.subscription_plan);
    throw httpError(403, `AI cover generation limit reached for this leaflet. Your ${label} plan includes ${limit} AI cover ${limit === 1 ? 'generation' : 'generations'} per leaflet.`);
  }

  db.prepare(`
    INSERT INTO ai_cover_generations (user_id, leaflet_id, job_id, status)
    VALUES (?, ?, ?, 'queued')
  `).run(userId, safeLeafletId, jobId);

  return { leafletId: safeLeafletId, used: used + 1, limit };
});
function setAiCoverGenerationStatus(jobId, status) {
  db.prepare(`
    UPDATE ai_cover_generations
    SET status = ?,
        completed_at = CASE WHEN ? = 'complete' THEN datetime('now') ELSE completed_at END
    WHERE job_id = ?
  `).run(status, status, jobId);
}
function isTemporaryAiDemandError(err) {
  const message = String(err?.message || '');
  return /high demand|overloaded|temporar|try again later|unavailable|503|502|504/i.test(message) ||
    [502, 503, 504].includes(Number(err?.status || err?.statusCode));
}
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function httpsJsonPostWithAiRetry(url, payload, options = {}) {
  const delays = options.delays || [2500, 6000, 12000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await httpsJsonPost(url, payload, { headers: options.headers });
    } catch (err) {
      if (!isTemporaryAiDemandError(err) || attempt === delays.length) {
        if (isTemporaryAiDemandError(err)) {
          throw httpError(503, 'The AI image model is busy right now. I tried again automatically, but demand is still high. Please try again in a minute.');
        }
        throw err;
      }
      if (typeof options.onRetry === 'function') {
        options.onRetry(attempt + 1, delays.length);
      }
      await wait(delays[attempt]);
    }
  }
}
async function openAiMultipartPostWithAiRetry(url, createBody, options = {}) {
  const delays = options.delays || [2500, 6000, 12000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: options.headers || {},
        body: createBody(),
      });
      const text = await response.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; }
      catch (err) { throw err; }
      if (!response.ok) {
        const err = new Error(parsed?.error?.message || `OpenAI API returned ${response.status}`);
        err.status = response.status;
        err.details = parsed;
        throw err;
      }
      return parsed;
    } catch (err) {
      if (!isTemporaryAiDemandError(err) || attempt === delays.length) {
        if (isTemporaryAiDemandError(err)) {
          throw httpError(503, 'The AI image model is busy right now. I tried again automatically, but demand is still high. Please try again in a minute.');
        }
        throw err;
      }
      if (typeof options.onRetry === 'function') {
        options.onRetry(attempt + 1, delays.length);
      }
      await wait(delays[attempt]);
    }
  }
}
async function generateA4ImageFromPayload(payload, options = {}) {
  const { prompt, orientation, resolution, width, height, referenceImage, referenceImages } = payload || {};
  const safePrompt = String(prompt || '').trim();
  const safeOrientation = orientation === 'landscape' ? 'landscape' : 'portrait';
  const safeResolution = ['1k', '2k', '4k'].includes(resolution) ? resolution : '2k';
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  const imageSize = safeOrientation === 'landscape' ? '1536x1024' : '1024x1536';
  const openAiApiKey = openAiApiKeyValue();
  if (!safePrompt) throw httpError(400, 'Prompt is required');
  if (!openAiApiKey) throw httpError(500, 'OPENAI_API_KEY is not configured');
  if (!Number.isInteger(safeWidth) || !Number.isInteger(safeHeight) || safeWidth % 8 !== 0 || safeHeight % 8 !== 0) {
    throw httpError(400, 'Dimensions must be multiples of 8');
  }
  const rawReferenceImages = Array.isArray(referenceImages)
    ? referenceImages
    : (referenceImage?.data ? [referenceImage] : []);
  const preparedReferenceImages = [];
  for (const refImage of rawReferenceImages.slice(0, 6)) {
    if (!refImage?.data) continue;
    const referenceMimeType = String(refImage.mimeType || 'image/png');
    const referenceData = String(refImage.data || '').replace(/^data:[^,]+,/, '');
    const referenceBytes = Buffer.byteLength(referenceData, 'base64');
    if (!/^image\/(jpeg|jpg|png|webp|gif|avif)$/i.test(referenceMimeType)) throw httpError(400, 'Reference image must be jpg, png, webp, gif, or avif.');
    if (referenceBytes > 6 * 1024 * 1024) throw httpError(413, 'Reference image is too large.');
    preparedReferenceImages.push({
      mimeType: referenceMimeType,
      buffer: Buffer.from(referenceData, 'base64'),
    });
  }
  const startTime = Date.now();
  const noTextInstruction = [
    'Important: generate background artwork only, filling the entire image edge to edge.',
    'Do not include white margins, page borders, decorative frames, inner frames, crop marks, trim marks, registration marks, print guide lines, page outlines, or blank paper around the artwork.',
    'Do not make it look like a poster mockup, printable sheet, framed flyer, or page placed on a white background.',
    'Do not include any written words, letters, numbers, prices, logos with text, labels, captions, brand names, watermarks, or readable typography in the image.',
  ].join(' ');
  const finalPrompt = `${safePrompt}\n\n${noTextInstruction}`;
  const baseOpenAiImagePayload = {
    model: OPENAI_IMAGE_MODEL,
    prompt: finalPrompt,
    n: 1,
    size: imageSize,
    quality: safeResolution === '4k' ? 'high' : 'medium',
    background: 'opaque',
    output_format: 'png',
  };
  const data = preparedReferenceImages.length > 0
    ? await openAiMultipartPostWithAiRetry(
      'https://api.openai.com/v1/images/edits',
      () => {
        const form = new FormData();
        Object.entries(baseOpenAiImagePayload).forEach(([key, value]) => form.append(key, String(value)));
        const imageFieldName = preparedReferenceImages.length > 1 ? 'image[]' : 'image';
        preparedReferenceImages.forEach((refImage, index) => {
          const extension = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'image/avif': '.avif',
          }[String(refImage.mimeType).toLowerCase()] || '.png';
          form.append(imageFieldName, new Blob([refImage.buffer], { type: refImage.mimeType }), `reference-${index + 1}${extension}`);
        });
        return form;
      },
      {
        ...options,
        headers: { Authorization: `Bearer ${openAiApiKey}` },
      },
    )
    : await httpsJsonPostWithAiRetry(
      'https://api.openai.com/v1/images/generations',
      baseOpenAiImagePayload,
      {
        ...options,
        headers: { Authorization: `Bearer ${openAiApiKey}` },
      },
    );
  const imageData = data?.data?.[0];
  if (!imageData?.b64_json) {
    throw httpError(502, 'No image data in response');
  }
  const mimeType = 'image/png';
  const imageBuffer = Buffer.from(imageData.b64_json, 'base64');
  if (imageBuffer.byteLength > 20 * 1024 * 1024) throw httpError(413, 'Generated image is too large.');
  const extension = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  }[String(mimeType).toLowerCase()] || '.png';
  const filename = `${crypto.randomBytes(16).toString('hex')}${extension}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), imageBuffer);
  return {
    imageUrl: `/uploads/${filename}`,
    mimeType,
    width: safeWidth,
    height: safeHeight,
    orientation: safeOrientation,
    resolution: safeResolution,
    duration: Number(((Date.now() - startTime) / 1000).toFixed(1)),
    textResponse: imageData.revised_prompt || null,
  };
}

app.post('/api/generate-a4-jobs', authMiddleware, (req, res) => {
  let jobId = null;
  let usage = null;
  try {
    cleanupA4GenerationJobs();
    jobId = crypto.randomBytes(16).toString('hex');
    usage = reserveAiCoverGeneration(req.user.id, req.body?.leafletId, jobId);
    const createdAt = Date.now();
    a4GenerationJobs.set(jobId, { jobId, status: 'queued', createdAt, updatedAt: createdAt, usage });
    res.status(202).json({ jobId, status: 'queued', usage });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to start image generation' });
    return;
  }
  setImmediate(async () => {
    setA4GenerationJob(jobId, { status: 'running' });
    setAiCoverGenerationStatus(jobId, 'running');
    try {
      const result = await generateA4ImageFromPayload(req.body || {}, {
        onRetry: (attempt, total) => {
          setA4GenerationJob(jobId, {
            status: 'running',
            message: `The AI image model is busy. Retrying automatically (${attempt}/${total})...`,
          });
        },
      });
      setA4GenerationJob(jobId, { status: 'complete', result: { ...result, usage } });
      setAiCoverGenerationStatus(jobId, 'complete');
    } catch (err) {
      const message = err.message || 'Failed to generate image';
      const isQuotaError = /quota|rate limit|429|insufficient_quota/i.test(message);
      setAiCoverGenerationStatus(jobId, 'error');
      setA4GenerationJob(jobId, {
        status: 'error',
        message: isQuotaError
          ? 'OpenAI image generation quota or rate limit was reached. Check billing/quota or try again later.'
          : message,
      });
    }
  });
});

app.get('/api/generate-a4-jobs/:jobId', authMiddleware, (req, res) => {
  cleanupA4GenerationJobs();
  const job = a4GenerationJobs.get(String(req.params.jobId || ''));
  if (!job) {
    res.status(404).json({ message: 'Generation job was not found. Please start a new generation.' });
    return;
  }
  res.json(job);
});

app.post('/api/generate-a4', authMiddleware, async (req, res) => {
  const jobId = `sync-${crypto.randomBytes(16).toString('hex')}`;
  try {
    const usage = reserveAiCoverGeneration(req.user.id, req.body?.leafletId, jobId);
    const result = await generateA4ImageFromPayload(req.body || {});
    setAiCoverGenerationStatus(jobId, 'complete');
    res.json({ ...result, usage });
  } catch (err) {
    setAiCoverGenerationStatus(jobId, 'error');
    const message = err.message || 'Failed to generate image';
    const isQuotaError = /quota|rate limit|429|insufficient_quota/i.test(message);
    res.status(err.status || (isQuotaError ? 429 : 500)).json({
      message: isQuotaError
        ? 'OpenAI image generation quota or rate limit was reached. Check billing/quota or try again later.'
        : message,
      details: message,
    });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) { next(err); return; }
  res.status(err.status || 500).json({
    errors: { general: err.message || 'An unexpected server error occurred.' },
  });
});

/* ── Country translation endpoint ── */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpsJsonPost(url, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...(options.headers || {}),
    };
    const req = https.request(url, {
      method: 'POST',
      headers,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; }
        catch (err) { reject(err); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(parsed?.error?.message || `Google API returned ${res.statusCode}`);
          err.status = res.statusCode;
          err.details = parsed;
          reject(err);
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}


app.post('/api/translate-country', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') return res.json({ translated: '' });
  const q = encodeURIComponent(text.trim().slice(0, 100));
  try {
    const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=auto|en`;
    const data = await httpsGet(url);
    const translated = data?.responseData?.translatedText ?? '';
    res.json({ translated });
  } catch {
    res.json({ translated: '' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ADMIN API ROUTES
═══════════════════════════════════════════════════════════════════ */

/* ── GET /api/admin/stats ── */
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const totalUsers     = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const newUsersWeek   = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at >= datetime('now','-7 days')").get().n;
  const totalLeaflets  = db.prepare('SELECT COUNT(*) as n FROM leaflets').get().n;
  const newLeafletsWeek= db.prepare("SELECT COUNT(*) as n FROM leaflets WHERE created_at >= datetime('now','-7 days')").get().n;
  const totalProducts  = db.prepare('SELECT COUNT(*) as n FROM leaflet_products').get().n;
  const totalClicks    = db.prepare('SELECT COUNT(*) as n FROM product_clicks').get().n;
  const planBreakdown  = db.prepare("SELECT subscription_plan, COUNT(*) as n FROM users GROUP BY subscription_plan").all();
  const recentUsers    = db.prepare("SELECT id,name,email,role,subscription_plan,created_at FROM users ORDER BY created_at DESC LIMIT 5").all();
  const recentLeaflets = db.prepare(`SELECT l.id,l.title,l.created_at,u.name as owner,u.email,
    (SELECT COUNT(*) FROM leaflet_products WHERE leaflet_id=l.id) as product_count
    FROM leaflets l JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 5`).all();
  res.json({ totalUsers, newUsersWeek, totalLeaflets, newLeafletsWeek, totalProducts, totalClicks, planBreakdown, recentUsers, recentLeaflets });
});

/* ── GET /api/admin/users/export ── */
app.get('/api/admin/users/export', adminMiddleware, (req, res) => {
  const { search = '', sort_by = 'created_at', sort_dir = 'desc', format = 'csv' } = req.query;
  const like = `%${search}%`;
  const ALLOWED_COLS = ['name','email','role','subscription_plan','subscription_period','subscription_end','created_at','leaflet_count','email_verified'];
  const col = ALLOWED_COLS.includes(sort_by) ? sort_by : 'created_at';
  const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';
  const orderExpr = col === 'leaflet_count'
    ? `(SELECT COUNT(*) FROM leaflets WHERE user_id=u.id) ${dir}`
    : `u.${col} ${dir}`;
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.email_verified,
           u.subscription_plan, u.subscription_status, u.subscription_period, u.subscription_end, u.created_at,
           (SELECT COUNT(*) FROM leaflets WHERE user_id=u.id) as leaflet_count
    FROM users u
    WHERE u.name LIKE ? OR u.email LIKE ?
    ORDER BY ${orderExpr}
  `).all(like, like);

  const data = rows.map(u => ({
    ID:                  u.id,
    Name:                u.name,
    Email:               u.email,
    Role:                u.role,
    Plan:                u.subscription_plan,
    'Billing Period':    u.subscription_plan === 'free' ? '' : (u.subscription_period === 'annual' ? 'Yearly' : 'Monthly'),
    'Sub Status':        u.subscription_status,
    'Subscription End':  u.subscription_end,
    'Email Verified':    u.email_verified ? 'Yes' : 'No',
    Leaflets:            u.leaflet_count,
    'Joined':            u.created_at,
  }));

  if (format === 'xlsx') {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="users.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  }

  // default: CSV
  const headers = Object.keys(data[0] || {});
  const escape  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...data.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\r\n');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
});

/* ── GET /api/admin/users ── */
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const { page=1, limit=20, search='', sort_by='created_at', sort_dir='desc' } = req.query;
  const off  = (Number(page)-1) * Number(limit);
  const like = `%${search}%`;
  const ALLOWED_COLS = ['name','email','role','subscription_plan','subscription_period','subscription_end','created_at','leaflet_count','email_verified'];
  const col = ALLOWED_COLS.includes(sort_by) ? sort_by : 'created_at';
  const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';
  const orderExpr = col === 'leaflet_count'
    ? `(SELECT COUNT(*) FROM leaflets WHERE user_id=u.id) ${dir}`
    : `u.${col} ${dir}`;
  const rows = db.prepare(`
    SELECT u.id,u.name,u.email,u.role,u.email_verified,u.subscription_plan,
           u.subscription_status,u.subscription_period,u.subscription_start,u.subscription_end,u.created_at,
           (SELECT COUNT(*) FROM leaflets WHERE user_id=u.id) as leaflet_count
    FROM users u
    WHERE u.name LIKE ? OR u.email LIKE ?
    ORDER BY ${orderExpr} LIMIT ? OFFSET ?
  `).all(like,like,Number(limit),off);
  const total = db.prepare(`SELECT COUNT(*) as n FROM users WHERE name LIKE ? OR email LIKE ?`).get(like,like).n;
  res.json({ users: rows, total, page: Number(page), limit: Number(limit) });
});

/* ── POST /api/admin/users ── */
app.post('/api/admin/users', adminMiddleware, async (req, res, next) => {
  try {
    const name = normalizeName(req.body.name || '');
    const email = normalizeEmail(req.body.email || '');
    const password = req.body.password || '';
    const role = String(req.body.role || 'user').trim().toLowerCase();
    const sub = validateAdminSubscription({
      plan: req.body.subscription_plan || 'free',
      status: req.body.subscription_status || 'active',
      period: req.body.subscription_period || 'monthly',
    });
    if (sub.error) { res.status(400).json({ error: sub.error }); return; }

    const errors = {};
    if (name.length < 2) errors.name = 'Name must be at least 2 characters.';
    if (name.length > 120) errors.name = 'Name is too long.';
    if (!email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email.';
    else if (email.length > 190) errors.email = 'Email is too long.';
    Object.assign(errors, validatePasswordRules(password));
    if (role !== 'user') errors.role = 'Admin-created accounts must use the user role.';
    if (Object.keys(errors).length) {
      res.status(422).json({ error: Object.values(errors)[0], errors }); return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(422).json({ error: 'This email is already registered.', errors: { email: 'This email is already registered.' } }); return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const isPaid = isPaidSubscriptionPlan(sub.plan);
    const subscriptionStart = isPaid ? new Date() : null;
    const subscriptionEnd = isPaid ? adminSubscriptionEndDate(sub.period, subscriptionStart) : null;
    const result = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, email_verified, role,
        subscription_plan, subscription_status, subscription_period,
        subscription_start, subscription_end
      )
      VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)
    `).run(
      name,
      email,
      passwordHash,
      req.body.email_verified === false ? 0 : 1,
      sub.plan,
      sub.status,
      sub.period,
      subscriptionStart ? subscriptionStart.toISOString() : null,
      subscriptionEnd
    );

    const created = db.prepare(`
      SELECT id,name,email,role,email_verified,subscription_plan,subscription_status,
             subscription_period,subscription_start,subscription_end,created_at,
             (SELECT COUNT(*) FROM leaflets WHERE user_id=users.id) as leaflet_count
      FROM users WHERE id=?
    `).get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

/* ── PUT /api/admin/users/:id ── */
app.put('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const { role, subscription_plan, subscription_status, subscription_period, email_verified } = req.body;
  const id = Number(req.params.id);
  const target = db.prepare('SELECT id,email,subscription_plan,subscription_status,subscription_period,subscription_start,subscription_end FROM users WHERE id=?').get(id);
  if (!target) {
    res.status(404).json({ error: 'User not found' }); return;
  }
  const targetIsPrimaryAdmin = String(target.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
  if (role !== undefined && !['admin', 'user'].includes(String(role))) {
    res.status(400).json({ error: 'Invalid role' }); return;
  }
  if (role === 'admin' && !targetIsPrimaryAdmin) {
    res.status(400).json({ error: 'This account cannot be assigned admin access' }); return;
  }
  if (targetIsPrimaryAdmin && role && role !== 'admin') {
    res.status(400).json({ error: 'Cannot remove admin access from this account' }); return;
  }
  const sub = validateAdminSubscription({
    plan: subscription_plan !== undefined ? subscription_plan : target.subscription_plan,
    status: subscription_status !== undefined ? subscription_status : target.subscription_status,
    period: subscription_period !== undefined ? subscription_period : target.subscription_period,
  });
  if (sub.error) { res.status(400).json({ error: sub.error }); return; }
  const fields = [];
  const vals   = [];
  if (role               !== undefined) { fields.push('role=?');                vals.push(role); }
  if (subscription_plan  !== undefined) { fields.push('subscription_plan=?');   vals.push(sub.plan); }
  if (subscription_plan  !== undefined || subscription_status !== undefined) {
    fields.push('subscription_status=?'); vals.push(sub.status);
  }
  if (subscription_plan  !== undefined || subscription_period !== undefined) {
    fields.push('subscription_period=?'); vals.push(sub.period);
  }
  if (subscription_plan !== undefined && sub.plan === 'free') {
    fields.push('subscription_start=NULL');
    fields.push('subscription_end=NULL');
  }
  if ((subscription_plan !== undefined || subscription_period !== undefined) && sub.plan !== 'free') {
    const subscriptionStart = target.subscription_start || new Date().toISOString();
    fields.push('subscription_start=COALESCE(subscription_start, ?)');
    vals.push(subscriptionStart);
    fields.push('subscription_end=?');
    vals.push(adminSubscriptionEndDate(sub.period));
  }
  if (email_verified     !== undefined) { fields.push('email_verified=?');      vals.push(email_verified ? 1 : 0); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  vals.push(id);
  db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...vals);
  if (subscription_plan !== undefined || subscription_period !== undefined || subscription_status !== undefined) {
    resetSubscriptionExpiryNotices(id);
  }
  const updated = db.prepare('SELECT id,name,email,role,email_verified,subscription_plan,subscription_status,subscription_period,subscription_start,subscription_end,created_at FROM users WHERE id=?').get(id);
  res.json(updated);
});

/* ── DELETE /api/admin/users/:id ── */
app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  res.json({ ok: true });
});

/* ── GET /api/admin/leaflets ── */
app.get('/api/admin/leaflets', adminMiddleware, (req, res) => {
  const { page=1, limit=20, search='' } = req.query;
  const off  = (Number(page)-1) * Number(limit);
  const like = `%${search}%`;
  const rows = db.prepare(`
    SELECT l.id,l.title,l.description,l.created_at,
           u.id as owner_id,u.name as owner_name,u.email as owner_email,
           (SELECT COUNT(*) FROM leaflet_products WHERE leaflet_id=l.id) as product_count
    FROM leaflets l JOIN users u ON u.id=l.user_id
    WHERE l.title LIKE ? OR u.name LIKE ? OR u.email LIKE ?
    ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(like,like,like,Number(limit),off);
  const total = db.prepare(`SELECT COUNT(*) as n FROM leaflets l JOIN users u ON u.id=l.user_id WHERE l.title LIKE ? OR u.name LIKE ? OR u.email LIKE ?`).get(like,like,like).n;
  res.json({ leaflets: rows, total, page: Number(page), limit: Number(limit) });
});

/* ── DELETE /api/admin/leaflets/:id ── */
app.delete('/api/admin/leaflets/:id', adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  db.transaction(() => {
    db.prepare('DELETE FROM leaflet_products WHERE leaflet_id=?').run(id);
    db.prepare('DELETE FROM leaflets WHERE id=?').run(id);
  })();
  res.json({ ok: true });
});

/* ── DELETE /api/admin/leaflets (bulk) ── */
app.delete('/api/admin/leaflets', adminMiddleware, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
  const placeholders = ids.map(() => '?').join(',');
  db.transaction(() => {
    db.prepare(`DELETE FROM leaflet_products WHERE leaflet_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM leaflets WHERE id IN (${placeholders})`).run(...ids);
  })();
  res.json({ ok: true, deleted: ids.length });
});

/* ── GET /api/admin/uploads ── */
app.get('/api/admin/uploads', adminMiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR).map(name => {
      const fp   = path.join(UPLOADS_DIR, name);
      const stat = fs.statSync(fp);
      return { name, size: stat.size, modified: stat.mtime.toISOString(), url: `/uploads/${name}` };
    }).sort((a,b) => b.modified.localeCompare(a.modified));
    res.json({ files, total: files.length });
  } catch { res.json({ files: [], total: 0 }); }
});

/* ── DELETE /api/admin/uploads/:filename ── */
app.delete('/api/admin/uploads/:filename', adminMiddleware, (req, res) => {
  const fp = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  try { fs.unlinkSync(fp); res.json({ ok: true }); }
  catch { res.status(404).json({ error: 'File not found' }); }
});

/* ── Icon library: admin-managed icons shown in the editor Icons panel ── */
app.get('/api/icons', authMiddleware, (req, res) => {
  const icons = db.prepare(`
    SELECT id, label, url, active, sort_order, created_at
    FROM icon_library
    WHERE active = 1
    ORDER BY sort_order ASC, created_at DESC, id DESC
  `).all();
  const preset_overrides = db.prepare(`
    SELECT icon_key, label, active, sort_order, deleted, updated_at
    FROM icon_preset_overrides
  `).all();
  res.json({ icons, preset_overrides });
});

app.get('/api/admin/preset-icons', adminMiddleware, (req, res) => {
  const overrides = db.prepare(`
    SELECT icon_key, label, active, sort_order, deleted, updated_at
    FROM icon_preset_overrides
  `).all();
  res.json({ overrides });
});

app.put('/api/admin/preset-icons/:key', adminMiddleware, (req, res) => {
  const iconKey = String(req.params.key || '').trim().slice(0, 120);
  if (!iconKey) {
    res.status(400).json({ error: 'Icon key is required.' }); return;
  }
  const label = req.body?.label !== undefined ? String(req.body.label).trim().slice(0, 80) : null;
  const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : 1;
  const sortOrder = req.body?.sort_order !== undefined ? Number.parseInt(req.body.sort_order, 10) : 0;
  const deleted = req.body?.deleted !== undefined ? (req.body.deleted ? 1 : 0) : 0;
  db.prepare(`
    INSERT INTO icon_preset_overrides (icon_key, label, active, sort_order, deleted, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(icon_key) DO UPDATE SET
      label=excluded.label,
      active=excluded.active,
      sort_order=excluded.sort_order,
      deleted=excluded.deleted,
      updated_at=CURRENT_TIMESTAMP
  `).run(iconKey, label, active, Number.isFinite(sortOrder) ? sortOrder : 0, deleted);
  const override = db.prepare(`
    SELECT icon_key, label, active, sort_order, deleted, updated_at
    FROM icon_preset_overrides WHERE icon_key=?
  `).get(iconKey);
  res.json({ override });
});

app.delete('/api/admin/preset-icons/:key', adminMiddleware, (req, res) => {
  const iconKey = String(req.params.key || '').trim().slice(0, 120);
  if (!iconKey) {
    res.status(400).json({ error: 'Icon key is required.' }); return;
  }
  db.prepare(`
    INSERT INTO icon_preset_overrides (icon_key, active, sort_order, deleted, updated_at)
    VALUES (?, 0, 0, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(icon_key) DO UPDATE SET
      active=0,
      deleted=1,
      updated_at=CURRENT_TIMESTAMP
  `).run(iconKey);
  res.json({ ok: true });
});

app.get('/api/admin/icons', adminMiddleware, (req, res) => {
  const icons = db.prepare(`
    SELECT id, label, url, active, sort_order, created_at
    FROM icon_library
    ORDER BY sort_order ASC, created_at DESC, id DESC
  `).all();
  res.json({ icons, total: icons.length });
});

app.post('/api/admin/icons', adminMiddleware, upload.single('icon'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Icon image is required.' }); return;
  }
  const fallbackLabel = path.basename(req.file.originalname || 'Icon', path.extname(req.file.originalname || ''));
  const label = String(req.body?.label || fallbackLabel).trim().slice(0, 80);
  const sortOrder = Number.parseInt(req.body?.sort_order, 10);
  const active = req.body?.active === '0' ? 0 : 1;
  const url = `/uploads/${req.file.filename}`;
  const result = db.prepare(`
    INSERT INTO icon_library (label, url, active, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(label || fallbackLabel || 'Icon', url, active, Number.isFinite(sortOrder) ? sortOrder : 0);
  const icon = db.prepare('SELECT id, label, url, active, sort_order, created_at FROM icon_library WHERE id=?').get(result.lastInsertRowid);
  res.json({ icon });
});

app.put('/api/admin/icons/:id', adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM icon_library WHERE id=?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Icon not found.' }); return;
  }
  const label = req.body?.label !== undefined ? String(req.body.label).trim().slice(0, 80) : existing.label;
  const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;
  const sortOrder = req.body?.sort_order !== undefined ? Number.parseInt(req.body.sort_order, 10) : existing.sort_order;
  db.prepare('UPDATE icon_library SET label=?, active=?, sort_order=? WHERE id=?')
    .run(label || existing.label, active, Number.isFinite(sortOrder) ? sortOrder : existing.sort_order, id);
  const icon = db.prepare('SELECT id, label, url, active, sort_order, created_at FROM icon_library WHERE id=?').get(id);
  res.json({ icon });
});

app.delete('/api/admin/icons/:id', adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const icon = db.prepare('SELECT * FROM icon_library WHERE id=?').get(id);
  if (!icon) {
    res.status(404).json({ error: 'Icon not found.' }); return;
  }
  db.prepare('DELETE FROM icon_library WHERE id=?').run(id);
  if (String(icon.url || '').startsWith('/uploads/')) {
    const fp = path.join(UPLOADS_DIR, path.basename(icon.url));
    try { fs.unlinkSync(fp); } catch {}
  }
  res.json({ ok: true });
});

/* ── GET /api/admin/settings ── */
app.get('/api/admin/settings', adminMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key,value FROM site_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  Object.assign(settings, pricingSettingsFromPricingContent());
  res.json(settings);
});

app.get('/api/public-settings', (req, res) => {
  const keys = [
    'nano_a4_enabled',
    'deleted_deal_tags',
    'home_demo_video_url',
    'help_video_1_url',
    'help_video_2_url',
    'help_video_3_url',
    'help_video_4_url',
    'help_video_5_url',
    'help_video_6_url',
  ];
  const rows = db.prepare(`SELECT key,value FROM site_settings WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys);
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.set('Cache-Control', 'no-store');
  res.json({
    nano_a4_enabled: settings.nano_a4_enabled ?? '1',
    deleted_deal_tags: settings.deleted_deal_tags ?? '[]',
    home_demo_video_url: settings.home_demo_video_url ?? '',
    help_video_1_url: settings.help_video_1_url ?? '',
    help_video_2_url: settings.help_video_2_url ?? '',
    help_video_3_url: settings.help_video_3_url ?? '',
    help_video_4_url: settings.help_video_4_url ?? '',
    help_video_5_url: settings.help_video_5_url ?? '',
    help_video_6_url: settings.help_video_6_url ?? '',
  });
});

app.delete('/api/admin/deal-tags/:key', adminMiddleware, (req, res) => {
  const key = path.basename(String(req.params.key || '').trim()).slice(0, 240);
  if (!key) {
    res.status(400).json({ error: 'Deal tag key is required.' }); return;
  }
  if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(key)) {
    res.status(400).json({ error: 'Unsupported deal tag image type.' }); return;
  }

  const dealTagDirectory = path.resolve(__dirname, '../src/assets/library/deal_tag');
  const dealTagPath = path.resolve(dealTagDirectory, key);
  if (path.dirname(dealTagPath) !== dealTagDirectory) {
    res.status(400).json({ error: 'Invalid deal tag path.' }); return;
  }

  let deletedFile = false;
  try {
    if (fs.existsSync(dealTagPath)) {
      fs.unlinkSync(dealTagPath);
      deletedFile = true;
    }
  } catch (error) {
    console.error('[deal-tags] Could not delete asset:', dealTagPath, error);
    res.status(500).json({ error: 'Could not delete the deal tag image file.' }); return;
  }

  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'deleted_deal_tags'").get();
  let deleted = [];
  try {
    const parsed = JSON.parse(row?.value || '[]');
    deleted = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {}
  if (!deleted.includes(key)) deleted.push(key);
  db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('deleted_deal_tags', ?)").run(JSON.stringify(deleted));
  res.json({ ok: true, deleted_file: deletedFile, deleted_deal_tags: deleted });
});

/* ── PUT /api/admin/settings ── */
app.put('/api/admin/settings', adminMiddleware, async (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key,value) VALUES (?,?)');
  const body = req.body || {};
  const normalizeSettingValue = (key, value) => {
    if (PLAN_PRICE_SETTING_KEYS.has(key)) {
      const parsed = parsePlanAmount(value);
      return parsed === null ? '' : parsed.toFixed(2);
    }
    if (CONCURRENT_LOGIN_SETTING_KEY_SET.has(key)) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return String(Number.isInteger(parsed) ? Math.max(1, Math.min(1000, parsed)) : 1);
    }
    if (AI_COVER_GENERATION_SETTING_KEY_SET.has(key) || LEAFLET_CREATION_SETTING_KEY_SET.has(key)) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return String(Number.isInteger(parsed) ? Math.max(0, Math.min(10000, parsed)) : 0);
    }
    return String(value);
  };
  const tx = db.transaction(entries => {
    for (const [k, v] of entries) upsert.run(k, normalizeSettingValue(k, v));
  });
  tx(Object.entries(body));
  if (Object.prototype.hasOwnProperty.call(body, 'stripe_secret_key')) {
    refreshStripeClient();
  }
  const hasPriceSetting = Object.keys(body).some(key => PLAN_PRICE_SETTING_KEYS.has(key));
  if (hasPriceSetting) {
    const settingsRows = db.prepare('SELECT key,value FROM site_settings').all();
    const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
    const plansValue = syncPlanPriceSettingsToPricingContent(settings);
    if (stripe) {
      try {
        await syncStripePricingFromPlansValue(plansValue);
      } catch (err) {
        console.error('[stripe-sync] pricing sync failed after settings save:', err);
      }
    }
  }
  const rows = db.prepare('SELECT key,value FROM site_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  Object.assign(settings, pricingSettingsFromPricingContent());
  res.json(settings);
});

function readCoverLayoutTemplates() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'cover_layout_templates'").get();
  try {
    const templates = JSON.parse(row?.value || '[]');
    return Array.isArray(templates) ? templates : [];
  } catch {
    return [];
  }
}

function writeCoverLayoutTemplates(templates) {
  db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('cover_layout_templates', ?)").run(JSON.stringify(templates));
}

function decorateCoverLayoutTemplatesForUser(templates, userId) {
  const isAdmin = isAdminUser(userId);
  return templates.map(template => {
    const ownerId = Number(template?.owner_id || 0);
    const ownerRole = template?.owner_role || (ownerId ? 'user' : 'admin');
    const isPlatform = template?.is_platform === true || ownerRole === 'admin' || !ownerId;
    return {
      ...template,
      owner_id: ownerId || undefined,
      owner_role: ownerRole,
      is_platform: isPlatform,
      can_delete: isAdmin || (!!ownerId && ownerId === userId && !isPlatform),
    };
  });
}

function visibleCoverLayoutTemplatesForUser(templates, userId) {
  const isAdmin = isAdminUser(userId);
  if (isAdmin) return templates;
  return templates.filter(template => {
    const ownerId = Number(template?.owner_id || 0);
    const ownerRole = template?.owner_role || (ownerId ? 'user' : 'admin');
    const isPlatform = template?.is_platform === true || ownerRole === 'admin' || !ownerId;
    return isPlatform || (!!ownerId && ownerId === userId);
  });
}

app.get('/api/admin/cover-layout-templates', adminMiddleware, (req, res) => {
  res.json({ templates: decorateCoverLayoutTemplatesForUser(readCoverLayoutTemplates(), req.user.id) });
});

app.post('/api/admin/cover-layout-templates', adminMiddleware, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const layoutId = String(req.body?.layout_id || 'hero-left').trim();
  const templateKey = String(req.body?.template_key || layoutId).trim();
  const styles = req.body?.styles && typeof req.body.styles === 'object' && !Array.isArray(req.body.styles) ? req.body.styles : {};
  const elements = req.body?.elements && typeof req.body.elements === 'object' && !Array.isArray(req.body.elements) ? req.body.elements : undefined;
  if (!name) {
    res.status(400).json({ error: 'Template name is required.' });
    return;
  }
  const template = {
    id: `admin-${Date.now()}`,
    name,
    owner_id: req.user.id,
    owner_role: 'admin',
    is_platform: true,
    layout_id: layoutId,
    template_key: templateKey,
    headline_lines: req.body?.headline_lines || (layoutId === 'strip' ? 1 : layoutId === 'hero-right' || layoutId === 'compact' ? 3 : 2),
    headline_ai_style: req.body?.headline_ai_style || undefined,
    contact_ai_style: req.body?.contact_ai_style || undefined,
    headline_accent_color: req.body?.headline_accent_color || undefined,
    contact_accent_color: req.body?.contact_accent_color || undefined,
    styles,
    elements,
    created_at: new Date().toISOString(),
  };
  const templates = [template, ...readCoverLayoutTemplates()];
  writeCoverLayoutTemplates(templates);
  const decoratedTemplates = decorateCoverLayoutTemplatesForUser(templates, req.user.id);
  res.status(201).json({ template: decoratedTemplates.find(item => item.id === template.id) || template, templates: decoratedTemplates });
});

app.put('/api/admin/cover-layout-templates/:id', adminMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const name = String(req.body?.name || '').trim();
  const layoutId = String(req.body?.layout_id || 'hero-left').trim();
  const templateKey = String(req.body?.template_key || layoutId).trim();
  const styles = req.body?.styles && typeof req.body.styles === 'object' && !Array.isArray(req.body.styles) ? req.body.styles : {};
  const elements = req.body?.elements && typeof req.body.elements === 'object' && !Array.isArray(req.body.elements) ? req.body.elements : undefined;
  if (!name) {
    res.status(400).json({ error: 'Template name is required.' });
    return;
  }
  const templates = readCoverLayoutTemplates();
  const previous = templates.find(template => String(template?.id || '') === id);
  if (!previous) {
    res.status(404).json({ error: 'Template not found.' });
    return;
  }
  const template = {
    ...previous,
    name,
    layout_id: layoutId,
    template_key: templateKey,
    headline_lines: req.body?.headline_lines || previous.headline_lines || (layoutId === 'strip' ? 1 : layoutId === 'hero-right' || layoutId === 'compact' ? 3 : 2),
    headline_ai_style: req.body?.headline_ai_style || undefined,
    contact_ai_style: req.body?.contact_ai_style || undefined,
    headline_accent_color: req.body?.headline_accent_color || undefined,
    contact_accent_color: req.body?.contact_accent_color || undefined,
    styles,
    elements,
  };
  const nextTemplates = templates.map(item => String(item?.id || '') === id ? template : item);
  writeCoverLayoutTemplates(nextTemplates);
  const decoratedTemplates = decorateCoverLayoutTemplatesForUser(nextTemplates, req.user.id);
  res.json({ template: decoratedTemplates.find(item => item.id === id) || template, templates: decoratedTemplates });
});

app.delete('/api/admin/cover-layout-templates/:id', adminMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const templates = readCoverLayoutTemplates();
  const nextTemplates = templates.filter(template => String(template?.id || '') !== id);
  if (nextTemplates.length === templates.length) {
    res.status(404).json({ error: 'Template not found.' });
    return;
  }
  writeCoverLayoutTemplates(nextTemplates);
  res.json({ success: true, templates: nextTemplates });
});

app.get('/api/cover-layout-templates', authMiddleware, (req, res) => {
  const templates = visibleCoverLayoutTemplatesForUser(readCoverLayoutTemplates(), req.user.id);
  res.json({ templates: decorateCoverLayoutTemplatesForUser(templates, req.user.id) });
});

app.post('/api/cover-layout-templates', authMiddleware, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const layoutId = String(req.body?.layout_id || 'hero-left').trim();
  const templateKey = String(req.body?.template_key || layoutId).trim();
  const styles = req.body?.styles && typeof req.body.styles === 'object' && !Array.isArray(req.body.styles) ? req.body.styles : {};
  const elements = req.body?.elements && typeof req.body.elements === 'object' && !Array.isArray(req.body.elements) ? req.body.elements : undefined;
  if (!name) {
    res.status(400).json({ error: 'Template name is required.' });
    return;
  }
  const template = {
    id: `user-${req.user.id}-${Date.now()}`,
    name,
    owner_id: req.user.id,
    owner_role: 'user',
    is_platform: false,
    layout_id: layoutId,
    template_key: templateKey,
    headline_lines: req.body?.headline_lines || (layoutId === 'strip' ? 1 : layoutId === 'hero-right' || layoutId === 'compact' ? 3 : 2),
    headline_ai_style: req.body?.headline_ai_style || undefined,
    contact_ai_style: req.body?.contact_ai_style || undefined,
    headline_accent_color: req.body?.headline_accent_color || undefined,
    contact_accent_color: req.body?.contact_accent_color || undefined,
    styles,
    elements,
    created_at: new Date().toISOString(),
  };
  const templates = [template, ...readCoverLayoutTemplates()];
  writeCoverLayoutTemplates(templates);
  const visibleTemplates = visibleCoverLayoutTemplatesForUser(templates, req.user.id);
  const decoratedTemplates = decorateCoverLayoutTemplatesForUser(visibleTemplates, req.user.id);
  res.status(201).json({ template: decoratedTemplates.find(item => item.id === template.id) || template, templates: decoratedTemplates });
});

app.put('/api/cover-layout-templates/:id', authMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const name = String(req.body?.name || '').trim();
  const layoutId = String(req.body?.layout_id || 'hero-left').trim();
  const templateKey = String(req.body?.template_key || layoutId).trim();
  const styles = req.body?.styles && typeof req.body.styles === 'object' && !Array.isArray(req.body.styles) ? req.body.styles : {};
  const elements = req.body?.elements && typeof req.body.elements === 'object' && !Array.isArray(req.body.elements) ? req.body.elements : undefined;
  if (!name) {
    res.status(400).json({ error: 'Template name is required.' });
    return;
  }
  const isAdmin = isAdminUser(req.user.id);
  const templates = readCoverLayoutTemplates();
  const previous = templates.find(template => String(template?.id || '') === id);
  if (!previous) {
    res.status(404).json({ error: 'Template not found.' });
    return;
  }
  const ownerId = Number(previous.owner_id || 0);
  const ownerRole = previous.owner_role || (ownerId ? 'user' : 'admin');
  const isPlatform = previous.is_platform === true || ownerRole === 'admin' || !ownerId;
  if (!isAdmin && (!ownerId || ownerId !== req.user.id || isPlatform)) {
    res.status(403).json({ error: 'You can only update templates you created.' });
    return;
  }
  const template = {
    ...previous,
    name,
    layout_id: layoutId,
    template_key: templateKey,
    headline_lines: req.body?.headline_lines || previous.headline_lines || (layoutId === 'strip' ? 1 : layoutId === 'hero-right' || layoutId === 'compact' ? 3 : 2),
    headline_ai_style: req.body?.headline_ai_style || undefined,
    contact_ai_style: req.body?.contact_ai_style || undefined,
    headline_accent_color: req.body?.headline_accent_color || undefined,
    contact_accent_color: req.body?.contact_accent_color || undefined,
    styles,
    elements,
  };
  const nextTemplates = templates.map(item => String(item?.id || '') === id ? template : item);
  writeCoverLayoutTemplates(nextTemplates);
  const visibleTemplates = visibleCoverLayoutTemplatesForUser(nextTemplates, req.user.id);
  const decoratedTemplates = decorateCoverLayoutTemplatesForUser(visibleTemplates, req.user.id);
  res.json({ template: decoratedTemplates.find(item => item.id === id) || template, templates: decoratedTemplates });
});

app.delete('/api/cover-layout-templates/:id', authMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const isAdmin = isAdminUser(req.user.id);
  const templates = readCoverLayoutTemplates();
  const target = templates.find(template => String(template?.id || '') === id);
  if (!target) {
    res.status(404).json({ error: 'Template not found.' });
    return;
  }
  const ownerId = Number(target.owner_id || 0);
  const ownerRole = target.owner_role || (ownerId ? 'user' : 'admin');
  const isPlatform = target.is_platform === true || ownerRole === 'admin' || !ownerId;
  if (!isAdmin && (!ownerId || ownerId !== req.user.id || isPlatform)) {
    res.status(403).json({ error: 'You can only delete templates you created.' });
    return;
  }
  const nextTemplates = templates.filter(template => String(template?.id || '') !== id);
  writeCoverLayoutTemplates(nextTemplates);
  res.json({ success: true, templates: decorateCoverLayoutTemplatesForUser(nextTemplates, req.user.id) });
});

/* ── GET /api/seo/:pageKey ── public, used by frontend ── */
app.get('/api/seo/:pageKey', (req, res) => {
  const pageKey = String(req.params.pageKey || '');
  const row = db.prepare('SELECT * FROM seo_pages WHERE page_key=? OR page_key=?').get(pageKey, pageKey.replace(/-/g, '_'));
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

/* ── GET /api/admin/seo ── list all SEO pages ── */
app.get('/api/admin/seo', adminMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM seo_pages ORDER BY page_name ASC').all();
  res.json(rows);
});

/* ── PUT /api/admin/seo/:id ── update one SEO page ── */
app.put('/api/admin/seo/:id', adminMiddleware, (req, res) => {
  const { title, description, keywords, og_title, og_description, og_image, canonical_url, robots } = req.body;
  db.prepare(`
    UPDATE seo_pages SET
      title=?, description=?, keywords=?, og_title=?, og_description=?,
      og_image=?, canonical_url=?, robots=?, updated_at=datetime('now')
    WHERE id=?
  `).run(title??'', description??'', keywords??'', og_title??'', og_description??'', og_image??'', canonical_url??'', robots??'index, follow', Number(req.params.id));
  const updated = db.prepare('SELECT * FROM seo_pages WHERE id=?').get(Number(req.params.id));
  res.json(updated);
});
app.get('/api/admin/check', (req, res) => {
  const hasAdmin = !!db.prepare('SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1').get(PRIMARY_ADMIN_EMAIL);
  res.json({ hasAdmin });
});
app.get('/api/admin/me', adminMiddleware, (req, res) => {
  const user = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(req.user.id);
  res.json(user);
});

/* ── POST /api/admin/setup ── promote only the primary admin account ── */
app.post('/api/admin/setup', authMiddleware, (req, res) => {
  const self = db.prepare('SELECT id,email FROM users WHERE id=?').get(req.user.id);
  const isPrimaryAdmin = String(self?.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
  if (!isPrimaryAdmin) {
    res.status(403).json({ error: 'This page is not available for your account.' }); return;
  }
  db.prepare('UPDATE users SET role=? WHERE lower(email) <> lower(?)').run('user', PRIMARY_ADMIN_EMAIL);
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(req.user.id);
  const user = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(req.user.id);
  res.json({ ok: true, user });
});

/* ══════════════════════════════════════════════════════════════════
   BACKUP API ROUTES
═══════════════════════════════════════════════════════════════════ */

/* GET  /api/admin/backup/list ── list all backup files */
app.get('/api/admin/backup/list', adminMiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db.gz'))
      .sort()
      .reverse()
      .map(name => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, name));
        return { name, size: stat.size, created_at: stat.mtime.toISOString() };
      });
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/admin/backup/create ── trigger manual backup */
app.post('/api/admin/backup/create', adminMiddleware, async (req, res) => {
  try {
    const name = await createBackup();
    const stat  = fs.statSync(path.join(BACKUPS_DIR, name));
    res.json({ ok: true, name, size: stat.size, created_at: stat.mtime.toISOString() });
  } catch (e) {
    console.error('[backup create]', e);
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/admin/backup/import -- restore uploaded database backup */
app.post('/api/admin/backup/import', adminMiddleware, backupImportUpload.single('backup'), async (req, res) => {
  const cleanup = [];
  try {
    if (IS_PRODUCTION) {
      throw Object.assign(productionSafetyError('Database backup import/restore'), { statusCode: 403 });
    }
    if (!req.file) {
      res.status(400).json({ error: 'Backup file is required.' });
      return;
    }

    const importedDb = zlib.gunzipSync(req.file.buffer);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempDb = path.join(BACKUPS_DIR, `_import_${stamp}.db`);
    const restoreDb = path.join(BACKUPS_DIR, `_restore_${stamp}.db`);
    const previousDb = path.join(BACKUPS_DIR, `_previous_${stamp}.db`);
    cleanup.push(tempDb);
    fs.writeFileSync(tempDb, importedDb, { mode: 0o600 });

    const imported = new Database(tempDb, { readonly: true, fileMustExist: true });
    try {
      const requiredTables = ['users', 'leaflets', 'leaflet_products', 'site_settings'];
      const rows = imported.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
      `).all(...requiredTables);
      const found = new Set(rows.map(r => r.name));
      const missing = requiredTables.filter(name => !found.has(name));
      if (missing.length) {
        throw Object.assign(new Error(`Invalid backup. Missing table: ${missing[0]}`), { statusCode: 422 });
      }
      const quickCheck = imported.pragma('quick_check');
      if (!quickCheck.some(row => Object.values(row).includes('ok'))) {
        throw Object.assign(new Error('Invalid backup. SQLite quick check failed.'), { statusCode: 422 });
      }
    } finally {
      imported.close();
    }

    const safetyBackup = await createBackup();
    fs.copyFileSync(tempDb, restoreDb);
    cleanup.push(restoreDb);
    db.close();
    if (fs.existsSync(DB_PATH)) fs.renameSync(DB_PATH, previousDb);
    for (const suffix of ['', '-wal', '-shm']) {
      const target = `${DB_PATH}${suffix}`;
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.renameSync(restoreDb, DB_PATH);
    try { if (fs.existsSync(previousDb)) fs.unlinkSync(previousDb); } catch {}
    cleanup.forEach(file => { try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {} });

    res.json({
      ok: true,
      restored: true,
      safety_backup: safetyBackup,
      message: 'Backup imported. Server is restarting to load restored data.',
    });
    setTimeout(() => process.exit(0), 800);
  } catch (e) {
    cleanup.forEach(file => { try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {} });
    console.error('[backup import]', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to import backup.' });
  }
});

/* GET  /api/admin/backup/download/:name ── stream backup file */
app.get('/api/admin/backup/download/:name', adminMiddleware, (req, res) => {
  const name = path.basename(req.params.name);
  if (!name.startsWith('backup-') || !name.endsWith('.db.gz')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(BACKUPS_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Content-Type', 'application/gzip');
  fs.createReadStream(filePath).pipe(res);
});

/* DELETE /api/admin/backup/:name ── delete a backup */
app.delete('/api/admin/backup/:name', adminMiddleware, (req, res) => {
  const name = path.basename(req.params.name);
  if (!name.startsWith('backup-') || !name.endsWith('.db.gz')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(BACKUPS_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

/* GET  /api/admin/backup/settings ── get auto-backup config */
app.get('/api/admin/backup/settings', adminMiddleware, (req, res) => {
  res.json({
    auto_enabled: getSetting('backup_auto_enabled') || '0',
    auto_hours:   getSetting('backup_auto_hours')   || '24',
    max_keep:     getSetting('backup_max_keep')      || '20',
  });
});

/* PUT  /api/admin/backup/settings ── save auto-backup config + restart scheduler */
app.put('/api/admin/backup/settings', adminMiddleware, (req, res) => {
  const { auto_enabled, auto_hours, max_keep } = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key,value) VALUES (?,?)');
  if (auto_enabled !== undefined) upsert.run('backup_auto_enabled', String(auto_enabled));
  if (auto_hours   !== undefined) upsert.run('backup_auto_hours',   String(auto_hours));
  if (max_keep     !== undefined) upsert.run('backup_max_keep',      String(max_keep));
  startAutoBackup();
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════
   PAGE CONTENT CMS
   ══════════════════════════════════════════════════════════════ */

/* helper: build nested object { section: { field: value } } */
function repairMojibakeText(value) {
  return String(value)
    .replace(/\u00e2\u20ac\u201d/g, '-')
    .replace(/\u00e2\u20ac\u00a6/g, '...')
    .replace(/\u00e2\u2020\u2019/g, '->')
    .replace(/\u00c2\u00b7/g, '-')
    .replace(/\u00c3\u2014/g, 'x');
}

function buildPageContent(rows) {
  const out = {};
  for (const r of rows) {
    if (!out[r.section]) out[r.section] = {};
    out[r.section][r.field] = repairMojibakeText(r.value);
  }
  return out;
}

/* GET /api/pages/:page  (public — no auth) */
app.get('/api/pages/:page', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = db.prepare('SELECT section,field,value FROM page_content WHERE page=?').all(req.params.page);
  res.json(buildPageContent(rows));
});

/* GET /api/admin/pages/:page  (admin — raw rows for editor) */
app.get('/api/admin/pages/:page', adminMiddleware, (req, res) => {
  const rows = db.prepare('SELECT section,field,value FROM page_content WHERE page=?').all(req.params.page);
  res.json(buildPageContent(rows));
});

/* PUT /api/admin/pages/:page  (admin — upsert batch) */
app.put('/api/admin/pages/:page', adminMiddleware, async (req, res) => {
  const page = req.params.page;
  const entries = req.body; // { section: { field: value } }
  if (typeof entries !== 'object') return res.status(400).json({ error: 'Invalid body' });
  let stripeSync = null;
  if (page === 'pricing' && entries?.plans && Object.prototype.hasOwnProperty.call(entries.plans, 'items')) {
    try {
      getPricingDefinitionsFromPlansValue(String(entries.plans.items));
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Pricing changes were not saved because the pricing data is invalid.',
      });
    }
  }
  const upsert = db.prepare('INSERT OR REPLACE INTO page_content (page,section,field,value) VALUES (?,?,?,?)');
  const tx = db.transaction(() => {
    for (const [section, fields] of Object.entries(entries)) {
      if (typeof fields !== 'object') continue;
      for (const [field, value] of Object.entries(fields)) {
        upsert.run(page, section, field, repairMojibakeText(value));
      }
    }
  });
  tx();
  if (page === 'pricing' && entries?.plans && Object.prototype.hasOwnProperty.call(entries.plans, 'items')) {
    if (stripe) {
      try {
        stripeSync = await syncStripePricingFromPlansValue(String(entries.plans.items));
      } catch (err) {
        console.error('[stripe-sync] pricing sync failed after content save:', err);
        stripeSync = {
          ok: false,
          warning: err instanceof Error ? err.message : 'Pricing was saved, but Stripe checkout prices were not synced.',
        };
      }
    } else {
      stripeSync = {
        ok: false,
        skipped: true,
        warning: 'Pricing was saved, but Stripe checkout prices were not synced because STRIPE_SECRET_KEY is not configured.',
      };
    }
  }
  res.json({ ok: true, stripeSync });
});

/* ══════════════════════════════════════════════════════════════════
   HELP CENTER PUBLIC API
═══════════════════════════════════════════════════════════════════ */

/* GET /api/help-groups  — public, returns all groups + articles */
app.get('/api/help-groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM help_article_groups ORDER BY sort_order ASC, id ASC').all();
  const articles = db.prepare('SELECT * FROM help_articles ORDER BY sort_order ASC, id ASC').all();
  const result = groups.map(g => ({
    ...g,
    articles: articles.filter(a => a.group_id === g.id),
  }));
  res.json({ groups: result });
});

/* ══════════════════════════════════════════════════════════════════
   HELP CENTER ADMIN API
═══════════════════════════════════════════════════════════════════ */

/* GET /api/admin/help-groups */
app.get('/api/admin/help-groups', adminMiddleware, (req, res) => {
  const groups = db.prepare('SELECT * FROM help_article_groups ORDER BY sort_order ASC, id ASC').all();
  const articles = db.prepare('SELECT * FROM help_articles ORDER BY sort_order ASC, id ASC').all();
  const result = groups.map(g => ({
    ...g,
    articles: articles.filter(a => a.group_id === g.id),
  }));
  res.json({ groups: result });
});

/* POST /api/admin/help-groups */
app.post('/api/admin/help-groups', adminMiddleware, (req, res) => {
  const { icon = '📄', label, sort_order = 0 } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  const r = db.prepare('INSERT INTO help_article_groups (icon, label, sort_order) VALUES (?,?,?)').run(icon, label, sort_order);
  res.json(db.prepare('SELECT * FROM help_article_groups WHERE id=?').get(r.lastInsertRowid));
});

/* PUT /api/admin/help-groups/:id */
app.put('/api/admin/help-groups/:id', adminMiddleware, (req, res) => {
  const { icon, label, sort_order } = req.body;
  const id = Number(req.params.id);
  const g = db.prepare('SELECT * FROM help_article_groups WHERE id=?').get(id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE help_article_groups SET icon=?, label=?, sort_order=? WHERE id=?')
    .run(icon ?? g.icon, label ?? g.label, sort_order ?? g.sort_order, id);
  res.json(db.prepare('SELECT * FROM help_article_groups WHERE id=?').get(id));
});

/* DELETE /api/admin/help-groups/:id */
app.delete('/api/admin/help-groups/:id', adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM help_articles WHERE group_id=?').run(id);
  db.prepare('DELETE FROM help_article_groups WHERE id=?').run(id);
  res.json({ ok: true });
});

/* POST /api/admin/help-articles */
app.post('/api/admin/help-articles', adminMiddleware, (req, res) => {
  const { group_id, title, desc = '', content = '', image_url = null, sort_order = 0 } = req.body;
  if (!group_id || !title) return res.status(400).json({ error: 'group_id and title are required' });
  const r = db.prepare('INSERT INTO help_articles (group_id, title, desc, content, image_url, sort_order) VALUES (?,?,?,?,?,?)').run(group_id, title, desc, content, image_url, sort_order);
  res.json(db.prepare('SELECT * FROM help_articles WHERE id=?').get(r.lastInsertRowid));
});

/* PUT /api/admin/help-articles/:id */
app.put('/api/admin/help-articles/:id', adminMiddleware, (req, res) => {
  const { title, desc, content, image_url, sort_order, group_id } = req.body;
  const id = Number(req.params.id);
  const a = db.prepare('SELECT * FROM help_articles WHERE id=?').get(id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE help_articles SET group_id=?, title=?, desc=?, content=?, image_url=?, sort_order=? WHERE id=?')
    .run(group_id ?? a.group_id, title ?? a.title, desc ?? a.desc, content ?? a.content, image_url !== undefined ? image_url : a.image_url, sort_order ?? a.sort_order, id);
  res.json(db.prepare('SELECT * FROM help_articles WHERE id=?').get(id));
});

/* DELETE /api/admin/help-articles/:id */
app.delete('/api/admin/help-articles/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM help_articles WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Serve the Vite frontend when deployed as a single Hostinger Node.js app.
const DIST_DIR = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  const DIST_ASSETS_DIR = ['app-assets', 'assets']
    .map(dir => path.join(DIST_DIR, dir))
    .find(dir => fs.existsSync(dir));
  // Layouts saved during development may contain Vite source paths. Resolve
  // those paths to the fingerprinted production assets emitted in dist.
  app.get('/src/assets/library/deal_tag/:filename', (req, res, next) => {
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename !== req.params.filename) return next();
    const ext = path.extname(filename);
    const stem = path.basename(filename, ext);
    if (!DIST_ASSETS_DIR) return next();
    const match = fs.readdirSync(DIST_ASSETS_DIR).find(name =>
      name.startsWith(`${stem}-`) && path.extname(name).toLowerCase() === ext.toLowerCase()
    );
    if (!match) return next();
    res.sendFile(path.join(DIST_ASSETS_DIR, match));
  });
  if (DIST_ASSETS_DIR) {
    app.get('/assets/:filename', (req, res, next) => {
      const filename = path.basename(req.params.filename || '');
      if (!filename || filename !== req.params.filename) return next();

      const exactPath = path.join(DIST_ASSETS_DIR, filename);
      if (fs.existsSync(exactPath)) return next();

      const ext = path.extname(filename).toLowerCase();
      if (!/^index-[A-Za-z0-9_-]+\.(css|js)$/.test(filename) || !['.css', '.js'].includes(ext)) {
        return next();
      }

      const current = fs.readdirSync(DIST_ASSETS_DIR).find(name =>
        /^index-[A-Za-z0-9_-]+\.(css|js)$/.test(name) && path.extname(name).toLowerCase() === ext
      );
      if (!current) return next();

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(DIST_ASSETS_DIR, current));
    });
    app.use('/app-assets', express.static(DIST_ASSETS_DIR, {
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }));
    app.use('/assets', express.static(DIST_ASSETS_DIR, {
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }));
  }
  app.use(express.static(DIST_DIR, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    },
  }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`LeafletAI running on port ${PORT}`);
  logSmtpStartupStatus();
  startSubscriptionExpiryScheduler();
});
