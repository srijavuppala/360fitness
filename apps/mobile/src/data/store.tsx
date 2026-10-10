import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Meal, parseSavedState } from "../domain/meals";
import { initialState } from "../domain/fixtures";
import { loadState, saveState } from "./storage";

type Store = {
  state: AppState;
  pendingMeal: Meal | null;
  setPendingMeal: (meal: Meal | null) => void;
  ready: boolean;
  error: string | null;
  saving: boolean;
  update: (change: (previous: AppState) => AppState) => Promise<void>;
  retry: () => void;
};
const Context = createContext<Store | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initialState);
  const [pendingMeal, setPendingMeal] = useState<Meal | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = useRef(state);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    loadState()
      .then((raw) => {
        const restored = raw ? parseSavedState(raw) : initialState();
        if (active) {
          current.current = restored;
          setState(restored);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "We couldn’t open your local data. Your saved data has not been changed.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function update(change: (previous: AppState) => AppState): Promise<void> {
    if (!ready)
      return Promise.reject(new Error("Local data is still loading."));
    const task = queue.current.then(async () => {
      setSaving(true);
      try {
        const next = change(current.current);
        await saveState(JSON.stringify(next));
        current.current = next;
        setState(next);
      } finally {
        setSaving(false);
      }
    });
    queue.current = task.catch(() => undefined);
    return task;
  }
  return (
    <Context.Provider
      value={{
        state,
        pendingMeal,
        setPendingMeal,
        ready,
        error,
        saving,
        update,
        retry: () => {
          setError(null);
          setAttempt((value) => value + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useApp() {
  const store = useContext(Context);
  if (!store) throw new Error("useApp requires AppProvider");
  return store;
}
