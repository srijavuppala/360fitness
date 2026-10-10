# Product scanning and AI references

Reviewed October 7, 2026. Target: the React Native / Expo app for iPhone and Android.

## Projects reviewed

| Project | Useful ideas | Reuse decision |
| --- | --- | --- |
| [Open Food Facts React Native sample](https://github.com/openfoodfacts/openfoodfacts-react-native) | Official example for product data/photo contributions and API integration; README identifies Apache 2.0. | Use the documented API directly. It is a sample, not a complete app to replace our existing product. |
| [Nutrifact](https://github.com/simplystudios/Nutrifact) | Focused barcode-to-nutrition flow; React Native and Open Food Facts; GPL-3.0. | UI/flow reference only. No source copied. |
| [SafeBite](https://github.com/Ajay-Krishna00/SafeBite) | Barcode lookup, label-photo OCR and AI explanation flows; Expo with a separate AI backend. | Architecture reference only. README health/safety claims have not been clinically validated here. Do not adopt its medical verdicts. No source copied; license file not independently verified. |

The existing app already has reviewed meal logging, history and local persistence. Replacing it would discard that work. The useful shared foundation across these projects is a product database plus a separate review/explanation layer.

## Implemented first slice

1. Scan an EAN-8, EAN-13, UPC-A or ITF-14 barcode on device, or type the printed GTIN.
2. Validate the check digit; normalize UPC-A / EAN-13 equivalence; reject QR links and invalid payloads.
3. Retrieve selected fields from Open Food Facts API v2. Only the barcode is sent; no images, diary, allergy profile or health history are uploaded.
4. Display reported Nutri-Score, nutrient levels, NOVA processing group, nutrition, ingredients, reported allergens and traces. Missing values remain unknown. No global healthy/unhealthy or allergen-safe verdict is generated.
5. Check the package and choose grams/milliliters and amount. Open a portion-scaled draft in the existing meal review; the user must confirm to log.
6. Retain Open Food Facts barcode attribution with logged food and in exported local data.

Camera permission is requested on demand. No microphone permission, photos or video recording is needed. Camera is unmounted when leaving the scanner or backgrounding the app. Browser preview offers typed barcode lookup; camera needs a phone build.

Networking: 12-second timeout, cancellation on departure, duplicate-scan guard, 10-minute in-memory cache (100 products maximum), explicit not-found/rate-limit/offline errors. No background retries or persistent scan-history database is added.

## How AI should fit next

- **Label photo fallback:** for products not in the database, crop a nutrition/ingredients label; upload only after explicit user action; run server-side OCR/vision with a strict response schema.
- **Review extraction:** preserve original units and serving basis, mark unreadable fields unknown, and require user correction before logging.
- **Grounded explanation:** an AI summary may explain retrieved facts and cite those fields. It should not fabricate missing scores, diagnose conditions, or declare allergy safety.
- **Meal photos:** separate flow for estimated portions/macros; those are estimates with confirmation, not barcode label values.
- Prerequisites for live AI: authenticated native service, server-held provider key, App Check, quotas, image size limits, retention/deletion policy, redacted logs and adversarial label-text tests. Barcode lookup works without these credentials.

## Sources and attribution

- [Expo SDK 57 camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/): CameraView, permission API, barcode settings, screen lifecycle.
- [Open Food Facts API tutorial](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-off-api/): barcode product lookup and selected fields.
- [Open Food Facts licensing](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/): ODbL database, DbCL contents, separate CC BY-SA product-image license. This implementation does not download or display product images.

Before creating a shared commercial product cache/database, review the ODbL share-alike obligations for that data architecture. Current lookup is read-only, with transient session caching and explicit on-screen attribution.

### Implemented label fallback — October 7, 2026

Photo capture/selection, local preview, conservative pasted-label text import, explicit label basis, kcal/kJ conversion, portion preview and manual meal review are now implemented. These work independently of Expo login and AI credentials. The photo itself is not read automatically or uploaded. Live server-side OCR/vision remains a separate integration task; it must not be presented as working AI.

### AI integration implemented — October 7, 2026

The photo reader now includes a real Gemini adapter, protected Firebase callable, local-development bridge, native Firebase transport and editable extraction review. No live credentials/deployment exist yet. See [setup and evidence](label-photo-ai-setup.md). Barcode lookup remains independent of this setup.
