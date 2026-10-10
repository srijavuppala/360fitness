import { useState, type FormEvent } from "react";
import {
  Download,
  Upload,
  Cloud,
  ShieldCheck,
  Check,
  Trash2,
} from "lucide-react";
import { useStore, cloudConfigured } from "../lib/store";
import {
  parseBackup,
  validateState,
  calorieTrackerNotice,
  type Profile,
  type WebState,
} from "../lib/model";
import { PageHeading, Notice, Dialog } from "../components/ui";
export default function Settings() {
  const { state, user, update, busy, signIn, signOut, notify, cloud } =
    useStore();
  const [profile, setProfile] = useState(state.profile),
    [error, setError] = useState(""),
    [backup, setBackup] = useState<WebState | null>(null),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState(""),
    [deletingBusy, setDeletingBusy] = useState(false);
  const [credits, setCredits] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      validateState({ ...state, profile });
      setError("");
      await update((prev) => ({ ...prev, profile }), "Preferences saved");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `360-fitness-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose a backup smaller than 5 MB.");
      setBackup(parseBackup(await file.text()));
    } catch (cause) {
      notify((cause as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR ROUTINE. YOUR RULES."
        title="Make it your own."
        subtitle="Your goals, your preferences, your data."
      />
      <div className="settings-grid">
        <form className="panel settings-form" onSubmit={save}>
          <h2>About you</h2>
          <label>
            What should we call you?
            <input
              value={profile.name}
              maxLength={60}
              placeholder="Your first name"
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </label>
          <label>
            My focus
            <select
              value={profile.goal}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  goal: e.target.value as Profile["goal"],
                })
              }
            >
              <option value="habits">Build consistent habits</option>
              <option value="nutrition">Understand my nutrition</option>
              <option value="fitness">Support my fitness</option>
            </select>
          </label>
          <div className="settings-divider" />
          <h2>Personal targets</h2>
          <p className="muted">
            Optional targets you choose. Leave nutrition targets blank to track
            without a daily goal.
          </p>
          <div className="form-grid">
            {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
              <label key={key}>
                {key === "kcal"
                  ? "Calories (kcal)"
                  : `${key[0].toUpperCase() + key.slice(1)} (g)`}
                <input
                  type="number"
                  step="any"
                  min="1"
                  max="10000"
                  placeholder="No target"
                  value={profile[key] ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      [key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Water target (ml)
            <input
              type="number"
              min="250"
              max="10000"
              step="50"
              value={profile.water}
              onChange={(e) =>
                setProfile({ ...profile, water: Number(e.target.value) })
              }
            />
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="button" disabled={busy}>
            <Check size={17} />
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </form>
        <div className="settings-side">
          <section className="panel">
            <span className="card-icon">
              <Cloud size={22} />
            </span>
            <h2>{user ? "Connected account" : "Your local workspace"}</h2>
            <p className="muted">
              {user
                ? `Signed in as ${user.email}. Changes are saved to your account.`
                : "Your meals stay in this browser. Export a backup to keep a copy."}
            </p>
            {user ? (
              <button
                className="button secondary"
                disabled={busy}
                onClick={signOut}
              >
                Sign out
              </button>
            ) : cloudConfigured ? (
              <>
                <button className="button secondary" onClick={signIn}>
                  Connect with Google
                </button>
                <p className="small-copy muted">
                  Your account opens its own workspace. Local data is not
                  uploaded automatically.
                </p>
              </>
            ) : (
              <Notice>Cloud sign-in is not enabled on this preview.</Notice>
            )}
          </section>
          <section className="panel">
            <span className="card-icon">
              <ShieldCheck size={22} />
            </span>
            <h2>Your data belongs to you.</h2>
            <p className="muted">
              Download a backup of your meal plans, diary, water logs and
              preferences.
            </p>
            <button className="button secondary full" onClick={download}>
              <Download size={16} />
              Export my data
            </button>
            <label className="button secondary full upload-label">
              <Upload size={16} />
              Restore a backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="small-copy muted">
              Restoring replaces your current workspace after confirmation.
            </p>
          </section>
          {user && (
            <section className="panel">
              <h2>Delete account</h2>
              <p className="muted">
                Permanently remove your account and all its saved data. You’ll
                verify your identity first.
              </p>
              <button
                className="text-button danger"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={15} />
                Delete my account
              </button>
            </section>
          )}
          <button className="text-button" onClick={() => setCredits(true)}>
            Open-source credits
          </button>
        </div>
      </div>
      {backup && (
        <Dialog title="Restore this backup?" onClose={() => setBackup(null)}>
          <p>
            This will replace your current data with {backup.entries.length}{" "}
            logged meals, {backup.templates.length} usual meals and{" "}
            {backup.water.length} water entries.
          </p>
          <Notice>
            Export your current workspace first if you want to keep it. This
            replacement cannot be undone automatically.
          </Notice>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setBackup(null)}
            >
              Cancel
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                if (await update(() => backup, "Backup restored")) {
                  setProfile(backup.profile);
                  setBackup(null);
                }
              }}
            >
              Replace and restore
            </button>
          </div>
        </Dialog>
      )}
      {credits && (
        <Dialog
          title="Built with open source."
          onClose={() => setCredits(false)}
        >
          <pre className="license-text">{calorieTrackerNotice}</pre>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Delete your account?"
          onClose={() => {
            if (!deletingBusy) setDeleting(false);
          }}
        >
          <Notice error>
            This permanently deletes your account and all data stored under it,
            including linked mobile data. Export a backup first.
          </Notice>
          <label>
            Type DELETE to confirm
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button
            className="button danger-button"
            disabled={confirm !== "DELETE" || deletingBusy}
            onClick={async () => {
              setDeletingBusy(true);
              try {
                await cloud?.removeAccount();
                setDeleting(false);
                notify("Account deleted");
              } catch {
                notify(
                  "Could not complete deletion. Verify your identity and try again.",
                );
              } finally {
                setDeletingBusy(false);
              }
            }}
          >
            {deletingBusy ? "Deleting…" : "Verify identity and delete"}
          </button>
        </Dialog>
      )}
    </>
  );
}
