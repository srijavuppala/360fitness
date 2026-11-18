# Setting up 360 Fitness in Structure

[Structure](https://runstructure.com/) turns a ~10-minute conversation into plain company files: mission, voice, departments, roles and skills. It then compiles them into `CLAUDE.md`, `AGENTS.md` and `.cursorrules`, so every Claude Code session starts from the same mission and rules. It's free, needs no account, and the files live in a git repo you own.

## How to run it (founder, ~15 minutes)

On a Mac:

```bash
brew install runstructure/tap/structure
```

```bash
mkdir 360fitness-company && cd 360fitness-company && structure new
```

Or use the web version at https://runstructure.com/create/ and download the folder. Paste the answers below when it asks. Then put the folder in a **private** repo (it describes how the company works; nothing secret, but not public either).

To point Claude Code at it inside this app repo, copy the compiled `CLAUDE.md` content into the repo's `CLAUDE.md` (or keep it as a sibling repo and reference it). Re-run `structure compile` whenever the company files change.

## Answers to paste

**"What are you building, who is it for, and why you?"**

> 360 Fitness helps adults living with type 2 diabetes or prediabetes log food, glucose and activity in a few seconds, see their own patterns, and bring an organised report to their doctor. It works as a phone app and inside the AI assistant they already use (via MCP), so we never run our own chat model. It records and explains. It never doses, diagnoses or changes treatment. I'm building it because people are told to "watch carbs" with no simple, honest way to see what actually moves their numbers.

**Voice** (pick on the sliders): Register *Clear*, Warmth *Warm*, Density *Lean*, Play *Serious*, Confidence *Assured but never clinical*. House rules:
- Say "estimate" when it's an estimate.
- Never shame a missed day.
- Never promise health outcomes.
- US spelling.

**Mission, first line:**

> We help people living with diabetes see their own data clearly and walk into every appointment prepared, without ever pretending to be their doctor.

**Departments:**
- **Product:** scope, tracker, tester feedback, release notes.
- **Engineering:** app, shared cores, MCP, CI. Every change has tests, and safety rules are checked in review.
- **Clinical safety:** advisor-approved copy, condition rules table, evaluation cases. Nothing clinical ships without sign-off.
- **Privacy & legal:** data map, processor list, policy, breach runbook.
- **Growth:** store listing, community, beta recruitment.

**Rules worth writing into the company canon** (so Claude follows them in every session):
1. Never add dosing, diagnosis or treatment-change logic, in the app or through MCP tools.
2. Unknown stays unknown: no zero-filling, no invented portions, and every number keeps its source.
3. Health data is local-first, with separate consent per kind, and never goes to ad or analytics SDKs.
4. One rulebook: app, MCP and messaging call the same shared cores in `packages/`.
5. Every PR passes the Security workflow, and clinical copy changes need an advisor's approval.

## What Structure does not do

It doesn't host anything, see user data, or replace the clinical advisor and counsel. Those approvals stay with people (see PRODUCT-PLAN §9).
