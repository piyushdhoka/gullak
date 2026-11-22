// Email links (confirm sign-up, reset password) that fail come back to the site as
//   /#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
// Read that once, as early as possible (at module load, before the Supabase client can clear the URL),
// so the sign-in screen can say what happened instead of silently showing the website.

let captured: string | null = null;

if (typeof window !== 'undefined' && window.location) {
  const raw = `${window.location.hash.replace(/^#/, '')}&${window.location.search.replace(/^\?/, '')}`;
  const p = new URLSearchParams(raw);
  const code = p.get('error_code');
  if (code || p.get('error')) {
    captured =
      code === 'otp_expired'
        ? 'That email link has expired or was already used. If you already confirmed, just sign in. If not, sign in and Gullak will email you a fresh link.'
        : 'That email link didn’t work. Sign in, and Gullak will send you a fresh one if your email still needs confirming.';
    // Drop the error from the address bar so a reload doesn't show it again.
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // ignore
    }
  }
}

/** True when this page load came from a failed email link. */
export function hasAuthLinkError(): boolean {
  return captured != null;
}

/** The message for a failed email link (null if this load didn't come from one). */
export function authLinkError(): string | null {
  return captured;
}

/** Forget it once the person has acted (e.g. submitted the sign-in form). */
export function clearAuthLinkError() {
  captured = null;
}
