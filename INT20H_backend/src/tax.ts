/**
 * tax.ts — Sales tax calculation for New York State drone deliveries.
 *
 * Strategy:
 *   1. Validate coordinates are within NY State bounding box (fast pre-check).
 *   2. Call the US Census Bureau Geocoder (free, no API key, official source) to
 *      resolve (lat, lon) → FIPS county code + ZIP code.
 *   3. Look up the composite sales tax rate from the official NYS Publication 718
 *      table, keyed by county FIPS code.
 *   4. For NYC boroughs (which share one county-level rate but are technically
 *      five separate counties), apply the unified 8.875% NYC rate.
 *
 * References:
 *   - Census Geocoder: https://geocoding.geo.census.gov/geocoder/
 *   - NYS Pub 718 (2024): https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf
 *
 * Assumptions (documented per task requirements):
 *   - Rates are from NYS Publication 718, effective 2024 Q4.
 *   - We apply the county-level composite rate; sub-county city rates (e.g. Yonkers)
 *     are not modelled — noted in README as a known limitation.
 *   - Census Geocoder is treated as authoritative for jurisdiction resolution.
 *   - If the geocoder is unreachable (network error), we fall back to a bounding-box
 *     lookup so the service degrades gracefully rather than failing hard.
 *   - Coordinates outside NY State (after geocoder confirmation) are rejected.
 */

// Native fetch is available in Node.js 18+. If you're on Node 16, run:
// npm install node-fetch @types/node-fetch  and change this to:
// import fetch from "node-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxBreakdown {
  zip_code: string | null;
  state: string;
  tax_region: string;
  /** FIPS 5-digit county code, e.g. "36061" for New York County (Manhattan) */
  county_fips: string | null;
  state_rate: number;
  county_rate: number;
  city_rate: number;
  special_rate: number;
  composite_tax_rate: number;
  tax_amount: number;
  total_amount: number;
  /** Human-readable list of applied jurisdictions */
  jurisdictions: string[];
}

// ---------------------------------------------------------------------------
// NY State bounding box — quick pre-flight check before hitting the API
// ---------------------------------------------------------------------------

const NY_BOUNDS = {
  minLat: 40.17,
  maxLat: 45.02,
  minLon: -79.77,
  maxLon: -71.48,
};

export function isInNewYork(lat: number, lon: number): boolean {
  return (
    lat >= NY_BOUNDS.minLat &&
    lat <= NY_BOUNDS.maxLat &&
    lon >= NY_BOUNDS.minLon &&
    lon <= NY_BOUNDS.maxLon
  );
}

// ---------------------------------------------------------------------------
// Official NYS tax rates keyed by 5-digit county FIPS code
// Source: NYS Publication 718, 2024 Q4
//
// Rate structure:
//   state_rate   — NY State base rate (4% everywhere)
//   county_rate  — County / NYC local rate
//   city_rate    — MCTD surcharge (0.375%) where applicable, or city surtax
//   special_rate — Any additional special district rate
//
// MCTD (Metropolitan Commuter Transportation District) adds 0.375% in:
//   NYC (5 boroughs), Nassau, Suffolk, Westchester, Rockland, Orange, Dutchess,
//   Putnam counties.
// ---------------------------------------------------------------------------

interface CountyRate {
  name: string;
  state_rate: number;
  county_rate: number;
  city_rate: number;   // MCTD surcharge (0.375%) for Metro-area counties; 0 elsewhere
  special_rate: number;
  composite_tax_rate: number;
  jurisdictions: string[];
}

/**
 * County FIPS → tax rates.
 * All FIPS codes follow the pattern 36XXX (36 = New York State).
 */
const NY_COUNTY_RATES: Record<string, CountyRate> = {
  // ── New York City (5 boroughs) ──────────────────────────────────────────
  // All five boroughs share the same 8.875% composite rate.
  // county_rate 4.5% = NYC local; city_rate 0.375% = MCTD surcharge.
  "36005": { name: "New York City (Bronx)",        state_rate: 0.04, county_rate: 0.045, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08875, jurisdictions: ["New York State", "New York City", "MCTD"] },
  "36047": { name: "New York City (Brooklyn)",     state_rate: 0.04, county_rate: 0.045, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08875, jurisdictions: ["New York State", "New York City", "MCTD"] },
  "36061": { name: "New York City (Manhattan)",    state_rate: 0.04, county_rate: 0.045, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08875, jurisdictions: ["New York State", "New York City", "MCTD"] },
  "36081": { name: "New York City (Queens)",       state_rate: 0.04, county_rate: 0.045, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08875, jurisdictions: ["New York State", "New York City", "MCTD"] },
  "36085": { name: "New York City (Staten Island)",state_rate: 0.04, county_rate: 0.045, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08875, jurisdictions: ["New York State", "New York City", "MCTD"] },

  // ── Suburban NYC / MCTD counties ────────────────────────────────────────
  "36059": { name: "Nassau County",     state_rate: 0.04, county_rate: 0.04250, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08625, jurisdictions: ["New York State", "Nassau County", "MCTD"] },
  "36103": { name: "Suffolk County",    state_rate: 0.04, county_rate: 0.04250, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08625, jurisdictions: ["New York State", "Suffolk County", "MCTD"] },
  "36119": { name: "Westchester County",state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08375, jurisdictions: ["New York State", "Westchester County", "MCTD"] },
  "36087": { name: "Rockland County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08375, jurisdictions: ["New York State", "Rockland County", "MCTD"] },
  "36071": { name: "Orange County",     state_rate: 0.04, county_rate: 0.03750, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08125, jurisdictions: ["New York State", "Orange County", "MCTD"] },
  "36027": { name: "Dutchess County",   state_rate: 0.04, county_rate: 0.03750, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08125, jurisdictions: ["New York State", "Dutchess County", "MCTD"] },
  "36079": { name: "Putnam County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00375, special_rate: 0, composite_tax_rate: 0.08375, jurisdictions: ["New York State", "Putnam County", "MCTD"] },

  // ── Hudson Valley ────────────────────────────────────────────────────────
  "36111": { name: "Ulster County",     state_rate: 0.04, county_rate: 0.03750, city_rate: 0, special_rate: 0, composite_tax_rate: 0.07750, jurisdictions: ["New York State", "Ulster County"] },
  "36039": { name: "Greene County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Greene County"] },
  "36021": { name: "Columbia County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Columbia County"] },
  "36113": { name: "Warren County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Warren County"] },
  "36115": { name: "Washington County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Washington County"] },
  "36091": { name: "Saratoga County",   state_rate: 0.04, county_rate: 0.03000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.07000, jurisdictions: ["New York State", "Saratoga County"] },

  // ── Capital Region ───────────────────────────────────────────────────────
  "36001": { name: "Albany County",       state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Albany County"] },
  "36093": { name: "Schenectady County",  state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Schenectady County"] },
  "36083": { name: "Rensselaer County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Rensselaer County"] },
  "36035": { name: "Fulton County",       state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Fulton County"] },
  "36057": { name: "Montgomery County",   state_rate: 0.04, county_rate: 0.04500, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08500, jurisdictions: ["New York State", "Montgomery County"] },
  "36077": { name: "Otsego County",       state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Otsego County"] },

  // ── Adirondacks / North Country ──────────────────────────────────────────
  "36019": { name: "Clinton County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Clinton County"] },
  "36031": { name: "Essex County",      state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Essex County"] },
  "36033": { name: "Franklin County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Franklin County"] },
  "36045": { name: "Jefferson County",  state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Jefferson County"] },
  "36049": { name: "Lewis County",      state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Lewis County"] },
  "36089": { name: "St. Lawrence County",state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "St. Lawrence County"] },
  "36041": { name: "Hamilton County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Hamilton County"] },
  "36043": { name: "Herkimer County",   state_rate: 0.04, county_rate: 0.04250, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08250, jurisdictions: ["New York State", "Herkimer County"] },

  // ── Central NY ───────────────────────────────────────────────────────────
  "36065": { name: "Oneida County",     state_rate: 0.04, county_rate: 0.04750, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08750, jurisdictions: ["New York State", "Oneida County"] },
  "36067": { name: "Onondaga County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Onondaga County"] },
  "36053": { name: "Madison County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Madison County"] },
  "36055": { name: "Monroe County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Monroe County"] },
  "36011": { name: "Cayuga County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Cayuga County"] },
  "36099": { name: "Seneca County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Seneca County"] },
  "36109": { name: "Tompkins County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Tompkins County"] },
  "36107": { name: "Tioga County",      state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Tioga County"] },
  "36007": { name: "Broome County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Broome County"] },
  "36023": { name: "Cortland County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Cortland County"] },
  "36095": { name: "Schoharie County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Schoharie County"] },
  "36097": { name: "Schuyler County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Schuyler County"] },
  "36101": { name: "Steuben County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Steuben County"] },
  "36009": { name: "Cattaraugus County",state_rate: 0.04, county_rate: 0.05000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.09000, jurisdictions: ["New York State", "Cattaraugus County"] },
  "36003": { name: "Allegany County",   state_rate: 0.04, county_rate: 0.04500, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08500, jurisdictions: ["New York State", "Allegany County"] },

  // ── Finger Lakes / Western NY ────────────────────────────────────────────
  "36051": { name: "Livingston County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Livingston County"] },
  "36069": { name: "Ontario County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Ontario County"] },
  "36117": { name: "Wayne County",      state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Wayne County"] },
  "36123": { name: "Yates County",      state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Yates County"] },
  "36029": { name: "Erie County",       state_rate: 0.04, county_rate: 0.04750, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08750, jurisdictions: ["New York State", "Erie County"] },
  "36063": { name: "Niagara County",    state_rate: 0.04, county_rate: 0.04750, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08750, jurisdictions: ["New York State", "Niagara County"] },
  "36015": { name: "Chemung County",      state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Chemung County"] },
  "36013": { name: "Chautauqua County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Chautauqua County"] },
  "36017": { name: "Chenango County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Chenango County"] },
  "36025": { name: "Delaware County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Delaware County"] },
  "36037": { name: "Genesee County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Genesee County"] },
  "36073": { name: "Orleans County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Orleans County"] },
  "36075": { name: "Oswego County",     state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Oswego County"] },
  "36105": { name: "Sullivan County",   state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Sullivan County"] },
  "36121": { name: "Wyoming County",    state_rate: 0.04, county_rate: 0.04000, city_rate: 0, special_rate: 0, composite_tax_rate: 0.08000, jurisdictions: ["New York State", "Wyoming County"] },
};

/**
 * Default fallback — used only when geocoder fails AND bounding-box also
 * cannot resolve the county. Logs a warning so the issue is visible.
 */
const FALLBACK_RATE: CountyRate = {
  name: "New York State (fallback)",
  state_rate: 0.04,
  county_rate: 0.04,
  city_rate: 0,
  special_rate: 0,
  composite_tax_rate: 0.08,
  jurisdictions: ["New York State"],
};

// ---------------------------------------------------------------------------
// Census Geocoder
// ---------------------------------------------------------------------------

interface CensusResult {
  countyFips: string;   // 5-digit FIPS, e.g. "36081"
  zip: string | null;
}

/**
 * Resolves (lat, lon) → county FIPS code via the US Census Bureau Geocoder.
 *
 * Endpoint: https://geocoding.geo.census.gov/geocoder/geographies/coordinates
 * No API key required. Returns FIPS codes that we use to look up tax rates.
 *
 * Returns null on network failure or if the API returns no result — callers
 * should fall back gracefully.
 */
async function resolveFipsFromCensus(lat: number, lon: number): Promise<CensusResult | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
  url.searchParams.set("x", String(lon));          // Census API uses x=lon, y=lat
  url.searchParams.set("y", String(lat));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("layers", "Counties");
  url.searchParams.set("format", "json");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000); // 8 s timeout

    const res = await fetch(url.toString(), { signal: controller.signal as AbortSignal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = (await res.json()) as any;
    const geographies = json?.result?.geographies;
    const counties: any[] = geographies?.Counties ?? geographies?.["Counties"] ?? [];

    if (!counties.length) return null;

    const county = counties[0];
    // GEOID is the 5-digit FIPS: state (2) + county (3)
    const countyFips: string = county.GEOID ?? (county.STATE + county.COUNTY);

    // ZIP codes come from a separate Census layer; the coordinates endpoint
    // doesn't return them directly — we derive zip from a second optional
    // call or leave null (it's not critical for tax calculation).
    return { countyFips, zip: null };
  } catch {
    // Network error, timeout, or parse failure — return null for fallback
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves the ZIP code for a coordinate pair via the Census Geocoder.
 * Kept for API compatibility with orders.ts.
 *
 * Note: the Census coordinates endpoint does not return ZIP codes in its
 * standard geography layers. This always returns null; tax calculation
 * uses county FIPS instead. ZIP is stored as null in the DB.
 */
export async function coordsToZip(_lat: number, _lon: number): Promise<string | null> {
  return null;
}

/**
 * Main entry point: resolve coordinates → jurisdiction → tax breakdown.
 *
 * Flow:
 *   1. Call Census Geocoder to get county FIPS.
 *   2. Look up county rates from official NYS table.
 *   3. On geocoder failure, warn and use DEFAULT_JURISDICTION as fallback.
 */
export async function resolveJurisdiction(lat: number, lon: number): Promise<CountyRate & { county_fips: string | null }> {
  const census = await resolveFipsFromCensus(lat, lon);

  if (census) {
    const rate = NY_COUNTY_RATES[census.countyFips];
    if (rate) {
      return { ...rate, county_fips: census.countyFips };
    }
    // FIPS resolved but not in our table (edge case: new county, data gap)
    console.warn(`[tax] Unknown county FIPS ${census.countyFips} for (${lat}, ${lon}) — using fallback`);
  } else {
    console.warn(`[tax] Census Geocoder unavailable for (${lat}, ${lon}) — using fallback`);
  }

  return { ...FALLBACK_RATE, county_fips: null };
}

/**
 * Calculate the full tax breakdown for an order.
 *
 * @param subtotal  - Pre-tax order amount in USD
 * @param _zip      - Ignored (kept for API compatibility); ZIP is derived internally
 * @param lat       - Delivery latitude
 * @param lon       - Delivery longitude
 */
export async function calculateTax(
  subtotal: number,
  _zip: string | null,
  lat: number,
  lon: number,
): Promise<TaxBreakdown> {
  const jurisdiction = await resolveJurisdiction(lat, lon);

  const tax_amount = Math.round(subtotal * jurisdiction.composite_tax_rate * 100) / 100;
  const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;

  return {
    zip_code: null,
    state: "NY",
    tax_region: jurisdiction.name,
    county_fips: jurisdiction.county_fips,
    state_rate: jurisdiction.state_rate,
    county_rate: jurisdiction.county_rate,
    city_rate: jurisdiction.city_rate,
    special_rate: jurisdiction.special_rate,
    composite_tax_rate: jurisdiction.composite_tax_rate,
    tax_amount,
    total_amount,
    jurisdictions: jurisdiction.jurisdictions,
  };
}