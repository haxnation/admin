/**
 * googleFonts.js — shared Google Fonts catalogue + loader for certificate rendering.
 *
 * No API key required: the designer offers a curated list of popular
 * certificate-friendly families (all on Google Fonts with 400 + 700 weights),
 * and fonts are loaded on demand via the CSS2 API:
 *   https://fonts.googleapis.com/css2?family=<Fam>:wght@400;700&display=swap
 * plus document.fonts.load() so canvas measurement uses the real typeface.
 */

export const GOOGLE_CERT_FONTS = [
    // Sans — clean / modern
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway',
    'Poppins', 'Inter', 'Nunito', 'Quicksand', 'Comfortaa', 'Ubuntu',
    'Josefin Sans', 'Archivo', 'Bebas Neue', 'Anton',
    // Serif — formal certificates
    'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Cinzel',
    'Cormorant Garamond', 'Libre Baskerville', 'Crimson Pro', 'EB Garamond',
    'Italiana', 'Marcellus', 'Abril Fatface', 'Patua One', 'Vollkorn',
    'Old Standard TT', 'Alice', 'Alegreya', 'Roboto Slab', 'Bitter', 'Zilla Slab',
    // Script / handwriting — names & signatures
    'Great Vibes', 'Dancing Script', 'Allura', 'Parisienne', 'Sacramento',
    'Alex Brush', 'Tangerine', 'Pinyon Script',
    // Display / fun
    'Lobster', 'Pacifico', 'Caveat', 'Alfa Slab One',
];

/** Alphabetical (case-insensitive) view of the catalogue for pickers. */
export const SORTED_CERT_FONTS = [...new Set(GOOGLE_CERT_FONTS)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
);

const LINK_ID = 'google-cert-fonts';
const loadedFamilies = new Set();

function cssFamilyParam(family) {
    return family.trim().replace(/\s+/g, '+') + ':wght@400;700';
}

export function googleFontsURL(families) {
    const uniq = [...new Set((families || []).map(f => (f || '').trim()).filter(Boolean))];
    if (!uniq.length) return null;
    return 'https://fonts.googleapis.com/css2?' +
        uniq.map(cssFamilyParam).map(p => 'family=' + p).join('&') +
        '&display=swap';
}

function ensureLinkTag(families) {
    const href = googleFontsURL(families);
    if (!href) return;
    let link = document.getElementById(LINK_ID);
    if (!link) {
        link = document.createElement('link');
        link.id = LINK_ID;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    // Merge: keep every family ever requested so switching fields never unloads.
    const existing = new Set(
        (link.dataset.families || '').split('|').map(s => s.trim()).filter(Boolean)
    );
    families.forEach(f => existing.add(f.trim()));
    link.dataset.families = [...existing].join('|');
    link.href = googleFontsURL([...existing]);
}

/**
 * Load the given families (400 + 700) and wait until canvas can use them.
 * Safe to call repeatedly — already-loaded families resolve immediately.
 */
export async function ensureGoogleFontsLoaded(families) {
    const wanted = [...new Set((families || []).map(f => (f || '').trim()).filter(Boolean))];
    if (!wanted.length || !('fonts' in document)) return;
    const missing = wanted.filter(f => !loadedFamilies.has(f));
    if (missing.length) ensureLinkTag(missing);
    try {
        await Promise.all(wanted.flatMap(fam => [
            document.fonts.load(`400 20px "${fam}"`),
            document.fonts.load(`700 20px "${fam}"`),
        ]));
        wanted.forEach(f => loadedFamilies.add(f));
    } catch (e) {
        console.warn('[fonts] Google Fonts load failed, canvas falls back:', e);
    }
}

/** Legacy template compat: "Roboto-Bold.ttf" -> "Roboto", etc. */
export function normalizeFontFamily(value, fallback = 'Roboto') {
    let s = (value || '').trim();
    if (!s) return fallback;
    if (/\.ttf$/i.test(s)) {
        s = s.replace(/\.ttf$/i, '').replace(/[-_]Bold$/i, '').replace(/[-_]Regular$/i, '').replace(/[-_]/g, ' ').trim();
        if (!s) return fallback;
    }
    return s;
}
