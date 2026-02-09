import { NextRequest, NextResponse } from 'next/server';
import { getEliteDistribution } from '@/lib/supabase/yuhinkai';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');

  if (type !== 'smith' && type !== 'tosogu') {
    return NextResponse.json({ error: 'type must be smith or tosogu' }, { status: 400 });
  }

  const result = await getEliteDistribution(type);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
