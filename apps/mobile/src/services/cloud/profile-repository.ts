import {
  doc,
  collection,
  Firestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  assertRevision,
  assertGeneration,
  CloudProfile,
  parseCloudProfile,
} from "../../domain/cloud-profile";
import { PersonalProfile, validateProfile } from "../../domain/profile";

export function profileRepository(db: Firestore, uid: string) {
  if (!uid || uid.includes("/"))
    throw new Error("A valid account is required.");
  const reference = doc(db, "mobileProfiles", uid);
  return {
    watch(
      next: (value: CloudProfile | null, fromCache: boolean) => void,
      error: (error: Error) => void,
    ) {
      return onSnapshot(
        reference,
        { includeMetadataChanges: true },
        (snapshot) => {
          try {
            next(
              snapshot.exists() ? parseCloudProfile(snapshot.data()) : null,
              snapshot.metadata.fromCache,
            );
          } catch (cause) {
            error(
              cause instanceof Error
                ? cause
                : new Error("Could not read cloud profile."),
            );
          }
        },
        error,
      );
    },
    async save(
      profile: PersonalProfile,
      expectedRevision: number,
      expectedGeneration: string | null = null,
    ) {
      validateProfile(profile);
      // Transactions fail offline; the locally saved profile remains available for an explicit retry.
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.exists()
          ? parseCloudProfile(snapshot.data())
          : null;
        assertRevision(current?.revision ?? 0, expectedRevision);
        assertGeneration(current?.generation ?? null, expectedGeneration);
        transaction.set(reference, {
          schemaVersion: 1,
          revision: (current?.revision ?? 0) + 1,
          generation:
            current?.generation ?? doc(collection(db, "mobileProfiles")).id,
          profile,
          updatedAt: serverTimestamp(),
        });
      });
    },
    async remove(expectedRevision: number, expectedGeneration: string) {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.exists()
          ? parseCloudProfile(snapshot.data())
          : null;
        assertRevision(current?.revision ?? 0, expectedRevision);
        assertGeneration(current?.generation ?? null, expectedGeneration);
        transaction.delete(reference);
      });
    },
  };
}
