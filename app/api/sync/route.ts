import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), '.sync');
const SYNC_FILE = join(DATA_DIR, 'plan.json');

// Allow Capacitor apps and other local-network origins
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    if (!existsSync(SYNC_FILE)) {
      return NextResponse.json(
        { error: 'No sync data yet' },
        { status: 404, headers: CORS_HEADERS }
      );
    }
    const data = await readFile(SYNC_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(data), { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Read error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid body' },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SYNC_FILE, JSON.stringify(body), 'utf-8');
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Write error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
