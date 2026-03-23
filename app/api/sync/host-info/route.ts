import { NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const nets = networkInterfaces();
  const ips: string[] = [];

  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      // Only IPv4, non-internal (skip 127.0.0.1 loopback)
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  const url = new URL(req.url);
  const port = url.port || '80';

  return NextResponse.json({ ips, port }, { headers: CORS_HEADERS });
}
