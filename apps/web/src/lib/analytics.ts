/**
 * analytics.ts — privacy-light usage tracking.
 *
 * Fire-and-forget client events sent to the `/api/track` serverless function
 * (logged in Vercel's observability). Never throws and never blocks the UI.
 * No PII beyond a truncated wallet address is collected. Pairs with Vercel Web
 * Analytics (pageviews/visitors) and the in-app on-chain Activity dashboard.
 */

export type AnalyticsEvent =
  | 'app_loaded'
  | 'wallet_connected'
  | 'wallet_connect_failed'
  | 'threshold_set'
  | 'risk_published'
  | 'guardian_policy'
  | 'guardian_fund'
  | 'guardian_withdraw'
  | 'guardian_protect'
  | 'guardian_error'
  | 'feedback_opened';

function shortAddr(a: unknown): string | undefined {
  return typeof a === 'string' && a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : undefined;
}

export function track(event: AnalyticsEvent | string, props: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({
      event,
      address: shortAddr(props.address),
      props: { ...props, address: undefined },
      path: typeof location !== 'undefined' ? location.pathname : '/',
      ts: Date.now(),
    });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      void fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the app */
  }
}
