import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";

let database: Promise<SQLiteDatabase> | undefined;
function db() {
  if (!database)
    database = (async () => {
      const connection = await openDatabaseAsync("fitness360-demo.db");
      await connection.execAsync(
        "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL); PRAGMA user_version = 1;",
      );
      return connection;
    })();
  return database;
}

export async function loadState(): Promise<string | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ value: string }>(
    "SELECT value FROM app_state WHERE id = 1",
  );
  return row?.value ?? null;
}

export async function saveState(value: string): Promise<void> {
  await (
    await db()
  ).runAsync(
    "INSERT INTO app_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
    value,
  );
}
