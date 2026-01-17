/**
 * Admin API for managing dealer baselines
 *
 * POST - Set a dealer's catalog baseline date
 * GET - Get all dealers with baseline status
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface DealerRow {
  id: number;
  name: string;
  domain: string;
  is_active: boolean;
  catalog_baseline_at: string | null;
  created_at: string;
}

// GET - List dealers with baseline status
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: dealers, error } = await supabase
      .from('dealers')
      .select(`
        id,
        name,
        domain,
        is_active,
        catalog_baseline_at,
        created_at
      `)
      .order('name') as { data: DealerRow[] | null; error: { message: string } | null };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get listing counts per dealer
    const { data: counts } = await supabase
      .from('listings')
      .select('dealer_id')
      .eq('status', 'available') as { data: { dealer_id: number }[] | null; error: unknown };

    const countMap: Record<number, number> = {};
    counts?.forEach((row) => {
      countMap[row.dealer_id] = (countMap[row.dealer_id] || 0) + 1;
    });

    const dealersWithCounts = dealers?.map(d => ({
      ...d,
      listing_count: countMap[d.id] || 0,
      has_baseline: !!d.catalog_baseline_at,
    }));

    return NextResponse.json({ dealers: dealersWithCounts });

  } catch (error) {
    console.error('Baseline API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Set dealer baseline
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { dealer_id, baseline_at } = body;

    if (!dealer_id) {
      return NextResponse.json(
        { error: 'dealer_id is required' },
        { status: 400 }
      );
    }

    // Set baseline to provided date or NOW()
    const baselineDate = baseline_at ? new Date(baseline_at).toISOString() : new Date().toISOString();

    const { data, error } = await supabase
      .from('dealers')
      .update({ catalog_baseline_at: baselineDate } as never)
      .eq('id', dealer_id)
      .select()
      .single() as { data: DealerRow | null; error: { message: string } | null };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update freshness confidence for existing listings
    // Listings before baseline get 'low' confidence (they were in initial import)
    // This doesn't change listings that already have 'high' confidence from Wayback
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        freshness_confidence: 'low',
        freshness_source: 'unknown',
      } as never)
      .eq('dealer_id', dealer_id)
      .lt('first_seen_at', baselineDate)
      .or('freshness_confidence.eq.unknown,freshness_confidence.is.null');

    if (updateError) {
      console.error('Failed to update listing freshness:', updateError);
    }

    return NextResponse.json({
      message: `Baseline set for dealer ${data?.name}`,
      dealer: data,
    });

  } catch (error) {
    console.error('Baseline API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
