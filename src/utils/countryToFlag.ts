function isoToFlag(code: string): string {
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65)
  ).join('');
}

export interface CountryEntry {
  name_en:    string;
  iso_code:   string;
  flag_emoji: string;
  aliases:    string[];
}

const RAW: [string, string, string[]][] = [
  // [name_en, iso_code, aliases]
  ['Afghanistan',           'AF', ['افغانستان']],
  ['Albania',               'AL', ['Shqipëri']],
  ['Algeria',               'DZ', ['الجزائر','Algérie']],
  ['Angola',                'AO', []],
  ['Argentina',             'AR', ['Argentine']],
  ['Armenia',               'AM', ['Հայաստան']],
  ['Australia',             'AU', []],
  ['Austria',               'AT', ['Österreich','Autriche']],
  ['Azerbaijan',            'AZ', ['Azərbaycan']],
  ['Bahrain',               'BH', ['البحرين']],
  ['Bangladesh',            'BD', ['বাংলাদেশ']],
  ['Belarus',               'BY', ['Беларусь']],
  ['Belgium',               'BE', ['Belgique','Belgien']],
  ['Bolivia',               'BO', []],
  ['Bosnia and Herzegovina','BA', ['Bosna']],
  ['Brazil',                'BR', ['Brasil','Brésil']],
  ['Bulgaria',              'BG', ['България']],
  ['Cambodia',              'KH', ['Cambodge']],
  ['Cameroon',              'CM', ['Cameroun']],
  ['Canada',                'CA', []],
  ['Chile',                 'CL', []],
  ['China',                 'CN', ['中国','الصين','Chine']],
  ['Colombia',              'CO', ['Colombie']],
  ['Costa Rica',            'CR', []],
  ['Croatia',               'HR', ['Hrvatska']],
  ['Cuba',                  'CU', []],
  ['Czech Republic',        'CZ', ['Czechia','Tschechien','République tchèque']],
  ['Denmark',               'DK', ['Danmark','Danemark']],
  ['Djibouti',              'DJ', ['جيبوتي','Dschibuti']],
  ['Ecuador',               'EC', []],
  ['Egypt',                 'EG', ['مصر','Égypte']],
  ['El Salvador',           'SV', []],
  ['Ethiopia',              'ET', ['ኢትዮጵያ']],
  ['Finland',               'FI', ['Suomi','Finlande']],
  ['France',                'FR', ['فرنسا']],
  ['Georgia',               'GE', ['საქართველო']],
  ['Germany',               'DE', ['Deutschland','Allemagne','ألمانيا']],
  ['Ghana',                 'GH', []],
  ['Greece',                'GR', ['Ελλάδα','Grèce','EL']],
  ['Guatemala',             'GT', []],
  ['Hong Kong',             'HK', ['香港']],
  ['Hungary',               'HU', ['Magyarország','Hongrie']],
  ['Iceland',               'IS', ['Ísland']],
  ['India',                 'IN', ['الهند','Inde','भारत']],
  ['Indonesia',             'ID', ['Indonésie']],
  ['Iran',                  'IR', ['إيران','Irán']],
  ['Iraq',                  'IQ', ['العراق']],
  ['Ireland',               'IE', ['Éire','Irlande']],
  ['Israel',                'IL', ['إسرائيل']],
  ['Italy',                 'IT', ['Italia','Italie','إيطاليا']],
  ['Japan',                 'JP', ['日本','Japon','اليابان']],
  ['Jordan',                'JO', ['الأردن','Jordanie']],
  ['Kazakhstan',            'KZ', ['Казахстан']],
  ['Kenya',                 'KE', []],
  ['Kuwait',                'KW', ['الكويت']],
  ['Kyrgyzstan',            'KG', ['Кыргызстан']],
  ['Laos',                  'LA', ['ລາວ']],
  ['Latvia',                'LV', ['Latvija']],
  ['Lebanon',               'LB', ['لبنان','Liban']],
  ['Libya',                 'LY', ['ليبيا']],
  ['Lithuania',             'LT', ['Lietuva']],
  ['Luxembourg',            'LU', ['Luxemburg']],
  ['Malaysia',              'MY', ['ماليزيا']],
  ['Maldives',              'MV', ['ދިވެހިރާއްޖެ']],
  ['Malta',                 'MT', []],
  ['Mauritania',            'MR', ['موريتانيا']],
  ['Mauritius',             'MU', ['Maurice']],
  ['Mexico',                'MX', ['México','Mexique','المكسيك']],
  ['Moldova',               'MD', ['Молдова']],
  ['Mongolia',              'MN', ['Монгол']],
  ['Morocco',               'MA', ['المغرب','Maroc']],
  ['Mozambique',            'MZ', ['Moçambique']],
  ['Myanmar',               'MM', ['Burma','برمه']],
  ['Nepal',                 'NP', ['नेपाल']],
  ['Netherlands',           'NL', ['Holland','Nederland','Pays-Bas','هولندا']],
  ['New Zealand',           'NZ', ['Nouvelle-Zélande']],
  ['Nicaragua',             'NI', []],
  ['Niger',                 'NE', []],
  ['Nigeria',               'NG', []],
  ['North Korea',           'KP', ['조선']],
  ['Norway',                'NO', ['Norge','Norvège']],
  ['Oman',                  'OM', ['عُمان']],
  ['Pakistan',              'PK', ['باكستان']],
  ['Palestine',             'PS', ['فلسطين']],
  ['Panama',                'PA', []],
  ['Paraguay',              'PY', []],
  ['Peru',                  'PE', ['Pérou']],
  ['Philippines',           'PH', ['Pilipinas']],
  ['Poland',                'PL', ['Polska','Pologne']],
  ['Portugal',              'PT', ['البرتغال']],
  ['Qatar',                 'QA', ['قطر']],
  ['Romania',               'RO', ['Roumanie']],
  ['Russia',                'RU', ['Россия','Russie','روسيا']],
  ['Rwanda',                'RW', []],
  ['Saudi Arabia',          'SA', ['المملكة العربية السعودية','السعودية','KSA']],
  ['Senegal',               'SN', ['Sénégal']],
  ['Serbia',                'RS', ['Srbija']],
  ['Singapore',             'SG', ['سنغافورة']],
  ['Slovakia',              'SK', ['Slovensko']],
  ['Slovenia',              'SI', ['Slovenija']],
  ['Somalia',               'SO', ['الصومال']],
  ['South Africa',          'ZA', ['جنوب أفريقيا','Afrique du Sud']],
  ['South Korea',           'KR', ['Korea','한국','Corée du Sud','كوريا الجنوبية','كوريا']],
  ['Spain',                 'ES', ['España','Espagne','إسبانيا']],
  ['Sri Lanka',             'LK', ['سريلانكا']],
  ['Sudan',                 'SD', ['السودان']],
  ['Sweden',                'SE', ['Sverige','Suède','السويد']],
  ['Switzerland',           'CH', ['Schweiz','Suisse','سويسرا']],
  ['Syria',                 'SY', ['سوريا','Syrie']],
  ['Taiwan',                'TW', ['台灣']],
  ['Tajikistan',            'TJ', ['Тоҷикистон']],
  ['Tanzania',              'TZ', []],
  ['Thailand',              'TH', ['ประเทศไทย','تايلاند']],
  ['Tunisia',               'TN', ['تونس','Tunisie']],
  ['Turkey',                'TR', ['Türkiye','Türkei','تركيا']],
  ['Turkmenistan',          'TM', ['Türkmenistan']],
  ['Uganda',                'UG', []],
  ['Ukraine',               'UA', ['Україна','Украина']],
  ['United Arab Emirates',  'AE', ['الإمارات','الإمارات العربية المتحدة','UAE','Émirats arabes unis']],
  ['United Kingdom',        'GB', ['UK','Britain','Great Britain','England','المملكة المتحدة','Royaume-Uni']],
  ['United States',         'US', ['USA','US','America','أمريكا','الولايات المتحدة','الولايات المتحدة الأمريكية','États-Unis']],
  ['Uruguay',               'UY', []],
  ['Uzbekistan',            'UZ', ['Ўзбекистон']],
  ['Venezuela',             'VE', ['Vénézuéla']],
  ['Vietnam',               'VN', ['Việt Nam','فيتنام']],
  ['Yemen',                 'YE', ['اليمن']],
  ['Zambia',                'ZM', []],
  ['Zimbabwe',              'ZW', []],
];

export const COUNTRY_LIST: CountryEntry[] = RAW.map(([name_en, iso_code, aliases]) => ({
  name_en,
  iso_code,
  flag_emoji: isoToFlag(iso_code),
  aliases,
})).sort((a, b) => a.name_en.localeCompare(b.name_en));

/* Flat lookup map: all keys (name, aliases, iso) → CountryEntry */
const LOOKUP = new Map<string, CountryEntry>();
for (const c of COUNTRY_LIST) {
  LOOKUP.set(c.name_en.toLowerCase(), c);
  LOOKUP.set(c.iso_code.toLowerCase(), c);
  for (const a of c.aliases) LOOKUP.set(a.toLowerCase(), c);
}

/**
 * Try to match `text` against the country list (name, ISO, aliases).
 * Returns the CountryEntry if found, null otherwise.
 */
export function normalizeCountry(text: string): CountryEntry | null {
  if (!text) return null;
  const key = text.trim().replace(/\s+/g, ' ').toLowerCase();
  return LOOKUP.get(key) ?? null;
}

/** Convert a country name/ISO/alias to its flag emoji. */
export function countryToFlag(text: string): string {
  if (!text) return '';
  const entry = normalizeCountry(text);
  if (entry) return entry.flag_emoji;
  // fallback: treat as raw 2-letter ISO
  const t = text.trim();
  if (/^[A-Za-z]{2}$/.test(t))
    return [...t.toUpperCase()].map(c =>
      String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65)
    ).join('');
  return '';
}

/**
 * Resolve a country name / ISO code / alias to its 2-letter ISO 3166-1 alpha-2
 * code (lower-case), or null if unrecognised.
 * Used for rendering flag images via flagcdn.com.
 */
export function countryToIso(text: string): string | null {
  if (!text) return null;
  const entry = normalizeCountry(text);
  if (entry) return entry.iso_code.toLowerCase();
  const t = text.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toLowerCase();
  return null;
}
