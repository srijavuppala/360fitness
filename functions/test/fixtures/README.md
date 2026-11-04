# Food search fixtures

Trimmed real responses recorded on October 19, 2026 for the query `banana`, used by `test/foodSearch.test.js`. Only the fields the mapper reads are kept.

- `usda-search-banana.json` — USDA FoodData Central `/fdc/v1/foods/search` (public domain).
- `off-search-banana.json` — Open Food Facts search-a-licious `/search`. Open Food Facts data is © Open Food Facts contributors, available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).

To re-record, call the same endpoints with the parameters used in `src/foodSearch.js` and trim to the same fields.
