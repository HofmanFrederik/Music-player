// Must match next.config.ts's basePath. Client-side fetches to this app's
// own API routes need the prefix explicitly — Next.js only auto-applies
// basePath to next/link, next/image, and router navigation, not to
// hand-written fetch() calls.
export const BASE_PATH = "/music-player";
