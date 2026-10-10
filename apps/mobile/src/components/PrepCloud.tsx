import { useEffect, useRef, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { router } from "expo-router";
import { Button, Copy, Notice } from "./ui";
import { useApp } from "../data/store";
import { emptyPrep } from "../domain/meal-prep";
import { cloudConfigured, firebaseClient } from "../services/cloud/firebase";
import { CloudPrep, prepRepository } from "../services/cloud/prep-repository";

type Remote = { uid: string; cloud: CloudPrep | null; cached: boolean };
export function PrepCloud() {
  const { state, update } = useApp();
  const [remote, setRemote] = useState<Remote | null>(null);
  const [status, setStatus] = useState(
    cloudConfigured
      ? "Connecting to your account…"
      : "Firebase hasn’t been connected to this build yet.",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<Remote | null>(null);
  const current = useRef<Remote | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let stopPlan = () => {};
    let activeSession = "";
    let epoch = 0;
    if (!cloudConfigured)
      return () => {
        mounted.current = false;
      };
    const stopAuth = onIdTokenChanged(firebaseClient().auth, (user) => {
      const session = `${user?.uid}:${user?.emailVerified}:${user?.isAnonymous}`;
      if (activeSession === session) return;
      activeSession = session;
      const token = ++epoch;
      stopPlan();
      current.current = null;
      setRemote(null);
      setConfirmRestore(null);
      if (!user || user.isAnonymous || !user.emailVerified) {
        setStatus("Sign in and verify your email to back up meal prep.");
        return;
      }
      setStatus("Connecting to your cloud plan…");
      stopPlan = prepRepository(firebaseClient().db, user.uid).watch(
        (cloud, cached) => {
          if (!mounted.current || token !== epoch) return;
          const next = { uid: user.uid, cloud, cached };
          current.current = next;
          setRemote(next);
          setStatus(
            cached
              ? "Offline · showing the last cloud copy"
              : cloud
                ? `Live cloud version ${cloud.revision} · ${cloud.plan.batches.length} batches`
                : "Connected · no cloud plan yet",
          );
        },
        () => {
          if (mounted.current && token === epoch) {
            current.current = null;
            setRemote(null);
            setStatus(
              "Couldn’t connect to the cloud plan. Reopen this panel to retry.",
            );
          }
        },
      );
    });
    return () => {
      mounted.current = false;
      epoch++;
      stopPlan();
      stopAuth();
    };
  }, []);
  async function run(restore: boolean) {
    const snapshot = restore ? confirmRestore : remote;
    if (working.current || !snapshot || snapshot.cached) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const assertCurrent = () => {
        if (
          firebaseClient().auth.currentUser?.uid !== snapshot.uid ||
          !firebaseClient().auth.currentUser?.emailVerified ||
          current.current?.uid !== snapshot.uid ||
          current.current?.cloud?.revision !== snapshot.cloud?.revision ||
          current.current?.cloud?.generation !== snapshot.cloud?.generation
        )
          throw new Error(
            "Your account or cloud plan changed. Review the latest version and try again.",
          );
      };
      assertCurrent();
      if (restore && snapshot.cloud) {
        await update((previous) => {
          assertCurrent();
          return { ...previous, mealPrep: snapshot.cloud!.plan };
        });
        if (mounted.current)
          setStatus("Cloud meal prep restored to this device.");
      } else {
        await prepRepository(firebaseClient().db, snapshot.uid).save(
          state.mealPrep ?? emptyPrep(),
          snapshot.cloud?.revision ?? 0,
          snapshot.cloud?.generation ?? null,
        );
        if (mounted.current)
          setStatus("Your meal prep plan is saved to Firebase.");
      }
      if (mounted.current) setConfirmRestore(null);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Cloud action failed. Your local plan is unchanged.",
        );
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Copy>{status}</Copy>
      <Copy muted style={{ fontSize: 13 }}>
        Your local plan stays available offline. Cloud changes appear here in
        real time; saving or restoring is your choice. Only meal prep is
        included.
      </Copy>
      {remote && !remote.cached ? (
        <>
          <Copy muted style={{ fontSize: 13 }}>
            Save uploads this device’s {state.mealPrep?.batches.length ?? 0}{" "}
            batches and grocery checklist, replacing the current cloud copy.
          </Copy>
          <Button busy={busy} onPress={() => void run(false)}>
            Save this plan to Firebase
          </Button>
          {remote.cloud ? (
            <Button
              secondary
              disabled={busy}
              onPress={() => setConfirmRestore(remote)}
            >
              Restore cloud plan
            </Button>
          ) : null}
          {confirmRestore ? (
            <>
              <Notice>
                Restore replaces this device’s meal prep with cloud version{" "}
                {confirmRestore.cloud?.revision}. Meal history and your profile
                stay unchanged.
              </Notice>
              <Button busy={busy} onPress={() => void run(true)}>
                Confirm restore
              </Button>
              <Button secondary onPress={() => setConfirmRestore(null)}>
                Keep local plan
              </Button>
            </>
          ) : null}
        </>
      ) : (
        <Button secondary onPress={() => router.push("/account")}>
          Open account settings
        </Button>
      )}
      {error ? <Notice error>{error}</Notice> : null}
    </>
  );
}
