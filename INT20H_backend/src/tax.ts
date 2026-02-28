// Tax calculation logic: coords → jurisdiction → composite sales tax rate
// Based on official NY State Dept of Taxation and Finance rates (2024)

// New York State bounding box (expanded to include coastal/offshore areas)
const NY_BOUNDS = {
  minLat: 40.17,
  maxLat: 45.016,
  minLon: -79.763,
  maxLon: -71.48,
};

// Validate that coordinates are within NY State
export function isInNewYork(lat: number, lon: number): boolean {
  return lat >= NY_BOUNDS.minLat && lat <= NY_BOUNDS.maxLat &&
    lon >= NY_BOUNDS.minLon && lon <= NY_BOUNDS.maxLon;
}

export interface TaxBreakdown {
  zip_code: string | null;
  state: string;
  tax_region: string;
  state_rate: number;
  county_rate: number;
  city_rate: number;
  special_rate: number;
  composite_tax_rate: number;
  tax_amount: number;
  total_amount: number;
}

interface Jurisdiction {
  name: string;
  state_rate: number;
  county_rate: number;
  city_rate: number;
  special_rate: number;
  composite_tax_rate: number;
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
}

// Jurisdiction bounding boxes with their tax rates
// composite = state + county + city + special
const JURISDICTIONS: Jurisdiction[] = [
  { name: "New York City (Manhattan)", state_rate: 0.04, county_rate: 0.04500, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08875, minLat: 40.700, maxLat: 40.882, minLon: -74.020, maxLon: -73.907 },
  { name: "New York City (Brooklyn)", state_rate: 0.04, county_rate: 0.04500, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08875, minLat: 40.551, maxLat: 40.740, minLon: -74.042, maxLon: -73.833 },
  { name: "New York City (Queens)", state_rate: 0.04, county_rate: 0.04500, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08875, minLat: 40.541, maxLat: 40.800, minLon: -73.962, maxLon: -73.700 },
  { name: "New York City (Bronx)", state_rate: 0.04, county_rate: 0.04500, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08875, minLat: 40.785, maxLat: 40.916, minLon: -73.933, maxLon: -73.765 },
  { name: "New York City (Staten Island)", state_rate: 0.04, county_rate: 0.04500, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08875, minLat: 40.477, maxLat: 40.651, minLon: -74.259, maxLon: -74.034 },
  { name: "Nassau County", state_rate: 0.04, county_rate: 0.04250, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08625, minLat: 40.540, maxLat: 40.760, minLon: -73.760, maxLon: -73.430 },
  { name: "Suffolk County", state_rate: 0.04, county_rate: 0.04250, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08625, minLat: 40.600, maxLat: 41.100, minLon: -73.430, maxLon: -71.800 },
  { name: "Westchester County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08375, minLat: 40.882, maxLat: 41.367, minLon: -74.020, maxLon: -73.483 },
  { name: "Rockland County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00375, special_rate: 0.00, composite_tax_rate: 0.08375, minLat: 41.000, maxLat: 41.300, minLon: -74.230, maxLon: -73.893 },
  { name: "Orange County", state_rate: 0.04, county_rate: 0.03750, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.07750, minLat: 41.200, maxLat: 41.700, minLon: -74.760, maxLon: -74.000 },
  { name: "Dutchess County", state_rate: 0.04, county_rate: 0.03750, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.07750, minLat: 41.480, maxLat: 42.050, minLon: -73.940, maxLon: -73.480 },
  { name: "Ulster County", state_rate: 0.04, county_rate: 0.03750, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.07750, minLat: 41.600, maxLat: 42.230, minLon: -74.790, maxLon: -73.940 },
  { name: "Albany County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.350, maxLat: 42.830, minLon: -74.270, maxLon: -73.680 },
  { name: "Schenectady County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.680, maxLat: 43.000, minLon: -74.370, maxLon: -73.830 },
  { name: "Saratoga County", state_rate: 0.04, county_rate: 0.03000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.07000, minLat: 42.850, maxLat: 43.550, minLon: -74.160, maxLon: -73.480 },
  { name: "Erie County", state_rate: 0.04, county_rate: 0.04750, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08750, minLat: 42.440, maxLat: 43.090, minLon: -79.760, maxLon: -78.460 },
  { name: "Monroe County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 43.050, maxLat: 43.370, minLon: -77.990, maxLon: -77.370 },
  { name: "Onondaga County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.770, maxLat: 43.270, minLon: -76.470, maxLon: -75.890 },
  { name: "Niagara County", state_rate: 0.04, county_rate: 0.04750, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08750, minLat: 43.090, maxLat: 43.380, minLon: -79.100, maxLon: -78.460 },
  { name: "Broome County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.000, maxLat: 42.500, minLon: -76.130, maxLon: -75.300 },
  { name: "Chemung County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.000, maxLat: 42.300, minLon: -77.000, maxLon: -76.530 },
  { name: "Chautauqua County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.000, maxLat: 42.570, minLon: -79.760, maxLon: -79.050 },
  { name: "Cattaraugus County", state_rate: 0.04, county_rate: 0.05000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.09000, minLat: 42.000, maxLat: 42.530, minLon: -79.050, maxLon: -78.300 },
  { name: "Allegany County", state_rate: 0.04, county_rate: 0.04500, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08500, minLat: 42.000, maxLat: 42.530, minLon: -78.300, maxLon: -77.720 },
  { name: "Steuben County", state_rate: 0.04, county_rate: 0.04000, city_rate: 0.00, special_rate: 0.00, composite_tax_rate: 0.08000, minLat: 42.000, maxLat: 42.660, minLon: -77.720, maxLon: -77.000 },
];

// Fallback for coordinates that don't match any specific jurisdiction
const DEFAULT_JURISDICTION = {
  name: "New York State",
  state_rate: 0.04, county_rate: 0.04, city_rate: 0.00, special_rate: 0.00,
  composite_tax_rate: 0.08,
};

// Find jurisdiction by checking if coords fall within each bounding box
function getJurisdiction(lat: number, lon: number) {
  for (const j of JURISDICTIONS) {
    if (lat >= j.minLat && lat <= j.maxLat && lon >= j.minLon && lon <= j.maxLon) {
      return j;
    }
  }
  return DEFAULT_JURISDICTION;
}

// Kept for API compatibility, ZIP lookup replaced by coordinate-based approach
export async function coordsToZip(_lat: number, _lon: number): Promise<string | null> {
  return null;
}

// Main tax calculation: given subtotal and coords, return full tax breakdown
export function calculateTax(subtotal: number, _zip: string | null, lat?: number, lon?: number): TaxBreakdown {
  const j = (lat !== undefined && lon !== undefined)
    ? getJurisdiction(lat, lon)
    : DEFAULT_JURISDICTION;

  const tax_amount = Math.round(subtotal * j.composite_tax_rate * 100) / 100;
  return {
    zip_code: null,
    state: "NY",
    tax_region: j.name,
    state_rate: j.state_rate,
    county_rate: j.county_rate,
    city_rate: j.city_rate,
    special_rate: j.special_rate,
    composite_tax_rate: j.composite_tax_rate,
    tax_amount,
    total_amount: Math.round((subtotal + tax_amount) * 100) / 100,
  };
}