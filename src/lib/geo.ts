/**
 * Geo helpers — pure functions, no state, no I/O.
 *
 * Used for displaying distance and walking-time estimates between stations
 * on the mission page. Inputs are decimal lat/lng pairs in degrees.
 */

interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Great-circle distance between two lat/lng points in metres (Haversine).
 * Earth radius approximated as 6 371 000 m — accurate to < 0.5 % for short legs.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Walking-time estimate for a class of school students.
 * 80 m/min ≈ 4.8 km/h — comfortable group pace in an unfamiliar city.
 * Always returns at least 1 (so very short legs don't read "0 min").
 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

/**
 * Human-friendly distance string for German UI.
 *   < 1000 m → "350 m" (rounded to nearest 10 m)
 *   ≥ 1000 m → "1,2 km" (German decimal comma, 1 fractional digit)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = (meters / 1000).toFixed(1).replace(".", ",");
  return `${km} km`;
}

// ---------------------------------------------------------------------------
// SVG projection helpers — used by the Mission Control Operations Map.
// ---------------------------------------------------------------------------

/** Latitude/longitude rectangle used as the projection domain. */
export interface LatLngBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Maps a (lat, lng) coordinate into SVG pixel space.
 *
 * The Y-axis is inverted because SVG-Y grows downward while latitude grows
 * northward. The `padding` parameter reserves a margin inside the SVG so
 * markers at the extremes of the bounding box aren't clipped against the edge.
 *
 * No Mercator projection correction: at the scale of inner-city Strasbourg
 * (roughly 1.1 km × 0.65 km at 48.6°N) linear normalisation is accurate to
 * within a couple of metres — well below marker size.
 */
export function latLngToSvg(
  lat: number,
  lng: number,
  bounds: LatLngBounds,
  svgWidth: number,
  svgHeight: number,
  padding: number,
): { x: number; y: number } {
  const usableW = svgWidth  - 2 * padding;
  const usableH = svgHeight - 2 * padding;

  const x =
    ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * usableW +
    padding;

  // Invert: maxLat sits at the top of the SVG, minLat at the bottom.
  const y =
    (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * usableH +
    padding;

  return { x, y };
}

/**
 * Deterministic jitter offset for a team-marker that shares its station with
 * other teams. `position` is the team's 0-based index inside the cluster.
 *
 *   total = 1 → no offset (marker sits on the station centre)
 *   total = 2 → split left / right
 *   total = 3 → upward triangle
 *   total ≥ 4 → even circle distribution starting at 12 o'clock
 *
 * Pure function — same inputs always return the same offset, so placement
 * stays stable across re-renders and polling cycles.
 */
export function clusterOffset(
  position: number,
  total: number,
): { dx: number; dy: number } {
  if (total <= 1) return { dx: 0, dy: 0 };

  if (total === 2) {
    return position === 0 ? { dx: -22, dy: 0 } : { dx: 22, dy: 0 };
  }

  if (total === 3) {
    const positions = [
      { dx:   0, dy: -24 },
      { dx: -22, dy:  12 },
      { dx:  22, dy:  12 },
    ];
    return positions[position] ?? { dx: 0, dy: 0 };
  }

  // 4+ teams → spread evenly on a circle, starting at 12 o'clock.
  const radius = 28;
  const angle  = (2 * Math.PI * position) / total - Math.PI / 2;
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
  };
}
