import {
  collection,
  doc,
  Firestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { MealPrep, validatePrep } from "../../domain/meal-prep";
export type CloudPrep = {
  revision: number;
  generation: string;
  plan: MealPrep;
};
export function parseCloudPrep(raw: unknown): CloudPrep {
  if (!raw || typeof raw !== "object")
    throw new Error("Invalid cloud prep plan.");
  const data = raw as {
    schemaVersion: number;
    revision: number;
    generation: string;
    payload: string;
  };
  if (
    data.schemaVersion !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    typeof data.generation !== "string" ||
    !/^[A-Za-z0-9]{20}$/.test(data.generation) ||
    typeof data.payload !== "string" ||
    data.payload.length > 180000
  )
    throw new Error("This cloud plan could not be opened.");
  const plan = JSON.parse(data.payload) as MealPrep;
  validatePrep(plan);
  return { revision: data.revision, generation: data.generation, plan };
}
export function prepRepository(db: Firestore, uid: string) {
  if (!uid || uid.includes("/"))
    throw new Error("Sign in to access your plan.");
  const reference = doc(db, "mobileMealPrep", uid);
  return {
    watch(
      next: (value: CloudPrep | null, cached: boolean) => void,
      error: (cause: Error) => void,
    ) {
      return onSnapshot(
        reference,
        { includeMetadataChanges: true },
        (snapshot) => {
          try {
            next(
              snapshot.exists() ? parseCloudPrep(snapshot.data()) : null,
              snapshot.metadata.fromCache,
            );
          } catch {
            error(
              new Error(
                "The cloud plan could not be opened. Your local plan is unchanged.",
              ),
            );
          }
        },
        error,
      );
    },
    async save(plan: MealPrep, revision: number, generation: string | null) {
      validatePrep(plan);
      const payload = JSON.stringify(plan);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.exists()
          ? parseCloudPrep(snapshot.data())
          : null;
        if (
          (current?.revision ?? 0) !== revision ||
          (current?.generation ?? null) !== generation
        )
          throw new Error(
            "This plan changed on another device. Review the latest cloud version before saving again.",
          );
        transaction.set(reference, {
          schemaVersion: 1,
          revision: revision + 1,
          generation:
            current?.generation ?? doc(collection(db, "mobileMealPrep")).id,
          payload,
          updatedAt: serverTimestamp(),
        });
      });
    },
  };
}
