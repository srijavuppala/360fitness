import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  Button,
  Card,
  Copy,
  Field,
  Header,
  Notice,
  Screen,
  Section,
} from "../components/ui";
import { useApp } from "../data/store";
import { CloudProfile } from "../domain/cloud-profile";
import { answerLabel, PersonalProfile, saveProfile } from "../domain/profile";
import { cloudConfigured, firebaseClient } from "../services/cloud/firebase";
import { profileRepository } from "../services/cloud/profile-repository";
import { accountError } from "../services/cloud/errors";

type Review = {
  action: "save" | "restore" | "delete";
  revision: number;
  generation: string | null;
  profile: PersonalProfile;
};
type Remote = { uid: string; value: CloudProfile | null; fromCache: boolean };

export default function Account() {
  const { state, ready, update } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [attempt, setAttempt] = useState(0);
  const working = useRef(false);
  const sessionUid = useRef<string | undefined>(undefined);
  const account = user && !user.isAnonymous ? user : null;
  const uid = account?.uid;
  const connected =
    !!remote && remote.uid === uid && !remote.fromCache && verified;
  const cloud = remote?.uid === uid ? remote?.value : null;

  useEffect(() => {
    if (!cloudConfigured) return;
    let active = true;
    let unsubscribe = () => {};
    Promise.resolve()
      .then(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(
          firebaseClient().auth,
          (next) => {
            if (!active) return;
            setUser(next);
            setVerified(next?.emailVerified ?? false);
            setAuthReady(true);
            if (sessionUid.current !== next?.uid) {
              sessionUid.current = next?.uid;
              setRemote(null);
              setReview(null);
            }
          },
          () => {
            if (active) {
              setError(
                "Couldn’t open your account session. Try connecting again.",
              );
              setAuthReady(true);
            }
          },
        );
      })
      .catch((cause) => {
        if (active) {
          setError(accountError(cause));
          setAuthReady(true);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);
  useEffect(() => {
    if (!uid || !verified) return;
    let active = true;
    return (() => {
      const unsubscribe = profileRepository(firebaseClient().db, uid).watch(
        (value, fromCache) => {
          if (active) setRemote({ uid, value, fromCache });
        },
        (cause) => {
          if (active) {
            setRemote(null);
            setError(accountError(cause));
          }
        },
      );
      return () => {
        active = false;
        unsubscribe();
      };
    })();
  }, [uid, verified, attempt]);

  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function authenticate() {
    const auth = firebaseClient().auth;
    const result = create
      ? auth.currentUser?.isAnonymous
        ? await linkWithCredential(
            auth.currentUser,
            EmailAuthProvider.credential(email.trim(), password),
          )
        : await createUserWithEmailAndPassword(auth, email.trim(), password)
      : await signInWithEmailAndPassword(auth, email.trim(), password);
    setPassword("");
    if (!result.user.emailVerified) {
      await sendEmailVerification(result.user);
      setMessage(
        "Check your email to verify your account, then tap I’ve verified my email.",
      );
    }
  }
  async function confirm() {
    if (!review || !account || !verified || !connected)
      throw new Error("Account unavailable.");
    const auth = firebaseClient().auth;
    if (auth.currentUser?.uid !== account.uid)
      throw new Error("Account changed.");
    const repository = profileRepository(firebaseClient().db, account.uid);
    if (review.action === "save") {
      await repository.save(review.profile, review.revision, review.generation);
      setMessage(
        "Your onboarding profile is saved to your account. Meal prep has a separate backup in My Plan. Meal history and unfinished answers stay on this device.",
      );
    } else if (review.action === "restore") {
      if (
        cloud?.revision !== review.revision ||
        cloud?.generation !== review.generation
      )
        throw new Error(
          "Your cloud profile changed. Review the latest version before restoring.",
        );
      await update((previous) => ({
        ...saveProfile(previous, review.profile.answers),
        profile: review.profile,
      }));
      setMessage(
        "Cloud profile saved on this device. Your meals are unchanged; unfinished profile answers were replaced.",
      );
    } else {
      await repository.remove(review.revision, review.generation!);
      setMessage("Cloud profile deleted. Your account and local data remain.");
    }
    setReview(null);
  }

  return (
    <Screen>
      <Header
        back
        eyebrow="Your account"
        title="Keep your profile with you."
        subtitle="Save your completed onboarding answers and restore them on another phone."
      />
      {!cloudConfigured ? (
        <>
          <Notice>
            Cloud accounts aren’t connected in this build yet. Your profile is
            saved on this device.
          </Notice>
          <Copy muted>
            Firebase project configuration is needed to turn on sign-in and
            cloud profile storage.
          </Copy>
        </>
      ) : !authReady ? (
        <Notice>Opening your account…</Notice>
      ) : !account ? (
        <Card>
          <Section title={create ? "Create an account" : "Sign in"} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!busy}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={create ? "new-password" : "current-password"}
            editable={!busy}
          />
          <Copy muted>
            Signing in does not upload or replace your local data. You choose
            when to save or restore a profile.
          </Copy>
          <Button busy={busy} onPress={() => void run(authenticate)}>
            {create ? "Create account" : "Sign in"}
          </Button>
          <Button
            secondary
            disabled={busy}
            onPress={() => {
              setCreate(!create);
              setPassword("");
              setError("");
            }}
          >
            {create ? "I already have an account" : "Create an account instead"}
          </Button>
          <Button
            secondary
            disabled={busy || !email.trim()}
            onPress={() =>
              void run(async () => {
                await sendPasswordResetEmail(
                  firebaseClient().auth,
                  email.trim(),
                );
                setMessage(
                  "If an account exists for this email, you’ll receive password reset instructions.",
                );
              })
            }
          >
            Reset password
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <Copy>{account.email}</Copy>
            <Copy muted>
              {verified
                ? "Email verified"
                : "Verify your email before storing your profile"}
            </Copy>
            {!verified ? (
              <>
                <Button
                  busy={busy}
                  onPress={() =>
                    void run(async () => {
                      await reload(account);
                      await account.getIdToken(true);
                      setVerified(account.emailVerified);
                      setMessage(
                        account.emailVerified
                          ? "Email verified. Connecting to your profile…"
                          : "Your email is not verified yet. Open the verification link in your inbox.",
                      );
                    })
                  }
                >
                  I’ve verified my email
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await sendEmailVerification(account);
                      setMessage("Verification email sent.");
                    })
                  }
                >
                  Resend verification email
                </Button>
              </>
            ) : (
              <Copy muted>
                {connected
                  ? "Connected · Cloud changes appear here in real time"
                  : "Waiting for a live connection · Cloud actions are unavailable"}
              </Copy>
            )}
          </Card>
          <Section title="On this device" />
          <Card>
            {state.profile ? (
              <ProfileSummary profile={state.profile} />
            ) : (
              <Copy muted>Complete onboarding to create your profile.</Copy>
            )}
            <Button
              secondary
              disabled={busy || !ready}
              onPress={() => router.push("/preferences")}
            >
              Edit my onboarding answers
            </Button>
            <Button
              disabled={busy || !state.profile || !connected}
              onPress={() => {
                if (state.profile)
                  setReview({
                    action: "save",
                    revision: cloud?.revision ?? 0,
                    generation: cloud?.generation ?? null,
                    profile: state.profile,
                  });
              }}
            >
              Review cloud save
            </Button>
          </Card>
          <Section title="In your account" />
          <Card>
            {cloud ? (
              <>
                <ProfileSummary profile={cloud.profile} />
                <Copy muted>
                  Version {cloud.revision} · Saved{" "}
                  {new Date(cloud.profile.updatedAt).toLocaleString()}
                </Copy>
                <Button
                  secondary
                  disabled={busy || !connected || !ready}
                  onPress={() =>
                    setReview({
                      action: "restore",
                      revision: cloud.revision,
                      generation: cloud.generation,
                      profile: cloud.profile,
                    })
                  }
                >
                  Review restore to this device
                </Button>
                <Button
                  secondary
                  disabled={busy || !connected}
                  onPress={() =>
                    setReview({
                      action: "delete",
                      revision: cloud.revision,
                      generation: cloud.generation,
                      profile: cloud.profile,
                    })
                  }
                >
                  Delete cloud profile
                </Button>
              </>
            ) : (
              <Copy muted>
                {connected
                  ? "No profile saved to this account yet."
                  : "Your cloud profile will appear after connecting."}
              </Copy>
            )}
          </Card>
          {review ? (
            <Card>
              <Section
                title={
                  review.action === "save"
                    ? "Save these answers to your account?"
                    : review.action === "restore"
                      ? "Replace this device’s profile?"
                      : "Delete the profile in your account?"
                }
              />
              <ProfileSummary profile={review.profile} />
              <Copy muted>
                {review.action === "save"
                  ? "All completed onboarding answers, including body metrics and allergies you supplied, will be stored in your Firebase account profile. This replaces the previous cloud profile. Future edits need another cloud save."
                  : review.action === "restore"
                    ? "This replaces your local profile and unfinished onboarding answers. Your meals stay as they are."
                    : "This removes the cloud copy only. Other devices may still have local copies."}
              </Copy>
              <Button busy={busy} onPress={() => void run(confirm)}>
                Confirm{" "}
                {review.action === "save"
                  ? "cloud save"
                  : review.action === "restore"
                    ? "restore"
                    : "deletion"}
              </Button>
              <Button secondary disabled={busy} onPress={() => setReview(null)}>
                Cancel
              </Button>
            </Card>
          ) : null}
          <Button
            secondary
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await signOut(firebaseClient().auth);
                setRemote(null);
                setReview(null);
                setMessage(
                  "Signed out. Local meals and profile remain on this device.",
                );
              })
            }
          >
            Sign out
          </Button>
          <Copy muted>
            Only completed profiles are stored in your account. Meal history,
            drafts and photos are not synced. Signing out keeps this device’s
            local data.
          </Copy>
        </>
      )}
      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      {cloudConfigured ? (
        <Button
          secondary
          disabled={busy}
          onPress={() => {
            setRemote(null);
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Reconnect
        </Button>
      ) : null}
    </Screen>
  );
}
function ProfileSummary({ profile }: { profile: PersonalProfile }) {
  return (
    <>
      <Copy>{answerLabel(profile.answers, "primaryGoal")}</Copy>
      <Copy muted>{answerLabel(profile.answers, "outcome")}</Copy>
      <Copy muted>
        {answerLabel(profile.answers, "currentWeightKg")} now · target{" "}
        {answerLabel(profile.answers, "targetWeightKg")}
      </Copy>
    </>
  );
}
