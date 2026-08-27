export type CheckoutPlanId = 'starter' | 'pro' | 'business';

export interface PlanFeature {
  label: string;
  [planId: string]: string | boolean;
}

export interface PricingPlan {
  id: 'free' | 'starter' | 'pro' | 'business' | 'agency';
  name: string;
  badge?: string | null;
  monthlyPrice: number;
  yearlyPrice?: number;
  annualPrice?: number;
  annualPriceLabel?: string;
  pricePrefix?: string;
  desc: string;
  cta: string;
  ctaVariant: 'ghost' | 'primary' | 'brand2';
  highlight?: boolean;
  features?: string[];
  checkoutPlanId?: CheckoutPlanId | 'contact' | 'free';
}

export const DEFAULT_FEATURES: PlanFeature[] = [
  { label: 'Leaflets per month',       free: '1', starter: '5',  pro: '25', business: '100', agency: 'High-volume' },
  { label: 'Products per leaflet',     free: '20', starter: '100', pro: 'Large imports', business: true, agency: true },
  { label: 'CSV and XLSX import',      free: true, starter: true, pro: true, business: true, agency: true },
  { label: '2-language layouts',       free: true, starter: true, pro: true, business: true, agency: true },
  { label: 'PDF and PNG export',       free: false, starter: true, pro: true, business: true, agency: true },
  { label: 'Watermark removed',        free: false, starter: true, pro: true, business: true, agency: true },
  { label: 'Brand kits and templates', free: false, starter: false, pro: true, business: true, agency: true },
  { label: 'Concurrent logins',        free: '1 device', starter: '2 devices', pro: '3 devices', business: '5 devices', agency: '10+ devices' },
];

export const DEFAULT_PLANS: PricingPlan[] = [
  {
    id:           'free',
    name:         'Free',
    badge:        null,
    monthlyPrice: 0,
    yearlyPrice:  0,
    annualPrice:  0,
    desc:         'Explore LeafletAI and create your first promotional leaflet.',
    cta:          'Start for Free',
    ctaVariant:   'ghost',
    highlight:    false,
    checkoutPlanId: 'free',
    features: [
      '1 leaflet per month',
      'Up to 20 products per leaflet',
      'Basic leaflet templates',
      'CSV and XLSX product import',
      '2-language support',
      'Standard-quality export',
      'LeafletAI watermark',
      'Concurrent logins: 1 device',
    ],
  },
  {
    id:           'starter',
    name:         'Starter',
    badge:        null,
    monthlyPrice: 13.34,
    yearlyPrice:  133.42 / 12,
    annualPrice:  133.42,
    desc:         'Perfect for small shops and businesses that create promotional leaflets occasionally.',
    cta:          'Choose Starter',
    ctaVariant:   'ghost',
    highlight:    false,
    checkoutPlanId: 'starter',
    features: [
      'Up to 5 leaflets per month',
      'Up to 100 products per leaflet',
      'CSV and XLSX product import',
      '2-language layouts',
      'Basic template library',
      'PDF and PNG export',
      'No LeafletAI watermark',
      'Save and edit your leaflets',
      'Concurrent logins: 2 devices',
    ],
  },
  {
    id:           'pro',
    name:         'Professional',
    badge:        'Most Popular',
    monthlyPrice: 26.96,
    yearlyPrice:  269.57 / 12,
    annualPrice:  269.57,
    desc:         'The best choice for supermarkets and active retailers that regularly create promotional campaigns.',
    cta:          'Choose Professional',
    ctaVariant:   'primary',
    highlight:    true,
    checkoutPlanId: 'pro',
    features: [
      'Up to 25 leaflets per month',
      'Large product imports',
      'Access to all premium templates',
      'High-quality print-ready PDF export',
      '2-language layouts',
      'Custom fonts',
      'Brand kit with logos, colors, and fonts',
      'Background removal tools',
      'Custom reusable templates',
      'Priority support',
      'Concurrent logins: 3 devices',
    ],
  },
  {
    id:           'business',
    name:         'Business',
    badge:        null,
    monthlyPrice: 67.80,
    yearlyPrice:  677.99 / 12,
    annualPrice:  677.99,
    desc:         'Designed for marketing teams, multi-branch retailers, and businesses managing frequent promotional campaigns.',
    cta:          'Choose Business',
    ctaVariant:   'brand2',
    highlight:    false,
    checkoutPlanId: 'business',
    features: [
      'Up to 100 leaflets per month',
      'Concurrent logins: 5 devices',
      'Multiple brands and branches',
      'Shared product library',
      'Shared brand assets and templates',
      'Team collaboration',
      'User roles and permissions',
      'High-quality PDF and PNG export',
      'Advanced AI tools',
      'Higher AI usage limits',
      'Priority customer support',
      'Branch-specific logos and contact details',
    ],
  },
  {
    id:           'agency',
    name:         'Agency',
    badge:        null,
    monthlyPrice: 163.10,
    yearlyPrice:  0,
    annualPriceLabel: 'Custom annual pricing',
    pricePrefix:  'Starting from',
    desc:         'Built for agencies and large organizations managing multiple brands, stores, or clients.',
    cta:          'Contact Sales',
    ctaVariant:   'ghost',
    highlight:    false,
    checkoutPlanId: 'contact',
    features: [
      'High-volume or unlimited leaflet creation',
      'Multiple client workspaces',
      'Concurrent logins: 10+ devices',
      'Separate brand kits for each client',
      'White-label leaflet exports',
      'Advanced team permissions',
      'Bulk product and design management',
      'Custom templates for each client',
      'Batch export tools',
      'Premium customer support',
      'Custom onboarding and training',
    ],
  },
];

export const DEFAULT_ANNUAL_BILLING = {
  title: 'Annual Billing',
  subtitle: 'Save up to 17% with annual billing. Get two months free when you pay annually.',
  items: [
    'Starter: $133.42 per year',
    'Professional: $269.57 per year',
    'Business: $677.99 per year',
    'Agency: Custom annual pricing',
  ],
};

export const DEFAULT_FAQ = [
  { q: 'Can I change plans at any time?',                      a: "Yes. You can upgrade or downgrade at any time. Changes take effect immediately and we'll prorate any charges." },
  { q: 'Is there a free trial for paid plans?',                a: "Pro comes with a 14-day free trial - no credit card required. Business plans get a personalised demo." },
  { q: 'What happens when I hit my leaflet limit?',            a: "You'll be prompted to upgrade. Existing leaflets remain fully accessible; you just can't create new ones until you upgrade or delete old ones." },
  { q: 'Do you offer discounts for non-profits or education?', a: "Yes - contact us at sales@leafletai.com with proof of status and we'll apply a 40% discount." },
  { q: 'What payment methods do you accept?',                  a: "We accept all major credit and debit cards via Stripe. Annual invoicing is available on Business plans." },
  { q: 'Can I cancel anytime?',                                a: "Absolutely. Cancel from your account settings with one click. You keep access until the end of your billing period." },
];

export function planCheckoutId(plan: PricingPlan): PricingPlan['checkoutPlanId'] {
  return plan.checkoutPlanId || (plan.id === 'agency' ? 'contact' : plan.id);
}

export function planDisplayName(planId: string) {
  if (planId === 'admin') return 'Admin';
  if (planId === 'pro') return 'Professional';
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

export function findPricingPlan(plans: PricingPlan[], planId: string): PricingPlan | undefined {
  return plans.find(plan => plan.id === planId || planCheckoutId(plan) === planId);
}

export function planFeatureList(plan: PricingPlan | undefined, planId: string, features: PlanFeature[]) {
  if (Array.isArray(plan?.features) && plan.features.length) return plan.features;
  return features
    .map(feature => {
      const value = feature[planId];
      if (value === undefined || value === null || value === false || value === '') return '';
      if (value === true) return feature.label;
      return `${value} ${feature.label}`;
    })
    .filter(Boolean);
}
