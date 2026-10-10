const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_RECAPTCHA_ENTERPRISE_SITE_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(
    `Connected release blocked: missing ${missing.join(", ")}. Local preview builds remain available.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    "Required connected-build configuration is present. Run live sign-in, App Check, sync, deletion and AI smoke tests before release.",
  );
}
