/**
 * /api/track — minimal analytics + monitoring sink (Vercel Edge function).
 *
 * Accepts fire-and-forget client events and structured error reports and logs
 * them as JSON so they show up in Vercel's Observability / function logs. Kept
 * dependency-free and self-contained on purpose (no third-party account needed).
 */

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const record = {
      kind: 'sentinel-event',
      event: body?.event ?? 'unknown',
      address: body?.address,
      props: body?.props,
      path: body?.path,
      ts: body?.ts ?? Date.now(),
      country: req.headers.get('x-vercel-ip-country') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    };
    // Structured log line — searchable in Vercel Observability.
    console.log(JSON.stringify(record));
  } catch {
    // ignore malformed payloads
  }

  return new Response(null, { status: 204 });
}
