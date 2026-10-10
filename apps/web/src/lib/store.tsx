import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { emptyState, parseBackup, validateState, type WebState } from "./model";
import type { User } from "firebase/auth";
import type * as Cloud from "./cloud";
export const cloudConfigured = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_RECAPTCHA_ENTERPRISE_SITE_KEY",
].every((key) => !!import.meta.env[key]);
export const aiConfigured =
  cloudConfigured && import.meta.env.VITE_ENABLE_AI === "true";
const KEY = "fitness360.website.v1";
function readLocal() {
  const raw = localStorage.getItem(KEY);
  return raw ? parseBackup(raw) : emptyState();
}
function friendly(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "auth/popup-closed-by-user")
    return "Sign-in was cancelled. You can try again.";
  if (code === "permission-denied")
    return "Your session could not access this data. Sign in again.";
  if (code?.includes("network") || code === "unavailable")
    return "Connection unavailable. Please try again when you’re online.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
type Store = {
  state: WebState;
  user: User | null;
  ready: boolean;
  busy: boolean;
  error: string;
  notice: string;
  cloud: typeof Cloud | null;
  update: (
    fn: (state: WebState) => WebState,
    message?: string,
  ) => Promise<boolean>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  notify: (message: string) => void;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: PropsWithChildren) {
  const [state, setState] = useState(emptyState),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [cloud, setCloud] = useState<typeof Cloud | null>(null);
  const current = useRef(state),
    account = useRef<User | null>(null),
    locked = useRef(false),
    epoch = useRef(0);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let records = () => {};
    const apply = (next: WebState) => {
      if (active) {
        current.current = next;
        setState(next);
        setReady(true);
        setError("");
      }
    };
    function local() {
      try {
        apply(readLocal());
      } catch {
        if (active) {
          setError(
            "Your local data could not be opened. It has not been overwritten. Restore a valid backup or clear this site’s storage in your browser.",
          );
          setReady(false);
        }
      }
    }
    const sync = (event: StorageEvent) => {
      if (event.key === KEY && !account.current) local();
    };
    window.addEventListener("storage", sync);
    if (!cloudConfigured) local();
    else
      import("./cloud")
        .then((api) => {
          if (!active) return;
          setCloud(api);
          unsubscribe = api.watchAuth((next) => {
            records();
            epoch.current++;
            account.current = next;
            setUser(next);
            setReady(false);
            setError("");
            current.current = emptyState();
            setState(emptyState());
            const generation = epoch.current;
            if (next)
              records = api.watchRecords(
                next.uid,
                (value) => {
                  if (epoch.current === generation) apply(value);
                },
                (cause) => {
                  if (active && epoch.current === generation) {
                    setError(friendly(cause));
                    setReady(false);
                  }
                },
              );
            else local();
          });
        })
        .catch(() => {
          if (active)
            setError(
              "Account services could not load. Check your connection and reload.",
            );
        });
    return () => {
      active = false;
      unsubscribe();
      records();
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function update(fn: (state: WebState) => WebState, message = "Saved") {
    if (locked.current || !ready) return false;
    locked.current = true;
    setBusy(true);
    const scope = epoch.current;
    const owner = account.current;
    try {
      const before = current.current;
      const next = validateState(fn(structuredClone(before)));
      if (owner) {
        if (!cloud) throw new Error("Sign-in is still loading.");
        await cloud.saveChanges(owner.uid, before, next);
      } else localStorage.setItem(KEY, JSON.stringify(next));
      if (epoch.current === scope) {
        // Connected state comes from the snapshot, which may also contain
        // another device's changes received while this write was pending.
        if (!owner) {
          current.current = next;
          setState(next);
        }
        setNotice(message);
      }
      return true;
    } catch (cause) {
      setNotice(friendly(cause));
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function signIn() {
    if (!cloud) {
      setNotice(
        "Cloud accounts are not configured for this preview. Your local workspace is available.",
      );
      return;
    }
    try {
      await cloud.login();
    } catch (cause) {
      setNotice(friendly(cause));
    }
  }
  async function signOut() {
    if (busy) return;
    try {
      await cloud?.logout();
    } catch (cause) {
      setNotice(friendly(cause));
    }
  }
  return (
    <Context.Provider
      value={{
        state,
        user,
        ready,
        busy,
        error,
        notice,
        cloud,
        update,
        signIn,
        signOut,
        notify: setNotice,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app provider");
  return value;
}
