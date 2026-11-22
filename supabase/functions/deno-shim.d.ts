// Lets `tsc` typecheck the Edge Functions without Deno installed (npm run typecheck).
// Supabase runs them on Deno, which provides these for real.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'npm:web-push@3.6.7' {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  const webpush: {
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(sub: PushSubscription, payload: string, options?: { TTL?: number; urgency?: string }): Promise<unknown>;
  };
  export default webpush;
}
