import { useState, useRef, useEffect, useCallback } from 'react';
import './ChatBot.css';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Message {
  role: 'bot' | 'user';
  text: string;
  ts: Date;
}

interface KBEntry {
  id: string;
  label: string;       // human-readable intent label
  keywords: string[];  // scored phrases
  answer: string;
}

// â”€â”€ Knowledge Base â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const KB: KBEntry[] = [
  // â”€â”€ Greetings â”€â”€
  {
    id: 'greeting', label: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'howdy', 'good morning', 'good afternoon', 'good evening',
      'greetings', 'sup', 'what is up', 'whats up', 'yo'],
    answer: 'Hello! ðŸ‘‹ How can I help you today?\n\nYou can ask me about:\n- Creating or editing leaflets\n- Importing products from Excel/CSV\n- Exporting to PDF or flipbook\n- Billing and plans\n- Account and settings',
  },

  // â”€â”€ What is LeafletAI â”€â”€
  {
    id: 'what-is', label: 'what LeafletAI is',
    keywords: ['what is leafletai', 'what is leaflet ai', 'what does leafletai do', 'what is this',
      'what is this platform', 'what is this tool', 'what does this do', 'about leafletai',
      'explain leafletai', 'tell me about leafletai', 'how does this work', 'what can i do here',
      'what does it do', 'overview', 'introduction'],
    answer: 'ðŸŒ¿ **LeafletAI** is an AI-powered platform for creating professional product leaflets and digital catalogues.\n\nWith LeafletAI you can:\n- **Import products** from Excel/CSV\n- **Customise** card layouts, fonts, colours, and cover pages\n- **Export** as high-res PDF or interactive flipbook\n- **Share** digitally or print-ready\n\nNo design skills needed. Most users create their first leaflet in under 5 minutes!',
  },

  // â”€â”€ Getting started â”€â”€
  {
    id: 'getting-started', label: 'getting started',
    keywords: ['get started', 'getting started', 'how do i start', 'how to start', 'how to begin',
      'where do i start', 'first steps', 'beginner', 'new here', 'how to use', 'guide',
      'tutorial', 'walkthrough', 'onboarding', 'how does it work'],
    answer: 'rocket_launch **Getting Started with LeafletAI:**\n\n1. **Sign up** for a free account (no credit card needed)\n2. Click **"Create leaflet"** in the top navigation\n3. Choose a template or start from scratch\n4. Add your products manually or import from CSV/Excel\n5. Customise the design (fonts, colours, layout)\n6. Click **Export** to download as PDF or open as a flipbook\n\nMost users publish their first leaflet within 5 minutes!',
  },

  // â”€â”€ Create leaflet â”€â”€
  {
    id: 'create-leaflet', label: 'creating a leaflet',
    keywords: ['create leaflet', 'new leaflet', 'start leaflet', 'make leaflet', 'make a leaflet',
      'create a leaflet', 'build leaflet', 'design leaflet', 'first leaflet', 'how to create',
      'how do i make', 'how to make', 'new brochure', 'new catalogue', 'new catalog', 'new flyer',
      'create brochure', 'create catalog', 'make catalog', 'make flyer'],
    answer: 'rocket_launch **To create a leaflet:**\n1. Click **"Create leaflet"** in the top navigation\n2. Choose a template or start from scratch\n3. Add your products (manually or via CSV import)\n4. Customise fonts, colours, and card layout\n5. Hit **Export** when ready!\n\nYour leaflet is saved automatically as you work.',
  },

  // â”€â”€ Templates â”€â”€
  {
    id: 'templates', label: 'templates',
    keywords: ['template', 'pre-built', 'prebuilt', 'layout template', 'design template',
      'choose template', 'apply template', 'ready made', 'ready-made', 'pre made layout',
      'existing design', 'sample layout', 'starter layout'],
    answer: 'palette **Templates in LeafletAI:**\n\nLeafletAI provides a growing library of pre-built templates. To use one:\n1. Open the editor\n2. Click **"Page Layout"** in the left sidebar\n3. Browse and click any template to apply it instantly\n\nYou can also save your own layouts as reusable templates for future leaflets.',
  },

  // â”€â”€ Import products â”€â”€
  {
    id: 'import-products', label: 'importing products',
    keywords: ['import', 'import products', 'csv', 'excel', 'spreadsheet', 'bulk import',
      'upload products', 'xlsx', 'xls', 'bulk upload', 'load products', 'bring in products',
      'upload data', 'how to import', 'import file', 'batch import', 'mass import',
      'add many products', 'add products from file', 'load from file', 'upload file',
      'data import', 'product list', 'product file'],
    answer: 'inventory_2 **Importing products in bulk:**\n1. Download the **Excel/CSV template** from Create Leaflet â†’ Import Products â†’ Download Template\n2. Fill in: name, price, image URL, country, and product URL\n3. Upload the file â€” valid rows are imported instantly\n4. Fix any validation errors shown in the import summary\n\nTip: You can also select which rows to import using the checkboxes in the import summary.',
  },

  // â”€â”€ Add product manually â”€â”€
  {
    id: 'add-product', label: 'adding a product manually',
    keywords: ['add product', 'add a product', 'manual product', 'add item', 'new product',
      'add single product', 'manually add', 'enter product', 'type in product',
      'product without file', 'add without importing', 'create product'],
    answer: 'âž• **To add a product manually:**\n1. Open your leaflet in the editor\n2. Click the **"Add Product"** button in the toolbar or sidebar\n3. Fill in the product details (name, price, image, country, URL)\n4. Click **Save** â€” the card appears on the canvas immediately.',
  },

  // â”€â”€ Edit product â”€â”€
  {
    id: 'edit-product', label: 'editing a product',
    keywords: ['edit product', 'update product', 'change product', 'modify product', 'rename product',
      'change price', 'update price', 'fix product', 'correct product', 'change image',
      'update image', 'edit item', 'change item', 'modify item'],
    answer: 'edit **To edit a product:**\n1. Click directly on the product card in the editor\n2. The **Edit Product** modal opens\n3. Update any fields (name, price, image, link, country)\n4. Click **Save changes**.\n\nYou can also delete the product from the same modal.',
  },

  // â”€â”€ Export PDF â”€â”€
  {
    id: 'export-pdf', label: 'exporting to PDF',
    keywords: ['export pdf', 'download pdf', 'pdf export', 'print pdf', 'save pdf', 'generate pdf',
      'produce pdf', 'get pdf', 'pdf file', 'export to pdf', 'download leaflet', 'save leaflet',
      'print leaflet', 'pdf not working', 'export not working', 'download not working',
      'export broken', 'pdf blank', 'blank pdf', 'empty pdf', 'pdf error'],
    answer: 'description **To export your leaflet as PDF:**\n1. Open your leaflet in the editor\n2. Click the **"â‡© Export PDF"** button in the top toolbar\n3. The PDF is generated and downloaded automatically\n\n**If the PDF is blank or has issues:**\n- Wait for all images to fully load before exporting\n- Try reducing the number of products per page\n- Ensure all product images have valid URLs',
  },

  // â”€â”€ Flipbook â”€â”€
  {
    id: 'flipbook', label: 'the flipbook',
    keywords: ['flipbook', 'flip book', 'page flip', 'interactive pdf', 'flip animation',
      'digital book', 'digital leaflet', 'view flipbook', 'open flipbook', 'flipbook viewer',
      'animated leaflet', 'page turning', 'interactive leaflet', 'online viewer',
      'how to view flipbook', 'flipbook not working', 'flipbook blank', 'flipbook images'],
    answer: 'auto_stories **The Flipbook viewer:**\n\nLeafletAI includes a built-in interactive flipbook with realistic page-flip animations.\n\n**To open it:**\n1. Open your leaflet in the editor\n2. Click **"View Flipbook"** in the toolbar\n3. A popup opens with the full flipbook experience\n\n**Features:** page navigation, zoom, thumbnail view, keyboard shortcuts, and fullscreen mode.\n\nPerfect for sharing digitally via email, WhatsApp, or embedding on a website.',
  },

  // â”€â”€ Printable book â”€â”€
  {
    id: 'printable-book', label: 'printable booklet',
    keywords: ['printable book', 'booklet', 'a5 booklet', 'a4 landscape', 'convert to book',
      'print book', 'print booklet', 'square catalog', 'magazine format', 'book format',
      'convert to printable', 'printable format', 'book export', 'booklet export'],
    answer: 'print **To convert to a printable booklet:**\n1. Click **"Convert to Printable Book"** in the export options\n2. Choose your format:\n   - **A4 Landscape** â€” standard widescreen layout\n   - **A5 Booklet** â€” compact double-sided\n   - **Square Catalog** â€” social-media friendly\n   - **Magazine** â€” editorial style\n3. The layout reflows and exports as a print-ready PDF.',
  },

  // â”€â”€ Cover / back page â”€â”€
  {
    id: 'cover-page', label: 'cover and back pages',
    keywords: ['cover page', 'back page', 'back cover', 'front cover', 'cover image',
      'first page', 'last page', 'add cover', 'add back page', 'cover photo',
      'leaflet cover', 'brochure cover', 'cover design', 'add cover image'],
    answer: 'ðŸŽ­ **To add a cover or back page:**\n1. Open your leaflet editor\n2. Look for **"Cover Page"** and **"Back Cover"** in the left sidebar\n3. Upload a custom image for each\n4. They are included at the start and end of all exports (PDF and flipbook).',
  },

  // â”€â”€ Font / Typography â”€â”€
  {
    id: 'typography', label: 'fonts and typography',
    keywords: ['font', 'typography', 'typeface', 'font size', 'font family', 'change font',
      'text style', 'text appearance', 'font type', 'custom font', 'import font', 'google font',
      'upload font', 'font weight', 'bold text', 'italic text', 'text formatting',
      'font not working', 'change text font', 'apply font'],
    answer: 'text_fields **To change fonts:**\n1. Open the **Typography** panel in the left sidebar\n2. Choose a font family from the dropdown\n3. The font applies to all text elements (cards, header, footer)\n\n**Custom fonts:** Click **"Import Custom Font"** to:\n- Upload a `.ttf`, `.otf`, `.woff`, or `.woff2` file\n- Paste a Google Fonts or CDN URL\n\nImported fonts are saved and applied across the entire leaflet.',
  },

  // â”€â”€ Card layout / customise â”€â”€
  {
    id: 'card-layout', label: 'card layout customisation',
    keywords: ['card layout', 'customise card', 'customize card', 'card design', 'card style',
      'product card', 'card appearance', 'card look', 'card editor', 'card elements',
      'drag card', 'resize card', 'card shadow', 'card border', 'card background',
      'layout customizer', 'customize layout', 'change card', 'card format',
      'shape', 'shapes', 'rectangle', 'triangle', 'ellipse', 'polygon', 'star', 'line'],
    answer: 'palette **To customise product cards:**\n1. Click **"Customize Card Layout"** in the left sidebar\n2. Add shapes such as rectangles, triangles, ellipses, polygons, stars, or lines\n3. Drag, resize, rotate, and position shapes or card elements anywhere on the card\n4. Adjust **borders**, **shadows**, **radius**, and **background** per element\n5. Changes apply to all cards on the leaflet\n\nYou can also set each element\'s visibility and font size independently.',
  },

  // â”€â”€ Cards per row / grid â”€â”€
  {
    id: 'grid-layout', label: 'grid layout (cards per row/column)',
    keywords: ['cards per row', 'cards per column', 'columns', 'rows', 'grid layout', 'layout grid',
      'how many cards', 'number of columns', 'number of rows', 'change columns',
      'change rows', '3 columns', '4 columns', 'card grid', 'grid size', 'layout size',
      'products per row', 'products per page', 'items per row'],
    answer: 'architecture **To change the card grid:**\n1. Open the **Page Layout** panel in the left sidebar\n2. Use **"Cards per Row"** to set columns (1â€“6)\n3. Use **"Cards per Column"** to set rows (1â€“6)\n\nYour selection is **saved automatically** per leaflet. The default is 3Ã—3 (9 products per page).',
  },

  // â”€â”€ Header / Footer â”€â”€
  {
    id: 'header-footer', label: 'header and footer',
    keywords: ['header', 'footer', 'show header', 'hide footer', 'page header', 'page footer',
      'add header', 'add footer', 'edit header', 'edit footer', 'header logo',
      'footer text', 'header text', 'remove header', 'remove footer', 'header color',
      'footer color', 'header background', 'footer background'],
    answer: 'content_paste **To manage header and footer:**\n1. Open the **Header** or **Footer** section in the left sidebar\n2. Toggle visibility on/off\n3. Edit text, logo, and background colour\n\nFont changes (from the Typography panel) also apply to header and footer text.',
  },

  // â”€â”€ Origin flag â”€â”€
  {
    id: 'origin-flag', label: 'origin country flag',
    keywords: ['flag', 'country flag', 'origin flag', 'flag icon', 'flag size', 'country icon',
      'show flag', 'hide flag', 'product flag', 'product country', 'origin country',
      'country label', 'country badge', 'flag not showing', 'flag emoji'],
    answer: 'flag **To show country flags on product cards:**\n1. Open **Customize Card Layout** in the sidebar\n2. Find the **Origin Flag** section\n3. Toggle it on\n4. Adjust the **icon size** using the size slider\n\nFlags are displayed as visual emoji flags based on the country code of each product.',
  },

  // â”€â”€ Password reset â”€â”€
  {
    id: 'password-reset', label: 'resetting your password',
    keywords: ['reset password', 'forgot password', 'change password', 'password reset',
      'lost password', 'cannot login', 'cannot log in', 'locked out', 'forgot my password',
      'password help', 'password issue', 'wrong password', 'password not working'],
    answer: 'ðŸ”‘ **To reset your password:**\n1. Go to the login page\n2. Click **"Forgot password?"**\n3. Enter your email address\n4. Check your inbox for a reset link\n5. Click the link and set a new password\n\nIf you don\'t receive the email within a few minutes, check your spam folder or contact **info@leafletai.ai**.',
  },

  // â”€â”€ Sign up / login â”€â”€
  {
    id: 'account-auth', label: 'signing up or logging in',
    keywords: ['sign up', 'signup', 'register', 'login', 'log in', 'create account', 'make account',
      'new account', 'how to sign up', 'how to register', 'how to login', 'google login',
      'google sign in', 'google account', 'email signup', 'verify email', 'verification email',
      'confirm email', 'account creation'],
    answer: 'person **To create an account:**\n1. Click **"Login"** in the top navigation\n2. Select **"Sign up"**\n3. Enter your name, email, and password â€” or use **Google sign-in**\n4. Verify your email address\n\nThe **Free plan is free forever** â€” no credit card required.',
  },

  // â”€â”€ Pricing / plans â”€â”€
  {
    id: 'pricing', label: 'pricing and plans',
    keywords: ['price', 'pricing', 'plan', 'plans', 'how much', 'cost', 'subscription',
      'free plan', 'pro plan', 'business plan', 'how much does it cost', 'is it free',
      'free version', 'paid plan', 'monthly', 'annual', 'per month', 'per year',
      'plan comparison', 'compare plans', 'plan limits', 'plan features',
      'what does the free plan include', 'what do i get for free'],
    answer: 'credit_card **LeafletAI Plans:**\n\n**Free** â€” 1 leaflet, up to 150 products/leaflet\n**Pro** â€” 10 leaflets, priority export, more features\n**Business** â€” unlimited leaflets & products, API access\n\nVisit the [Pricing page](/pricing) for full details and to upgrade.',
  },

  // â”€â”€ Upgrade â”€â”€
  {
    id: 'upgrade', label: 'upgrading your plan',
    keywords: ['upgrade', 'how to upgrade', 'switch plan', 'go pro', 'buy pro',
      'get pro', 'subscribe', 'move to pro', 'pro subscription', 'upgrade plan',
      'buy subscription', 'pay for pro', 'unlock features', 'get more leaflets'],
    answer: 'upload **To upgrade your plan:**\n1. Go to **Settings â†’ Billing** or visit the [Pricing page](/pricing)\n2. Click **"Upgrade"** on your desired plan\n3. Enter payment details â€” changes take effect immediately\n\nYou can also upgrade directly from the editor if you hit a plan limit.',
  },

  // â”€â”€ Cancel / downgrade â”€â”€
  {
    id: 'cancel', label: 'cancelling or downgrading',
    keywords: ['cancel', 'downgrade', 'cancel subscription', 'cancel plan', 'stop subscription',
      'unsubscribe', 'end plan', 'stop paying', 'cancel my plan', 'how to cancel',
      'pausing', 'pause subscription', 'stop being charged', 'end subscription'],
    answer: 'cancel **To cancel your subscription:**\n1. Go to **Settings â†’ Billing**\n2. Click **"Cancel plan"**\n3. You keep full access until the end of your current billing period\n\nYour existing leaflets remain **viewable** after downgrading. You just won\'t be able to create new ones above the Free plan limit.',
  },

  // â”€â”€ Billing / invoice â”€â”€
  {
    id: 'billing', label: 'billing and invoices',
    keywords: ['invoice', 'receipt', 'billing', 'payment', 'charge', 'payment method',
      'billing history', 'past payments', 'payment issue', 'billing problem',
      'update card', 'change payment', 'credit card', 'debit card', 'stripe',
      'invoice download', 'get invoice', 'tax receipt', 'billing page'],
    answer: 'ðŸ§¾ **To access billing and invoices:**\n1. Go to **Settings â†’ Billing**\n2. View and download past invoices\n3. Update your payment method\n\nWe accept all major credit/debit cards via **Stripe**. Annual invoicing is available on Business plans.',
  },

  // â”€â”€ Refund â”€â”€
  {
    id: 'refund', label: 'refunds',
    keywords: ['refund', 'money back', 'get refund', 'want refund', 'refund policy',
      'return payment', 'charged twice', 'wrong charge', 'dispute charge'],
    answer: 'ðŸ’° **Refund policy:**\n\nAll payments are generally non-refundable unless required by law. However, if you were charged incorrectly or there was a billing error, please contact us:\n\n- **Email:** info@leafletai.ai\n- Describe the issue and include your account email\n\nWe review all cases and respond within 1â€“2 business days.',
  },

  // â”€â”€ Delete account â”€â”€
  {
    id: 'delete-account', label: 'deleting your account',
    keywords: ['delete account', 'remove account', 'close account', 'deactivate account',
      'erase account', 'permanently delete', 'remove my data', 'delete my leaflets',
      'how to delete account', 'account deletion'],
    answer: 'delete **To delete your account:**\n1. Go to **Settings**\n2. Scroll to the **Danger Zone** section\n3. Click **"Delete Account"** and confirm\n\nwarning This is **permanent** and will remove all your leaflets and data. Consider exporting your leaflets as PDFs before deleting.',
  },

  // â”€â”€ Images â”€â”€
  {
    id: 'images', label: 'product images',
    keywords: ['image', 'upload image', 'photo', 'product image', 'image format', 'image size',
      'image not loading', 'image not showing', 'broken image', 'image error',
      'what image formats', 'supported formats', 'max image size', 'image too large',
      'image quality', 'image resolution', 'product photo', 'picture'],
    answer: 'image **Product images:**\n\nSupported formats: **JPEG, PNG, WebP, SVG** â€” up to **20 MB** per image.\n\nYou can:\n- Upload images from your device\n- Paste an image URL (must be publicly accessible)\n\n**If images aren\'t showing:**\n- Ensure the image URL is a direct link to the image file\n- Check that the URL doesn\'t require login or authentication',
  },

  // â”€â”€ Security / privacy â”€â”€
  {
    id: 'security', label: 'security and privacy',
    keywords: ['security', 'data privacy', 'secure', 'encrypted', 'gdpr', 'data protection',
      'privacy', 'data safe', 'is my data safe', 'who can see my data',
      'data storage', 'data sharing', 'third party', 'uae pdpl'],
    answer: 'lock **Security & Privacy:**\n\n- All data is **encrypted** in transit (HTTPS) and at rest\n- Uploaded images are stored securely and never shared with third parties\n- We comply with **UAE PDPL** and **GDPR**\n- Your input is **not used for AI training** without explicit consent\n\nRead our full [Privacy Policy](/privacy) for details.',
  },

  // â”€â”€ API â”€â”€
  {
    id: 'api', label: 'API and integrations',
    keywords: ['api', 'integration', 'automate', 'programmatic', 'api access', 'api key',
      'developer api', 'rest api', 'webhook', 'connect to', 'sync products',
      'automation', 'developer', 'technical integration'],
    answer: 'settings **API access** is available on the **Business plan**. It allows you to:\n- Automate leaflet creation\n- Sync product data from your store\n- Trigger exports programmatically\n\nContact **info@leafletai.ai** for API documentation and access.',
  },

  // â”€â”€ Not working / broken / error â”€â”€
  {
    id: 'troubleshoot', label: 'troubleshooting',
    keywords: ['not working', 'broken', 'error', 'bug', 'issue', 'problem', 'glitch',
      'something wrong', 'does not work', 'won\'t work', 'stopped working', 'crash',
      'page not loading', 'blank page', 'white page', 'app broken', 'site broken',
      'leaflet ai broken', 'leafletai not working', 'cannot access', 'can\'t access'],
    answer: 'build **Troubleshooting tips:**\n\n1. **Refresh the page** â€” most temporary issues resolve with a refresh\n2. **Clear browser cache** â€” Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)\n3. **Try a different browser** â€” Chrome and Edge work best\n4. **Check your internet connection**\n5. **Log out and log back in**\n\nIf the issue persists, please email **info@leafletai.ai** with a description and any error messages you see.',
  },

  // â”€â”€ Contact / support â”€â”€
  {
    id: 'contact', label: 'contacting support',
    keywords: ['contact', 'support', 'email support', 'talk to human', 'talk to someone',
      'talk to agent', 'speak to support', 'customer service', 'customer support',
      'how to contact', 'get help', 'reach support', 'human support', 'live support',
      'chat with team', 'speak to team'],
    answer: 'ðŸ“¬ **To reach our support team:**\n\n- **Email:** info@leafletai.ai\n- **Response time:** within a few hours on business days\n- Use the **Contact form** on this page for detailed inquiries\n\nWe\'re happy to help with anything â€” technical issues, billing questions, or feature requests!',
  },

  // â”€â”€ Icons / add icon â”€â”€
  {
    id: 'icons', label: 'adding icons to product cards',
    keywords: ['add icon', 'icon', 'icons', 'product icon', 'card icon', 'insert icon',
      'custom icon', 'icon on card', 'icon overlay', 'icon badge', 'sticker',
      'add sticker', 'badge icon', 'icon image', 'upload icon', 'logo on card',
      'put icon on product', 'icon in card', 'card badge', 'label icon'],
    answer: 'sell **Adding icons to product cards:**\n\nYou can add custom icons/overlays on top of product cards:\n\n1. Open your leaflet in the editor\n2. Click **"Customize Card Layout"** in the left sidebar\n3. Find the **Icons** section\n4. Upload a custom icon image (PNG with transparency recommended)\n5. Position and resize the icon on the card\n\n**Use cases:**\n- "New", "Sale", "Hot" badges\n- Brand logos\n- Discount stickers\n- Custom label overlays\n\nIcons appear on all product cards in your leaflet.',
  },

  // â”€â”€ Import file (detailed) â”€â”€
  {
    id: 'import-file-detail', label: 'how to import a product file',
    keywords: ['how to import file', 'import excel file', 'import csv file', 'upload excel',
      'upload csv', 'how to upload products', 'product file format', 'import template',
      'download import template', 'what columns', 'required fields', 'file columns',
      'import format', 'csv format', 'excel format', 'file structure', 'import schema',
      'import not working', 'import error', 'invalid rows', 'import failed',
      'file upload error', 'which file format', 'what file to upload'],
    answer: 'content_paste **How to import products from a file:**\n\n**Step 1 â€” Download the template:**\nGo to Create Leaflet â†’ Import Products â†’ **Download Template**\n\n**Step 2 â€” Fill in the columns:**\n| Column | Required | Description |\n|---|---|---|\n| `name` | check_circle | Product name |\n| `price` | check_circle | Numeric price (e.g. 9.99) |\n| `image_url` | check_circle | Direct URL to product image |\n| `country` | check_circle | Country code (e.g. AE, US, GB) |\n| `product_url` | cancel | Link to product page |\n| `original_price` | cancel | Strike-through price |\n\n**Step 3 â€” Upload the file:**\nDrag and drop or click to upload. Supported formats: **.xlsx** and **.csv**\n\n**Step 4 â€” Review the import summary:**\n- check_circle Valid rows are ready to import\n- cancel Invalid rows show the error reason\n- Use the **"Import All"** checkbox to include all rows, or select individual ones\n\n**Common errors:**\n- Missing required fields\n- Invalid image URLs (must be publicly accessible)\n- Price format issues (use numbers only, no currency symbols)',
  },

  // â”€â”€ Export PDF (detailed) â”€â”€
  {
    id: 'export-pdf-detail', label: 'how to export a PDF',
    keywords: ['how to export', 'how do i export', 'export steps', 'pdf steps', 'export options',
      'print quality', 'high resolution pdf', 'pdf settings', 'pdf format',
      'export button', 'where is export', 'pdf download button', 'export my leaflet',
      'save as pdf', 'print ready', 'a4 pdf', 'export to file'],
    answer: 'description **How to export your leaflet as PDF:**\n\n**Basic export:**\n1. Open your leaflet in the editor\n2. Make sure all products and images are fully loaded\n3. Click **"â‡© Export PDF"** in the top toolbar\n4. The PDF downloads automatically to your device\n\n**Export formats available:**\n- **Standard PDF** â€” A4 portrait, print-ready, high-resolution\n- **A4 Landscape** â€” wider format\n- **A5 Booklet** â€” double-sided compact\n- **Square Catalog** â€” equal width/height\n- **Magazine** â€” editorial layout\n\n**For best results:**\n- Wait for all images to load before exporting\n- Use the **Cards per Row/Column** settings to control layout density\n- Add a **Cover Page** and **Back Cover** for a professional finish\n\n**If the PDF is blank or broken:**\n- Refresh the page and try again\n- Ensure images have valid, publicly accessible URLs\n- Try reducing products per page',
  },

  // â”€â”€ Flipbook (detailed) â”€â”€
  {
    id: 'flipbook-detail', label: 'how the flipbook works',
    keywords: ['how to use flipbook', 'flipbook controls', 'flipbook navigation', 'flipbook zoom',
      'flipbook fullscreen', 'flipbook pages', 'flipbook thumbnails', 'flipbook keyboard',
      'page turn', 'how to turn pages', 'navigate flipbook', 'flipbook features',
      'interactive viewer', 'digital viewer', 'view my leaflet online', 'share flipbook',
      'flipbook link', 'online leaflet', 'view online'],
    answer: 'auto_stories **Using the Flipbook viewer:**\n\n**To open:**\nClick **"View Flipbook"** in the leaflet editor toolbar.\n\n**Navigation controls:**\n- **Click page corners** or use arrow buttons to turn pages\n- **Drag** the page edge for realistic flip animation\n- **Keyboard:** â† â†’ arrow keys to navigate\n- **Page number** displayed at the bottom\n\n**Toolbar features:**\n- search **Zoom in/out** â€” enlarge pages for detail\n- â›¶ **Fullscreen** â€” distraction-free reading\n- ðŸ“‘ **Thumbnails** â€” jump to any page quickly\n- ðŸ”Š **Sound** â€” toggle page-flip sound effects\n- bookmark **Bookmarks** â€” save pages for later\n- ðŸ”Ž **Search** â€” find text within the leaflet\n\n**Cover & back pages** are included as the first and last pages.\n\n**Sharing:** Currently share the exported PDF. Direct flipbook links are coming soon.',
  },

  // â”€â”€ Convert to book (detailed) â”€â”€
  {
    id: 'convert-book-detail', label: 'converting to a printable book',
    keywords: ['convert to book', 'printable book', 'how to convert', 'book converter',
      'booklet options', 'book formats', 'a4 book', 'a5 book', 'square book',
      'magazine book', 'print booklet', 'print ready booklet', 'booklet download',
      'convert leaflet to book', 'book export steps', 'book layout'],
    answer: 'menu_book **Convert to Printable Book â€” step by step:**\n\n1. Open your leaflet in the editor\n2. Click **"Convert to Printable Book"** in the export options\n3. Choose your **format:**\n\n| Format | Size | Best for |\n|---|---|---|\n| **A4 Landscape** description | 297Ã—210mm | Standard wide leaflets |\n| **A5 Booklet** auto_stories | 148Ã—210mm | Compact print books |\n| **Square Catalog** crop_square | Equal sides | Social/display catalogs |\n| **Magazine** newspaper | Portrait tall | Editorial style |\n\n4. Click **Export** â€” the PDF downloads in the selected layout\n\n**Tips:**\n- Cover and back pages are automatically included\n- Use 3 columns and 3 rows for a balanced page density\n- High-res images produce the best print quality',
  },

  // â”€â”€ Cover page (detailed) â”€â”€
  {
    id: 'cover-page-detail', label: 'setting up cover and back pages',
    keywords: ['how to add cover', 'set cover page', 'cover page steps', 'upload cover',
      'custom cover', 'cover image upload', 'back cover steps', 'add back cover',
      'remove cover', 'change cover', 'cover design', 'cover photo upload',
      'first page design', 'last page design', 'cover in pdf', 'cover in flipbook'],
    answer: 'ðŸŽ­ **Setting up Cover & Back Pages:**\n\n**To add a cover page:**\n1. Open the leaflet editor\n2. Click **"Cover Page"** in the left sidebar\n3. Click **"Upload Image"**\n4. Choose an image from your device (JPEG, PNG, WebP recommended)\n5. The cover appears as **page 1** in all exports\n\n**To add a back cover:**\n1. Click **"Back Cover"** in the left sidebar\n2. Upload your back cover image\n3. It appears as the **last page** in all exports\n\n**Tips:**\n- Use A4 dimensions (2480Ã—3508px at 300dpi) for print-quality covers\n- The cover title shows as **"Front Cover"** in the flipbook, and the last page as **"Back Cover"**\n- Covers are included in both PDF export and flipbook viewer',
  },

  // â”€â”€ Page layout (detailed) â”€â”€
  {
    id: 'page-layout-detail', label: 'page layout settings',
    keywords: ['page layout', 'layout settings', 'page settings', 'layout options',
      'background color', 'page background', 'page color', 'page gradient',
      'page theme', 'page style', 'layout panel', 'customize page',
      'change background', 'set background', 'gradient background',
      'page size', 'margins', 'page spacing', 'card spacing', 'gap between cards'],
    answer: 'image **Page Layout settings:**\n\nOpen the **Page Layout** panel in the left sidebar to control:\n\n**Grid:**\n- **Cards per Row** â€” 1 to 6 columns\n- **Cards per Column** â€” 1 to 6 rows (saved per leaflet)\n\n**Background:**\n- **Solid colour** â€” pick any colour using the colour picker\n- **Gradient** â€” set start colour, end colour, and angle\n- Preview updates in real time\n\n**Spacing:**\n- Card gaps adjust automatically based on grid size\n- All spacing scales proportionally with card count\n\n**Templates:**\n- Apply a pre-built template from the template library\n- Or save your current layout as a custom template',
  },

  // â”€â”€ Header (detailed) â”€â”€
  {
    id: 'header-detail', label: 'header settings',
    keywords: ['header settings', 'edit header', 'header design', 'header color', 'header logo',
      'header text', 'header background', 'show header', 'hide header', 'remove header',
      'header font', 'header content', 'what is in header', 'header elements',
      'customize header', 'header layout', 'add logo to header'],
    answer: 'content_paste **Header settings:**\n\nOpen the **Header** section in the left sidebar:\n\n- **Toggle** â€” show or hide the header on all pages\n- **Logo** â€” upload your brand logo (appears on the left)\n- **Title / tagline** â€” editable text fields\n- **Background colour** â€” solid colour or transparent\n- **Text colour** â€” matches your brand\n- **Font** â€” follows the global Typography setting\n\n**Tips:**\n- The header appears on every page of your leaflet\n- Recommended logo size: 200Ã—60px (PNG with transparent background)\n- Header changes apply immediately across all pages',
  },

  // â”€â”€ Footer (detailed) â”€â”€
  {
    id: 'footer-detail', label: 'footer settings',
    keywords: ['footer settings', 'edit footer', 'footer design', 'footer color', 'footer logo',
      'footer text', 'footer background', 'show footer', 'hide footer', 'remove footer',
      'footer font', 'footer content', 'what is in footer', 'footer elements',
      'customize footer', 'footer layout', 'page number', 'page numbers in footer'],
    answer: 'content_paste **Footer settings:**\n\nOpen the **Footer** section in the left sidebar:\n\n- **Toggle** â€” show or hide the footer on all pages\n- **Left text** â€” e.g. store name or website URL\n- **Center text** â€” e.g. tagline or slogan\n- **Right text** â€” e.g. phone number or date\n- **Background colour** â€” solid colour\n- **Text colour** â€” custom per element\n- **Font** â€” follows the global Typography setting\n\n**Tips:**\n- Footer appears at the bottom of every page in PDF and flipbook\n- Keep footer text short â€” it displays at small size\n- Changes apply immediately across all pages',
  },

  // â”€â”€ All features â”€â”€
  {
    id: 'all-features', label: 'all LeafletAI features',
    keywords: ['all features', 'features list', 'what features', 'feature overview',
      'full features', 'capabilities', 'what can i do', 'what is included',
      'platform features', 'list of features', 'everything it can do',
      'full list', 'feature set', 'what does leafletai offer', 'all tools',
      'complete feature list', 'all capabilities'],
    answer: 'auto_awesome **LeafletAI â€” Full Feature Overview:**\n\n**Product Management:**\n- Add products manually or import from Excel/CSV\n- Edit name, price, image, country flag, and URL per product\n- Bulk import with validation and error reporting\n\n**Design & Layout:**\n- 3Ã—3 default card grid (customisable 1â€“6 per axis)\n- Drag-and-resize card layout editor\n- Custom fonts (built-in library + import your own)\n- Solid or gradient page backgrounds\n- Cover page and back cover\n- Header and footer with logo and text\n- Origin country flags on cards\n- Custom icon overlays on cards\n\n**Export:**\n- â‡© PDF export (high-res, print-ready)\n- auto_stories Flipbook viewer with page-flip animations\n- menu_book Printable book (A4, A5, Square, Magazine formats)\n\n**Account & Plans:**\n- Free plan: 1 leaflet, 150 products\n- Pro plan: 10 leaflets, priority export\n- Business: unlimited + API access\n\nVisit the [Features page](/features) for the full breakdown.',
  },

  // â”€â”€ Pricing (detailed) â”€â”€
  {
    id: 'pricing-detail', label: 'pricing and plan details',
    keywords: ['pricing details', 'plan details', 'plan comparison', 'what is included in free',
      'what does pro include', 'pro features', 'business features', 'free plan limits',
      'pro plan limits', 'business plan limits', 'how many products', 'how many leaflets',
      'free vs pro', 'pro vs business', 'which plan', 'best plan', 'plan difference',
      'what plan should i use', 'difference between plans', 'plan benefits'],
    answer: 'credit_card **LeafletAI Plan Comparison:**\n\n| Feature | Free | Pro | Business |\n|---|---|---|---|\n| Leaflets | 1 | 10 | Unlimited |\n| Products/leaflet | 150 | 150 | Unlimited |\n| PDF export | check_circle | check_circle | check_circle |\n| Flipbook viewer | check_circle | check_circle | check_circle |\n| Printable book | check_circle | check_circle | check_circle |\n| Custom fonts | check_circle | check_circle | check_circle |\n| Cover/back pages | check_circle | check_circle | check_circle |\n| Priority export | cancel | check_circle | check_circle |\n| API access | cancel | cancel | check_circle |\n| Support | Email | Email | Priority |\n\n**Free plan** â€” free forever, no credit card required\n**Pro plan** â€” monthly or annual subscription\n**Business plan** â€” contact us for pricing\n\nVisit the [Pricing page](/pricing) to upgrade.',
  },

  // â”€â”€ Product URL â”€â”€
  {
    id: 'product-url', label: 'product links and URLs',
    keywords: ['product url', 'product link', 'add link', 'clickable product', 'link to product',
      'product website', 'shop link', 'store link', 'url on card', 'product page link',
      'how to add link', 'link not showing', 'url not working', 'clickable card',
      'link product to store', 'add url to product'],
    answer: 'link **Adding product URLs:**\n\nEvery product card can have a clickable link:\n\n1. Open the **Add Product** or **Edit Product** modal\n2. Find the **Product URL** field\n3. Paste the full URL (e.g. `https://yourstore.com/product`)\n4. Click **Save**\n\n**Where the link appears:**\n- In the **flipbook** â€” readers can click the card to go directly to your product page\n- In the **product card** â€” a link icon is shown at the bottom of the card\n\n**Tip:** Make sure the URL starts with `https://` for it to work correctly.',
  },

  // â”€â”€ Price / discount â”€â”€
  {
    id: 'price-discount', label: 'prices and discounts on cards',
    keywords: ['price on card', 'show price', 'discount price', 'sale price', 'original price',
      'strike through price', 'strikethrough', 'crossed out price', 'before price',
      'after price', 'discounted product', 'old price', 'new price', 'price format',
      'price not showing', 'price badge', 'price label'],
    answer: 'ðŸ’° **Prices and discounts on product cards:**\n\n**To set a sale price with original price:**\n1. Open **Add Product** or **Edit Product**\n2. Fill in **Price** â€” this is the current/sale price\n3. Fill in **Original Price** â€” this shows as a strikethrough above the sale price\n\n**How it looks on the card:**\n- ~~original price~~ shown crossed out\n- **Sale price** shown prominently\n- Both formatted with the currency of your leaflet settings\n\n**Price visibility:** Controlled in **Customize Card Layout** â€” you can show/hide the price element and adjust its font size and position.',
  },

  // â”€â”€ Dashboard â”€â”€
  {
    id: 'dashboard', label: 'the dashboard',
    keywords: ['dashboard', 'my dashboard', 'insights', 'analytics', 'statistics', 'stats',
      'leaflet stats', 'how many leaflets', 'leaflet count', 'product clicks',
      'click tracking', 'most clicked', 'productivity', 'activity', 'recent leaflets',
      'quick actions', 'dashboard features'],
    answer: 'monitoring **Your Dashboard:**\n\nThe dashboard (go to **Dashboard** from the navbar) shows:\n\n**Insights:**\n- Total leaflets created\n- Average leaflets per week\n- Products per leaflet average\n- Most productive day of the week\n- Time since last leaflet created\n\n**Product Click Tracking:**\n- Track how many times each product link is clicked\n- Filter by leaflet using the dropdown\n- See which products are most popular\n\n**Quick Actions:**\n- Create a new leaflet\n- Go to recent leaflets\n- Access settings\n\n**Recent Leaflets:**\n- See your latest 5 leaflets with quick edit/view links',
  },

  // â”€â”€ Settings â”€â”€
  {
    id: 'settings', label: 'account settings',
    keywords: ['settings', 'account settings', 'profile settings', 'change name', 'change email',
      'update profile', 'notification settings', 'language settings', 'preferences',
      'my account', 'account page', 'settings page', 'how to access settings',
      'where are settings', 'find settings'],
    answer: 'settings **Account Settings:**\n\nGo to **Settings** from the user menu (top right) or click your avatar.\n\n**What you can manage:**\n- **Profile** â€” update your name and profile picture\n- **Email** â€” change your email address (requires verification)\n- **Password** â€” change your password\n- **Billing** â€” manage your plan, view invoices, update payment method\n- **Notifications** â€” control email notification preferences\n- **Danger Zone** â€” delete your account permanently',
  },
];

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WELCOME = "Hi! ðŸ‘‹ I'm the LeafletAI assistant.\n\nI can help you with creating leaflets, importing products, exporting, billing, and more. What do you need help with?";

const QUICK_CHIPS = [
  'All features',
  'Import products',
  'Export PDF',
  'Flipbook viewer',
  'Pricing plans',
];

const FALLBACK = "I'm not entirely sure what you mean. ðŸ¤”\n\nCould you rephrase, or try asking something like:\n- *\"How do I export a PDF?\"*\n- *\"How do I import products?\"*\n- *\"What are the pricing plans?\"*\n\nOr reach us directly at **info@leafletai.ai**.";

const CLARIFY_PREFIX = "I think you're asking about **{label}** â€” here's what I know:\n\n";

// â”€â”€ Text normalisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Expands contractions, lowercases, strips punctuation, and maps synonyms
function normalise(raw: string): string {
  let t = raw.toLowerCase();

  // Contractions
  t = t.replace(/don['']t/g, 'do not')
       .replace(/doesn['']t/g, 'does not')
       .replace(/can['']t/g, 'cannot')
       .replace(/won['']t/g, 'will not')
       .replace(/i['']m/g, 'i am')
       .replace(/what['']s/g, 'what is')
       .replace(/how['']s/g, 'how is')
       .replace(/it['']s/g, 'it is')
       .replace(/that['']s/g, 'that is')
       .replace(/there['']s/g, 'there is')
       .replace(/i['']ve/g, 'i have')
       .replace(/i['']d/g, 'i would')
       .replace(/i['']ll/g, 'i will')
       .replace(/you['']re/g, 'you are')
       .replace(/they['']re/g, 'they are')
       .replace(/we['']re/g, 'we are')
       .replace(/wasn['']t/g, 'was not')
       .replace(/aren['']t/g, 'are not')
       .replace(/isn['']t/g, 'is not');

  // Domain synonyms â€” map user terms to KB terms
  t = t.replace(/\bbrochure\b/g, 'leaflet')
       .replace(/\bcatalogue\b/g, 'leaflet')
       .replace(/\bcatalog\b/g, 'leaflet')
       .replace(/\bflyer\b/g, 'leaflet')
       .replace(/\bpamphlet\b/g, 'leaflet')
       .replace(/\bdigital catalog\b/g, 'leaflet')
       .replace(/\bitem\b/g, 'product')
       .replace(/\bproduct item\b/g, 'product')
       .replace(/\bgoods\b/g, 'product')
       .replace(/\bdownload\b/g, 'export')
       .replace(/\bsave\b/g, 'export')
       .replace(/\bgenerate\b/g, 'export')
       .replace(/\bbring in\b/g, 'import')
       .replace(/\bload\b/g, 'import')
       .replace(/\bupload\b/g, 'import')
       .replace(/\bbuild\b/g, 'create')
       .replace(/\bmake\b/g, 'create')
       .replace(/\bbegin\b/g, 'start')
       .replace(/\bpicture\b/g, 'image')
       .replace(/\bphoto\b/g, 'image')
       .replace(/\btypeface\b/g, 'font')
       .replace(/\btype face\b/g, 'font')
       .replace(/\bhow much does it cost\b/g, 'price')
       .replace(/\bwhat does it cost\b/g, 'price')
       .replace(/\bpassword help\b/g, 'reset password')
       .replace(/\bforgot my password\b/g, 'forgot password')
       .replace(/\bnot working\b/g, 'error')
       .replace(/\bdoes not work\b/g, 'error')
       .replace(/\bbroken\b/g, 'error')
       .replace(/\bwont work\b/g, 'error');

  // Strip punctuation (keep spaces)
  t = t.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

// â”€â”€ Scoring engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface MatchResult {
  entry: KBEntry;
  score: number;
  matchedKw: string;
}

function scoreEntry(norm: string, entry: KBEntry): number {
  let score = 0;
  for (const kw of entry.keywords) {
    const normKw = kw.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (norm.includes(normKw)) {
      // Weight by phrase length â€” multi-word matches are more specific
      score += normKw.split(' ').length * 2;
    }
  }
  return score;
}

function findBestMatch(norm: string): MatchResult | null {
  let best: MatchResult | null = null;
  for (const entry of KB) {
    const score = scoreEntry(norm, entry);
    if (score > 0 && (!best || score > best.score)) {
      const matched = entry.keywords.find(kw => norm.includes(kw.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim())) ?? '';
      best = { entry, score, matchedKw: matched };
    }
  }
  return best;
}

// Confidence thresholds
const HIGH_CONF  = 4;  // multi-word match â†’ answer directly
const LOW_CONF   = 2;  // single-word match â†’ prefix with "I think you're asking about X"

function respond(userText: string, lastTopicId: string | null): string {
  const norm = normalise(userText);

  // Very short / vague follow-up? Use context if available
  if (norm.split(' ').length <= 2 && lastTopicId) {
    const ctxEntry = KB.find(e => e.id === lastTopicId);
    if (ctxEntry) {
      const score = scoreEntry(norm, ctxEntry);
      if (score === 0) {
        // completely off-topic short message â€” try regular search
      } else {
        return ctxEntry.answer;
      }
    }
  }

  const match = findBestMatch(norm);

  if (!match) return FALLBACK;

  if (match.score >= HIGH_CONF) {
    return match.entry.answer;
  }

  // Low confidence â€” prefix with interpretation
  return CLARIFY_PREFIX.replace('{label}', match.entry.label) + match.entry.answer;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={j}>{p.slice(2, -2)}</strong>;
      }
      // Handle *italic* for clarification prefix
      const italicParts = p.split(/(\*[^*]+\*)/g).map((ip, k) => {
        if (ip.startsWith('*') && ip.endsWith('*')) {
          return <em key={k}>{ip.slice(1, -1)}</em>;
        }
        const linkParts = ip.split(/(\[[^\]]+\]\([^)]+\))/g).map((lp, l) => {
          const m = lp.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (m) return <a key={l} href={m[2]} className="cb-link">{m[1]}</a>;
          return lp;
        });
        return <span key={k}>{linkParts}</span>;
      });
      return <span key={j}>{italicParts}</span>;
    });
    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ChatBot() {
  const [open, setOpen]             = useState(false);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [typing, setTyping]         = useState(false);
  const [unread, setUnread]         = useState(false);
  const [chipsShown, setChipsShown] = useState(true);
  const [lastTopic, setLastTopic]   = useState<string | null>(null);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: WELCOME, ts: new Date() }]);
    }
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { role: 'user', text: trimmed, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setChipsShown(false);
    setTyping(true);

    const delay = 450 + Math.random() * 350;
    setTimeout(() => {
      const answer = respond(trimmed, lastTopic);
      // Update last topic
      const norm  = normalise(trimmed);
      const match = findBestMatch(norm);
      if (match && match.score >= LOW_CONF) setLastTopic(match.entry.id);

      setTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text: answer, ts: new Date() }]);
      if (!open) setUnread(true);
    }, delay);
  }, [open, lastTopic]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([{ role: 'bot', text: WELCOME, ts: new Date() }]);
    setChipsShown(true);
    setLastTopic(null);
  }

  return (
    <>
      {/* â”€â”€ Trigger button â”€â”€ */}
      <button
        className={`cb-trigger${open ? ' cb-trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
      >
        <span className="cb-trigger-icon">{open ? 'close' : 'smart_toy'}</span>
        {unread && !open && <span className="cb-badge" aria-label="Unread message" />}
      </button>

      {/* â”€â”€ Chat window â”€â”€ */}
      {open && (
        <div className="cb-window" role="dialog" aria-label="LeafletAI chat assistant">
          <div className="cb-header">
            <div className="cb-avatar material-symbol">smart_toy</div>
            <div className="cb-header-info">
              <strong>LeafletAI Assistant</strong>
              <span className="cb-status"><span className="material-symbol">fiber_manual_record</span> Online</span>
            </div>
            <div className="cb-header-actions">
              <button className="cb-icon-btn" onClick={clearChat} title="Clear chat" aria-label="Clear chat">delete</button>
              <button className="cb-icon-btn" onClick={() => setOpen(false)} title="Close" aria-label="Close chat">close</button>
            </div>
          </div>

          <div className="cb-messages">
            {messages.map((m, i) => (
              <div key={i} className={`cb-row cb-row--${m.role}`}>
                {m.role === 'bot' && <div className="cb-bot-avatar material-symbol">smart_toy</div>}
                <div className={`cb-bubble cb-bubble--${m.role}`}>
                  <div className="cb-bubble-text">{renderText(m.text)}</div>
                  <div className="cb-ts">{fmt(m.ts)}</div>
                </div>
              </div>
            ))}

            {chipsShown && messages.length === 1 && (
              <div className="cb-chips">
                {QUICK_CHIPS.map(chip => (
                  <button key={chip} className="cb-chip" onClick={() => sendMessage(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {typing && (
              <div className="cb-row cb-row--bot">
                <div className="cb-bot-avatar material-symbol">smart_toy</div>
                <div className="cb-bubble cb-bubble--bot cb-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="cb-input-row">
            <textarea
              ref={inputRef}
              className="cb-input"
              rows={1}
              placeholder="Ask a questionâ€¦"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              aria-label="Type your message"
            />
            <button
              className="cb-send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              aria-label="Send message"
            >
              âž¤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

