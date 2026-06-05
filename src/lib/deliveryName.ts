// src/lib/deliveryName.ts
// Generates human-readable delivery names instead of raw Firestore IDs
// e.g. "Swift Parcel · Lagos → Lekki #4821"

const ADJECTIVES = [
  "Swift", "Rapid", "Quick", "Express", "Flash", "Brisk",
  "Speedy", "Turbo", "Nimble", "Pronto", "Direct", "Prime",
  "Ace", "Bolt", "Dash", "Jet", "Rush", "Zoom",
];

const NOUNS = [
  "Parcel", "Package", "Haul", "Run", "Drop", "Shipment",
  "Cargo", "Bundle", "Delivery", "Move", "Carry", "Transfer",
  "Route", "Load", "Send", "Dispatch",
];

/**
 * Strips to the first meaningful word from a full address string.
 * "Moloney Street, Lagos Island, Lagos State" → "Moloney"
 */
function shortPlace(address?: string): string {
  if (!address) return "";
  // Remove "Nigeria", state names, generic suffixes
  const cleaned = address
    .replace(/,?\s*(Nigeria|Lagos State|Ogun State|Abuja FCT|FCT)\s*/gi, "")
    .trim();
  // Take first token (word / street name)
  const first = cleaned.split(/[,\s]+/)[0] ?? "";
  return first.length > 2 ? first : cleaned.split(",")[0]?.trim() ?? "";
}

/**
 * Derives a short, stable numeric suffix from a Firestore document ID.
 * Uses last 4 hex chars → 0–65535 range.
 */
function idSuffix(firestoreId: string): string {
  const hex = firestoreId.replace(/[^0-9a-f]/gi, "").slice(-4);
  const num = parseInt(hex || "0", 16) % 10000;
  return num.toString().padStart(4, "0");
}

/**
 * Picks a pseudo-random adjective+noun pair deterministically from the ID.
 */
function pickWords(firestoreId: string): { adj: string; noun: string } {
  const n1 = parseInt(firestoreId.slice(0, 4).replace(/[^0-9a-f]/gi, "0"), 16);
  const n2 = parseInt(firestoreId.slice(4, 8).replace(/[^0-9a-f]/gi, "0"), 16);
  const adj  = ADJECTIVES[n1 % ADJECTIVES.length]!;
  const noun = NOUNS[n2 % NOUNS.length]!;
  return { adj, noun };
}

export interface DeliveryNameOptions {
  firestoreId: string;
  pickupAddress?:  string;
  dropoffAddress?: string;
  /** If true, include the place names in the label */
  includeRoute?: boolean;
}

/**
 * Returns a friendly display name for a delivery.
 *
 * Short form (default):   "Swift Parcel #4821"
 * With route:             "Swift Parcel · Moloney → Lekki #4821"
 */
export function generateDeliveryName({
  firestoreId,
  pickupAddress,
  dropoffAddress,
  includeRoute = true,
}: DeliveryNameOptions): string {
  const { adj, noun } = pickWords(firestoreId);
  const suffix = idSuffix(firestoreId);
  const base = `${adj} ${noun}`;

  if (includeRoute && pickupAddress && dropoffAddress) {
    const from = shortPlace(pickupAddress);
    const to   = shortPlace(dropoffAddress);
    if (from && to && from !== to) {
      return `${base} · ${from} → ${to} #${suffix}`;
    }
  }

  return `${base} #${suffix}`;
}

/**
 * Short version — just "Swift Parcel #4821" — for tight spaces.
 */
export function shortDeliveryName(firestoreId: string): string {
  const { adj, noun } = pickWords(firestoreId);
  const suffix = idSuffix(firestoreId);
  return `${adj} ${noun} #${suffix}`;
}