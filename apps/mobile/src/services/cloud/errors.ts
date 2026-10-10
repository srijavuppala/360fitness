export function accountError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (
    [
      "auth/invalid-credential",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(code ?? "")
  )
    return "Couldn’t sign in. Check your email and password, or reset your password.";
  if (code === "auth/email-already-in-use")
    return "This email already has an account. Sign in or reset your password.";
  if (
    code === "auth/weak-password" ||
    code === "auth/password-does-not-meet-requirements"
  )
    return "Choose a stronger password that meets your account’s password requirements.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait before trying again.";
  if (code === "permission-denied")
    return "Cloud access was denied. Verify your email and check the deployed Firebase rules.";
  if (code === "auth/network-request-failed" || code === "unavailable")
    return "Couldn’t reach Firebase. Your local profile is safe; reconnect and try again.";
  if (
    error instanceof Error &&
    error.message.startsWith("Your cloud profile changed")
  )
    return error.message;
  return "Couldn’t complete that action. Your local profile is unchanged. Please try again.";
}
