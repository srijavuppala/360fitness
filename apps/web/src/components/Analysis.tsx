import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, Notice } from "./ui";
import { useStore, aiConfigured } from "../lib/store";
import { parseMealEstimate, generateMealPrompt, type Meal } from "../lib/model";
export function Analysis({
  onClose,
  onReview,
}: {
  onClose: () => void;
  onReview: (meal: Meal) => void;
}) {
  const { user, cloud } = useStore();
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");
  const [tab, setTab] = useState<"describe" | "import">("describe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  async function analyze() {
    setError("");
    setBusy(true);
    try {
      if (!cloud || !user || !aiConfigured)
        throw new Error(
          "Sign in to a configured account to use automatic analysis. You can import an estimate or enter your meal manually.",
        );
      const raw = (await cloud.analyze(text, "snack")) as {
        items?: {
          name: string;
          qty: number;
          unit: string;
          kcal: number;
          proteinG: number;
          carbsG: number;
          fatG: number;
        }[];
        needsClarification?: boolean;
        question?: string;
      };
      if (raw.needsClarification)
        throw new Error(
          raw.question || "Please include the food and portion size.",
        );
      if (!Array.isArray(raw.items))
        throw new Error("The analysis did not return a usable estimate.");
      const meal = parseMealEstimate(
        JSON.stringify({
          items: raw.items.map((f) => ({
            name: f.name,
            quantity: f.qty,
            unit: f.unit,
            calories: f.kcal,
            protein_g: f.proteinG,
            carbs_g: f.carbsG,
            fat_g: f.fatG,
          })),
        }),
        text.slice(0, 100),
      );
      onReview(meal);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Analysis failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function review() {
    try {
      onReview(parseMealEstimate(response, text.trim().slice(0, 100)));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <Dialog
      title="A little help with your meal."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="segmented">
        <button
          className={tab === "describe" ? "active" : ""}
          onClick={() => setTab("describe")}
        >
          Describe a meal
        </button>
        <button
          className={tab === "import" ? "active" : ""}
          onClick={() => setTab("import")}
        >
          Import an estimate
        </button>
      </div>
      <label>
        What did you eat?
        <textarea
          autoFocus
          maxLength={500}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPrompt("");
          }}
          placeholder="A bowl of rice, grilled chicken, and half an avocado…"
          rows={4}
        />
      </label>
      {tab === "describe" ? (
        <>
          <Notice>
            {aiConfigured && user
              ? "Your description is sent to our nutrition analysis service. Review the estimate before confirming; analysis never logs a meal automatically."
              : "Automatic analysis needs a connected account. For now, use an estimate from your own assistant or add foods manually."}
          </Notice>
          <button
            className="button full"
            disabled={busy || !text.trim() || !user || !aiConfigured}
            onClick={analyze}
          >
            <Sparkles size={17} />
            {busy ? "Preparing your estimate…" : "Analyze my meal"}
          </button>
          <button className="text-button" onClick={() => setTab("import")}>
            Use my own AI estimate instead
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            Generate a prompt for an assistant of your choice, then paste its
            JSON response. Nothing is sent from this screen.
          </p>
          <button
            className="button secondary"
            disabled={!text.trim()}
            onClick={() => {
              try {
                setPrompt(generateMealPrompt(text));
                setError("");
              } catch (cause) {
                setError((cause as Error).message);
              }
            }}
          >
            Prepare a prompt
          </button>
          {prompt && (
            <textarea
              aria-label="Generated prompt"
              readOnly
              value={prompt}
              rows={6}
            />
          )}
          <label>
            Estimate response
            <textarea
              value={response}
              maxLength={30001}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Paste the complete JSON estimate"
              rows={6}
            />
          </label>
          <button
            className="button full"
            disabled={!text.trim() || !response.trim()}
            onClick={review}
          >
            Review estimate
          </button>
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </Dialog>
  );
}
