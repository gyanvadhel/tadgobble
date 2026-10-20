import { handle } from '../../../lib/api.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export async function GET(req, { params }) {
  return handle(req, (await params).path);
}
export async function POST(req, { params }) {
  return handle(req, (await params).path);
}
