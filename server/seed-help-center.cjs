/**
 * Seed script — imports all hardcoded Help Center content into the DB.
 * Safe to run multiple times: only inserts if tables are empty.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'leafletai.db');
const db = new Database(DB_PATH);

// Ensure tables exist
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
`);

const existing = db.prepare('SELECT COUNT(*) as n FROM help_article_groups').get();
if (existing.n > 0) {
  console.log(`DB already has ${existing.n} group(s). Skipping seed.`);
  console.log('To re-seed, run:  DELETE FROM help_articles; DELETE FROM help_article_groups;');
  process.exit(0);
}

const insertGroup   = db.prepare('INSERT INTO help_article_groups (icon, label, sort_order) VALUES (?, ?, ?)');
const insertArticle = db.prepare('INSERT INTO help_articles (group_id, title, desc, content, sort_order) VALUES (?, ?, ?, ?, ?)');

const GROUPS = [
  {
    icon: '🚀', label: 'Getting Started',
    articles: [
      {
        title: 'Create your first leaflet',
        desc: 'Step-by-step guide from sign-up to your first published leaflet.',
        content: `## Create Your First Leaflet
![Leaflet editor overview](https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=680&q=80)

!!tip: You can create your first leaflet in under 5 minutes — no design skills needed.

::step 1:: Sign up or log in
Visit the home page and click **Get Started**. Create a free account with your email address.

::step 2:: Click "Create Leaflet"
From the dashboard, click **+ Create Leaflet**. Give it a name and choose your language mode (single or bilingual).

::step 3:: Add products
Click **+ Add Product** in the toolbar to open the product form. Fill in the name, price, image URL, and origin.

::step 4:: Customise the design
Use the left sidebar to configure the page background, header, footer, and card layout.

::step 5:: Export
Click **Export PDF** to download a print-ready file or **Export Flipbook** for an interactive version.

!!note: Your leaflet auto-saves as you work — no manual save button needed for the product list.`,
      },
      {
        title: 'Overview of the editor',
        desc: 'Understand the sidebar, canvas, and toolbar layout.',
        content: `## Editor Overview
![Editor screenshot](https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=680&q=80)

The LeafletAI editor is split into three main areas:

>>> 🗂️ ||| Left Sidebar — All design controls: type, page layout, header/footer, cover pages, price settings.
>>> 🖼️ ||| Main Canvas — Live A4 pages with product cards. Scroll, drag, and see changes instantly.
>>> ⚙️ ||| Toolbar (top) — Action buttons: Duplicate, + Add Product, Customize Card Layout, Export PDF, Export Flipbook, Convert to Book.

---

!!tip: Collapse sidebar sections you don't need to keep your workspace clean.`,
      },
      {
        title: 'Choosing a template',
        desc: 'Browse and apply pre-built templates for faster design.',
        content: `## Choosing a Template
![Card templates](https://images.unsplash.com/photo-1558655146-d09347e92766?w=680&q=80)

Templates give you a ready-made card layout so you don't have to start from scratch.

::step 1:: Open the card editor
Click **Customize Card Layout** in the toolbar.

::step 2:: Click Templates
Click the **Templates** button in the bottom toolbar of the editor.

::step 3:: Browse and preview
Click any template to preview it live on the card canvas.

::step 4:: Apply
Click **Apply** to use it as your base layout.

!!tip: You can still adjust individual elements after applying a template. Templates don't lock your design.
!!warning: Applying a template overwrites your current element positions and styles. Save a duplicate first if you want to keep your current layout.`,
      },
      {
        title: 'Account setup & profile',
        desc: 'Set your name, logo, and default brand colours.',
        content: `## Account Setup & Profile
![Settings page](https://images.unsplash.com/photo-1529119368496-2dfda6ec2804?w=680&q=80)

>>> 👤 ||| Profile — Update your display name and email from Settings.
>>> 🔒 ||| Security — Change your password or enable 2FA.
>>> 🗑️ ||| Danger Zone — Permanently delete your account and all data.

---

**Update your profile:**
- Click your avatar or name in the top-right navigation.
- Select **Settings** from the dropdown.
- Edit your name, email, and notification preferences.

**Change your password:**
Go to **Settings → Security** and click **Change Password**.

!!warning: Account deletion is permanent and cannot be undone. All leaflets and data will be erased.`,
      },
    ],
  },
  {
    icon: '📦', label: 'Import & Products',
    articles: [
      {
        title: 'Import products via Excel / CSV',
        desc: 'Download the template, fill in your data, and bulk-import in seconds.',
        content: `## Import Products via Excel / CSV
![CSV import flow](https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=680&q=80)

!!tip: Importing 100 products takes less than 30 seconds with the CSV workflow.

::step 1:: Download the template
In the leaflet editor click **Import CSV** to download the official template file.

::step 2:: Fill in your data
Open the file in Excel or Google Sheets. Each row is one product.

| Column | Required | Description |
|---|---|---|
| product_name_lan1 | ✓ | Primary product name |
| current_price | ✓ | Selling price (numbers only) |
| product_img_url | ✓ | Direct image URL |
| old_price | — | Original price for discount badge |
| origin_lan1 | — | Country of origin |

::step 3:: Upload the file
Save as CSV and click **Import CSV** again. Select your file.

::step 4:: Review
Products appear on the canvas immediately. Drag to reorder or click to edit.

!!warning: Prices must be plain numbers — no currency symbols. Use \`9.99\` not \`$9.99\`.`,
      },
      {
        title: 'Add a product manually',
        desc: 'Use the Add Product button to enter name, price, image, and URL.',
        content: `## Add a Product Manually
![Add product form](https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=680&q=80)

::step 1:: Open the form
Click **+ Add Product** in the toolbar.

::step 2:: Fill in details
- **Product Name (Lang 1)** — required
- **Current Price** — required
- **Image URL** — paste a link or upload directly

::step 3:: Optional fields
Add a second language name, old price, origin country, and product URL.

::step 4:: Save
Click **Save**. The card appears on the current page instantly.

!!note: If you add more products than fit on one page, new pages are created automatically.`,
      },
      {
        title: 'Edit or delete a product',
        desc: 'Click any product card in the editor to open the edit modal.',
        content: `## Edit or Delete a Product

>>> ✏️ ||| Edit — Click the pencil icon on hover to open the product form with existing values pre-filled.
>>> 🗑️ ||| Delete — Click the trash icon and confirm. Deletion cannot be undone.
>>> ↕️ ||| Reorder — Drag any product card to a new position. Order is preserved in exports.

---

**Edit steps:**
::step 1:: Hover over the product card to reveal action icons.
::step 2:: Click the **pencil** icon to open the edit form.
::step 3:: Make your changes and click **Save**.

!!warning: Deleting a product is permanent. There is no undo.`,
      },
      {
        title: 'Supported image formats',
        desc: 'JPEG, PNG, WebP, and SVG up to 20 MB per image.',
        content: `## Supported Image Formats
![Product images](https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=680&q=80)

| Format | Extension | Best For |
|---|---|---|
| JPEG | .jpg / .jpeg | Photos |
| PNG | .png | Transparency |
| WebP | .webp | Modern, smaller size |
| SVG | .svg | Vector logos, icons |

>>> 📏 ||| Max file size — 20 MB per image upload.
>>> 🌐 ||| Hosted URLs — Paste any publicly accessible direct image URL.
>>> 🖨️ ||| Print quality — Use 300 DPI or higher for crisp PDF output.

!!tip: WebP gives the best balance of quality and file size for screen display. Use high-res JPEG or PNG for print exports.`,
      },
      {
        title: 'Fix import errors',
        desc: 'Understand validation messages and correct your spreadsheet data.',
        content: `## Fix Import Errors

When an import fails, the editor shows a validation summary.

| Error | Cause | Fix |
|---|---|---|
| Missing required column | Header name is wrong | Match exactly to the template |
| Invalid price format | Price has letters/symbols | Use plain numbers: \`9.99\` |
| Image URL unreachable | Broken or private link | Use a public direct image URL |
| Encoding error | Special characters | Save CSV as UTF-8 |

!!tip: Click **Show errors** in the import dialog for a row-by-row breakdown.
!!note: Rows with errors are skipped; valid rows are imported successfully.
!!success: After fixing errors, simply re-upload the corrected CSV — no need to start over.`,
      },
    ],
  },
  {
    icon: '🎨', label: 'Design & Layout',
    articles: [
      {
        title: 'Customize card layout',
        desc: 'Add shapes, drag and resize elements, and set borders, shadows, and radius.',
        content: `## Customize Card Layout
![Card customizer](https://images.unsplash.com/photo-1561070791-2526d30994b5?w=680&q=80)

!!tip: Click any element directly on the live preview to select it — no need to use the dropdown.

>>> 🗂️ ||| Left Panel — Element Inspector: typography, background, border, shadow, padding.
>>> 🖼️ ||| Center Panel — Live Preview: drag elements, use arrow keys for precision, Shift+drag for straight lines.
>>> 🔧 ||| Right Panel — Alignment tools, z-order, group/ungroup, lock/unlock.

---

**Key controls per element:**
- Background: solid colour or gradient
- Typography: font size, color, weight, style, alignment
- Border: width, color, style (per-side or uniform), radius
- Drop shadow
- Width & Height (px)

**Add shapes and enhance your design:**
- Rectangle: Draw a basic rectangular shape.
- Triangle: Create a triangle shape by selecting three points.
- Ellipse: Add an ellipse, oval, or circle to the layout.
- Polygon: Draw a custom polygon by selecting multiple points.
- Star: Add a star-shaped figure to your card.
- Line: Create a straight line or segment with adjustable length and thickness.

Once a shape is selected, resize, rotate, and position it anywhere on the card for precise placement.

::step 1:: Click **Customize Card Layout** in the toolbar.
::step 2:: Select an element from the dropdown or click it on the preview.
::step 3:: Adjust controls in the left inspector panel.
::step 4:: Click **Save Changes** to apply to all cards.

!!warning: Save Changes applies the layout globally to all product cards in the leaflet.`,
      },
      {
        title: 'Change fonts and typography',
        desc: 'Use the Typography sidebar to pick fonts and control size, weight, and alignment.',
        content: `## Fonts & Typography
![Typography controls](https://images.unsplash.com/photo-1455390582262-044cdead277a?w=680&q=80)

**In the card layout editor, select any element to access:**

>>> 🔤 ||| Font Size — Set size in px using the number input or slider.
>>> 🎨 ||| Color — Click the colour swatch to open the colour picker.
>>> B ||| Bold — Toggle bold weight on the selected element.
>>> I ||| Italic — Toggle italic style.
>>> ⬅↔➡ ||| Alignment — Left, Center, or Right horizontal alignment.
>>> ⬆⬛⬇ ||| V-Align — Top, Middle, or Bottom vertical alignment.

---

| Style | Effect |
|---|---|
| N | Normal |
| B | Bold |
| I | Italic |
| BI | Bold Italic |
| Aa | Sentence case |
| AA | ALL CAPS |
| aa | lowercase |
| Tt | Title Case |

!!tip: Font family is set globally in the left sidebar under **Type**. It applies to all text elements.`,
      },
      {
        title: 'Set page background & colours',
        desc: 'Apply solid colours or gradients to pages, sections, and cards.',
        content: `## Page Background & Colours
![Background gradient](https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=680&q=80)

>>> 🎨 ||| Page Background — In **Page Layout** sidebar section, click the colour swatch.
>>> 🃏 ||| Card Background — In **Customize Card Layout**, select the Card element.
>>> 📰 ||| Header / Footer — Expand Header or Footer section and set the background colour.

---

**Gradient setup:**
::step 1:: Toggle to **Gradient** mode in the colour picker.
::step 2:: Set the start colour and end colour.
::step 3:: Adjust the angle (0° = left-to-right, 90° = top-to-bottom).

!!tip: Dark gradient backgrounds (e.g. deep purple → navy) combined with white text create a premium look for promotional leaflets.`,
      },
      {
        title: 'Add a cover page and back cover',
        desc: 'Upload custom images for the front and back cover of your leaflet.',
        content: `## Cover Page & Back Cover
![Cover page example](https://images.unsplash.com/photo-1512820790803-83ca734da794?w=680&q=80)

>>> 📖 ||| First Page — Upload a full-page image as the front cover.
>>> 📕 ||| Last Page — Upload a back cover image.

---

::step 1:: In the left sidebar expand **First Page** or **Last Page**.
::step 2:: Toggle **Show first / last page** on.
::step 3:: Click **Upload Image** and select your cover (recommended: 2480 × 3508 px for A4).

!!note: Cover and back pages are included in all exports — PDF, Flipbook, and Printable Book.
!!tip: Design your cover in Canva or Figma at A4 size (210 × 297 mm) and export as PNG for best results.`,
      },
      {
        title: 'Show or hide the header / footer',
        desc: 'Toggle header and footer visibility per page.',
        content: `## Show / Hide Header & Footer

>>> 👁️ ||| Global toggle — Hide or show header/footer across all pages at once.
>>> 📄 ||| Per-page toggle — Override visibility for just the current page.

---

**Global toggle:**
In the left sidebar, expand **Header** or **Footer** and use the **Show text** toggle.

**Per-page toggle:**
::step 1:: Navigate to the page you want to change.
::step 2:: Click the visibility toggle in the Header or Footer section.
::step 3:: Choose **This page only** or **All pages**.

!!success: When a header or footer is hidden, the product grid automatically expands to fill the freed space.
!!tip: Hide the header on the cover page and the first product page for a cleaner, more professional look.`,
      },
      {
        title: 'Origin country flags',
        desc: 'Enable the flag icon on product cards and adjust its size and position.',
        content: `## Origin Country Flags
![Country flags](https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=680&q=80)

**How flags work:**
When you enter a country name in the *Origin* field, LeafletAI automatically finds the matching flag emoji — even for non-English names.

>>> 🌍 ||| Auto-match — Type "Jordan", "الأردن", or "Jordanien" — all resolve to 🇯🇴.
>>> 🔽 ||| Manual select — If auto-match fails, pick the flag from the country dropdown.
>>> 🎨 ||| Customise — Control size, color, background, border, and position in Customize Card Layout.

---

!!note: Only one flag is shown per product card, linked to the primary origin field.
!!tip: Drag the Origin Flag element in Customize Card Layout to place it anywhere on the card — top-left corner badges look great for retail leaflets.`,
      },
    ],
  },
  {
    icon: '📤', label: 'Export & Share',
    articles: [
      {
        title: 'Export to PDF',
        desc: 'Generate a print-ready, high-resolution PDF from your leaflet.',
        content: `## Export to PDF
![PDF export](https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=680&q=80)

::step 1:: Open your leaflet in the editor.
::step 2:: Click **Export PDF** in the toolbar.
::step 3:: The PDF is generated and downloaded automatically.

---

**What's included:**

>>> 📄 ||| All A4 pages with product cards in your chosen layout.
>>> 🖼️ ||| Cover page and back cover (if enabled).
>>> 📰 ||| Header and footer as configured per page.

!!tip: For best print quality use images at 300 DPI or higher and check all product images are visible before exporting.
!!warning: Broken or private image URLs appear as grey placeholders in the PDF. Verify all images load before exporting.`,
      },
      {
        title: 'Export as a flipbook',
        desc: 'Create an interactive flipbook with realistic page-turn animations.',
        content: `## Export as a Flipbook
![Flipbook preview](https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=680&q=80)

!!success: The flipbook export creates a polished, interactive presentation of your leaflet — perfect for sharing digitally.

::step 1:: Click **Export Flipbook** in the toolbar.
::step 2:: The file downloads as a PDF with embedded flipbook navigation.
::step 3:: Open in Adobe Acrobat, Chrome, or Edge to use page-flip navigation.

---

>>> 📖 ||| Page-turn animation — Realistic flip effect between pages.
>>> 🗺️ ||| Thumbnail navigator — Jump to any page instantly.
>>> 🔍 ||| Zoom — Pinch or scroll to zoom in on product details.

!!note: Interactive flipbook features work best in PDF readers that support JavaScript. When printed, it behaves as a standard PDF.`,
      },
      {
        title: 'Convert to printable book',
        desc: 'Reflow your pages into a formatted print-ready booklet or catalog.',
        content: `## Convert to Printable Book
![Printable book](https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=680&q=80)

!!tip: Use this feature to produce professional catalogs, brochures, and booklets directly from your leaflet pages.

::step 1:: Click **Convert to Book** in the toolbar.
::step 2:: In the Book Builder, select and reorder pages using drag and drop.
::step 3:: Choose a format preset.
::step 4:: Configure print settings (margins, bleed, page numbers).
::step 5:: Preview, then click Export.

---

**Available formats:**

| Format | Use Case |
|---|---|
| A4 Portrait | Standard catalogs |
| A4 Landscape | Wide-format leaflets |
| A5 Booklet | Compact brochures |
| Square Catalog | Social / product catalogs |
| Magazine Layout | Retail magazines |

!!note: Booklet mode automatically reorders pages for saddle-stitch folded printing.`,
      },
      {
        title: 'Fix blank export issues',
        desc: 'Troubleshoot common causes of blank or missing-content exports.',
        content: `## Fix Blank Export Issues

!!warning: If your PDF has blank pages or missing images, work through these steps before contacting support.

>>> ⏳ ||| Wait for images — Scroll all pages and let every image fully load before exporting.
>>> 🔗 ||| Check URLs — Open each product image URL in a new tab to confirm it's accessible.
>>> 🧩 ||| Disable extensions — Ad blockers can block external image requests. Temporarily disable them.
>>> 🌐 ||| Try Chrome/Edge — These produce the most reliable exports. Safari may have CSS issues.
>>> 🔄 ||| Hard refresh — Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to clear the cache and try again.

---

!!success: Most blank-page issues are caused by images still loading or blocked by browser extensions — resolved by the steps above.`,
      },
    ],
  },
  {
    icon: '💳', label: 'Billing & Plans',
    articles: [
      {
        title: 'Compare Free, Pro, and Business plans',
        desc: 'See the full feature and limit comparison between plans.',
        content: `## Plan Comparison
![Pricing plans](https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=680&q=80)

| Feature | Free | Pro | Business |
|---|---|---|---|
| Leaflets | 1 | 10 | Unlimited |
| Products per leaflet | 20 | 200 | Unlimited |
| PDF export | ✓ | ✓ | ✓ |
| Flipbook export | — | ✓ | ✓ |
| Cover & back cover | — | ✓ | ✓ |
| Remove watermark | — | ✓ | ✓ |
| Priority support | — | — | ✓ |
| API access | — | — | ✓ |

---

>>> 🆓 ||| Free — Great for trying out the platform.
>>> ⚡ ||| Pro — Best for freelancers and small businesses.
>>> 🏢 ||| Business — Ideal for agencies, retailers, and teams.

!!tip: Annual billing saves up to 26% compared to monthly.`,
      },
      {
        title: 'Upgrade your plan',
        desc: 'Upgrade from your dashboard or the pricing page.',
        content: `## Upgrade Your Plan
![Upgrade plan](https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=680&q=80)

::step 1:: Go to the **Dashboard** page.
::step 2:: In the *Subscription* section, click **Upgrade plan**.
::step 3:: You are redirected to the Stripe checkout page.
::step 4:: Enter your payment details and click **Subscribe**.
::step 5:: Your plan upgrades immediately after payment is confirmed.

!!success: Upgrades take effect instantly. No waiting, no manual approval.
!!note: You can also upgrade directly from the **Pricing** page — choose your plan and billing period (monthly or annual).`,
      },
      {
        title: 'Cancel or downgrade',
        desc: 'Cancel anytime — your existing leaflets remain accessible.',
        content: `## Cancel or Downgrade

::step 1:: Go to **Dashboard → Subscription**.
::step 2:: Click **Manage Billing**.
::step 3:: In the Stripe portal, click **Cancel plan** and confirm.

---

>>> 📅 ||| Active until end of period — Your plan stays active until the current billing period ends.
>>> 📁 ||| Data preserved — All leaflets remain accessible after downgrade.
>>> 🔄 ||| Re-subscribe anytime — Return to a paid plan at any time.

!!note: After cancellation, your account reverts to the Free plan at the end of the current billing period.`,
      },
      {
        title: 'Invoices and receipts',
        desc: 'Download past invoices from the Stripe billing portal.',
        content: `## Invoices & Receipts
![Invoice example](https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=680&q=80)

::step 1:: Go to **Dashboard → Subscription**.
::step 2:: Click **Manage Billing**.
::step 3:: In the Stripe portal, go to **Billing history**.
::step 4:: Click any invoice to view or download it as PDF.

---

>>> 📧 ||| Automatic emails — Stripe sends a receipt after every successful payment.
>>> 🏷️ ||| VAT — Calculated at checkout if applicable for your country.

!!tip: If you need a VAT invoice with your company details, contact info@leafletai.ai.`,
      },
      {
        title: 'Non-profit and education discounts',
        desc: 'Contact us for a 40% discount with proof of status.',
        content: `## Non-Profit & Education Discounts
![Education discount](https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=680&q=80)

We offer a **40% discount** on all paid plans for:

>>> 🏫 ||| Educational institutions — Schools, universities, and colleges.
>>> 💚 ||| Non-profits — Registered charities, NGOs, and foundations.

---

::step 1:: Email **info@leafletai.ai** with subject *Discount Request*.
::step 2:: Attach proof of status (e.g. registration certificate, .edu email, charity number).
::step 3:: We verify and apply the discount within 1–2 business days.

!!success: The discount is applied as a Stripe coupon and renews automatically each billing cycle.`,
      },
    ],
  },
  {
    icon: '🔐', label: 'Account & Security',
    articles: [
      {
        title: 'Reset your password',
        desc: 'Use "Forgot password" on the login page to receive a reset link.',
        content: `## Reset Your Password
![Reset password](https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=680&q=80)

::step 1:: Go to the **Login** page.
::step 2:: Click **Forgot password?** below the password field.
::step 3:: Enter your email address and click **Send reset link**.
::step 4:: Check your inbox for the email from LeafletAI.
::step 5:: Click the link (valid for 1 hour) and set your new password.

!!note: Check your spam / junk folder if the email doesn't arrive within a few minutes.
!!warning: Reset links expire after 1 hour. Request a new one if yours has expired.`,
      },
      {
        title: 'Change your email address',
        desc: 'Update your email in Account Settings and verify the new address.',
        content: `## Change Your Email Address

::step 1:: Go to **Settings → Account**.
::step 2:: Click **Edit** next to your current email.
::step 3:: Enter the new email and your current password.
::step 4:: Click **Save** — a verification email is sent.
::step 5:: Click **Verify new email** in the email to complete the change.

!!note: Your old email remains active until verification is complete.
!!warning: If you lose access to the new email before verifying, contact support to reverse the change.`,
      },
      {
        title: 'Delete your account',
        desc: 'Permanently remove your account and all data from Settings > Danger Zone.',
        content: `## Delete Your Account

!!warning: Account deletion is permanent and cannot be undone. All your leaflets and data will be erased.

**What is deleted:**

>>> 📁 ||| All leaflets and product data.
>>> 🖼️ ||| All uploaded images.
>>> 👤 ||| Your profile and credentials.

---

::step 1:: Go to **Settings → Danger Zone**.
::step 2:: Click **Delete Account**.
::step 3:: Type your email address to confirm.
::step 4:: Click **Confirm Delete**.

!!note: If you have an active subscription, it is cancelled automatically. Invoices are retained by Stripe as required by law.`,
      },
      {
        title: 'Two-factor authentication',
        desc: 'Enable 2FA for an extra layer of security on your account.',
        content: `## Two-Factor Authentication (2FA)
![2FA security](https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=680&q=80)

!!success: 2FA protects your account even if your password is compromised.

::step 1:: Go to **Settings → Security**.
::step 2:: Click **Enable Two-Factor Authentication**.
::step 3:: Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password).
::step 4:: Enter the 6-digit code shown in the app to verify.
::step 5:: Save your backup codes in a safe place.

---

>>> 📱 ||| Authenticator apps — Google Authenticator, Authy, 1Password, Bitwarden.
>>> 🔑 ||| Backup codes — Store these offline in case you lose access to your authenticator.

!!tip: To disable 2FA, go to **Settings → Security** and click **Disable 2FA**. Enter your password to confirm.`,
      },
      {
        title: 'Data privacy and exports',
        desc: 'Request a copy of your data or learn about our data retention policy.',
        content: `## Data Privacy & Exports
![Data privacy](https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=680&q=80)

>>> 📦 ||| Data export — Request a full ZIP of all your data at any time.
>>> ⏱️ ||| Retention — Active data kept indefinitely; deleted account data removed within 24 hours.
>>> 🔐 ||| Stripe — PCI-DSS compliant; we never store card details.
>>> 🇪🇺 ||| GDPR / CCPA — You have the right to access, correct, or delete your personal data.

---

**Request your data:**
::step 1:: Go to **Settings → Privacy**.
::step 2:: Click **Request Data Export**.
::step 3:: A ZIP file with all your leaflets and account data will be emailed within 48 hours.

!!tip: For any GDPR or CCPA privacy requests, email info@leafletai.ai directly.`,
      },
    ],
  },
];

// Run seed inside a transaction for speed and atomicity
const seedAll = db.transaction(() => {
  let groupCount = 0, articleCount = 0;
  for (const [gi, group] of GROUPS.entries()) {
    const g = insertGroup.run(group.icon, group.label, gi);
    groupCount++;
    for (const [ai, article] of group.articles.entries()) {
      insertArticle.run(g.lastInsertRowid, article.title, article.desc, article.content, ai);
      articleCount++;
    }
  }
  return { groupCount, articleCount };
});

const { groupCount, articleCount } = seedAll();
console.log(`✅ Seeded ${groupCount} groups and ${articleCount} articles into the Help Center.`);
db.close();
