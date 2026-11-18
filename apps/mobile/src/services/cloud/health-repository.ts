import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { CloudHealth, parseCloudHealth } from "../../domain/cloud-health";
import { HealthProfile, validateHealthProfile } from "../../domain/health";

/**
 * Optional backup of the on-device health section. It is only called after an
 * explicit, separate user action. A single transaction keeps revision and
 * generation consistent when two devices save at once; the last confirmed save
 * wins, which is acceptable for a small self-owned document.
 */
export function healthRepository(db: Firestore, uid: string) {
  if (!uid || uid.includes("/"))
    throw new Error("A valid account is required.");
  const reference = doc(db, "mobileHealthProfiles", uid);
  return {
    async get(): Promise<CloudHealth | null> {
      const snapshot = await getDoc(reference);
      return snapshot.exists() ? parseCloudHealth(snapshot.data()) : null;
    },
    async save(health: HealthProfile): Promise<void> {
      validateHealthProfile(health);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.exists()
          ? parseCloudHealth(snapshot.data())
          : null;
        transaction.set(reference, {
          schemaVersion: 1,
          revision: (current?.revision ?? 0) + 1,
          generation:
            current?.generation ??
            doc(collection(db, "mobileHealthProfiles")).id,
          backupConsent: true,
          health,
          updatedAt: serverTimestamp(),
        });
      });
    },
    async remove(): Promise<void> {
      await deleteDoc(reference);
    },
  };
}
