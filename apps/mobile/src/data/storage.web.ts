// Browser preview only. Native builds use SQLite through storage.ts.
const key = "fitness360-demo-v1";
export async function loadState(): Promise<string | null> {
  return window.localStorage.getItem(key);
}
export async function saveState(value: string): Promise<void> {
  window.localStorage.setItem(key, value);
}
