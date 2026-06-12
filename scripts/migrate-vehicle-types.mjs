/**
 * Firestore migration: old vehicle types → new freight vehicle types
 *
 * Old values: bike_rider | car_driver | van_driver | truck_driver
 * New values: cargo_van | box_truck | dry_van | flatbed | reefer | power_only | auto_transport
 *
 * Mapping used (best-effort — review before running in production):
 *   bike_rider  → cargo_van
 *   car_driver  → cargo_van
 *   van_driver  → cargo_van
 *   truck_driver → dry_van
 *
 * Collections affected:
 *   delivery_requests  (field: transportType)
 *   delivery_broadcasts (field: transportType)
 *   vehicles           (field: vehicleType)
 *   drivers            (field: driverType — only if it stored the old vehicle type values)
 *
 * Usage:
 *   1. Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON path, OR
 *      run `firebase login` and set FIREBASE_PROJECT_ID env var.
 *   2. node scripts/migrate-vehicle-types.mjs [--dry-run]
 *
 *   --dry-run  prints what would be changed without writing to Firestore
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");

const VEHICLE_TYPE_MAP = {
  bike_rider:   "cargo_van",
  car_driver:   "cargo_van",
  van_driver:   "cargo_van",
  truck_driver: "dry_van",
};

const OLD_VALUES = new Set(Object.keys(VEHICLE_TYPE_MAP));

function initFirebase() {
  if (getApps().length) return;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const serviceAccount = require(credPath);
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Falls back to application default credentials (gcloud auth / Firebase emulator)
    initializeApp();
  }
}

async function migrateCollection(db, collectionName, fieldName) {
  const col = db.collection(collectionName);
  const snapshot = await col.get();
  let migrated = 0;
  let skipped = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const value = docSnap.get(fieldName);
    if (!value || !OLD_VALUES.has(value)) {
      skipped++;
      continue;
    }
    const newValue = VEHICLE_TYPE_MAP[value];
    console.log(`  ${collectionName}/${docSnap.id}: ${fieldName} ${value} → ${newValue}`);
    if (!DRY_RUN) {
      batch.update(docSnap.ref, { [fieldName]: newValue });
      batchCount++;
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
    migrated++;
  }

  if (!DRY_RUN && batchCount > 0) await batch.commit();

  console.log(`  → ${migrated} migrated, ${skipped} already up-to-date`);
  return migrated;
}

async function main() {
  if (DRY_RUN) console.log("DRY RUN — no writes will be made\n");

  await initFirebase();
  const db = getFirestore();

  const jobs = [
    { collection: "delivery_requests",  field: "transportType" },
    { collection: "delivery_broadcasts", field: "transportType" },
    { collection: "vehicles",           field: "vehicleType" },
    { collection: "drivers",            field: "driverType" },
  ];

  let total = 0;
  for (const { collection, field } of jobs) {
    console.log(`\nMigrating ${collection}.${field} ...`);
    total += await migrateCollection(db, collection, field);
  }

  console.log(`\nDone. Total documents ${DRY_RUN ? "that would be" : ""} migrated: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
