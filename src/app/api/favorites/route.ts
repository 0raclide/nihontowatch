/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/favorites
 * Fetch user's favorites with full listing details
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch favorites with listing details
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        listing_id,
        listings (
          id,
          url,
          title,
          item_type,
          price_value,
          price_currency,
          smith,
          tosogu_maker,
          school,
          tosogu_school,
          cert_type,
          nagasa_cm,
          images,
          first_seen_at,
          status,
          is_available,
          is_sold,
          dealer_id,
          dealers (
            id,
            name,
            domain
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching favorites:', error);
      return NextResponse.json(
        { error: 'Failed to fetch favorites' },
        { status: 500 }
      );
    }

    // Transform the data to extract listings with favorite metadata
    const favoritesWithListings = favorites?.map(fav => ({
      favoriteId: fav.id,
      favoritedAt: fav.created_at,
      listing: fav.listings,
    })) || [];

    // Also return just the listing IDs for quick lookup
    const favoriteIds = favorites?.map(fav => fav.listing_id) || [];

    return NextResponse.json({
      favorites: favoritesWithListings,
      favoriteIds,
      total: favorites?.length || 0,
    });
  } catch (error) {
    console.error('Favorites API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favorites
 * Add a listing to favorites
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { listing_id } = body;

    if (!listing_id || typeof listing_id !== 'number') {
      return NextResponse.json(
        { error: 'Invalid listing_id' },
        { status: 400 }
      );
    }

    // Check if listing exists
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', listing_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Already favorited', favoriteId: existing.id },
        { status: 409 }
      );
    }

    // Add to favorites
    const { data: favorite, error: insertError } = await supabase
      .from('favorites')
      .insert({
        user_id: user.id,
        listing_id,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Error adding favorite:', insertError);
      return NextResponse.json(
        { error: 'Failed to add favorite' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      favoriteId: favorite.id,
      createdAt: favorite.created_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Add favorite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/favorites
 * Remove a listing from favorites
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { listing_id } = body;

    if (!listing_id || typeof listing_id !== 'number') {
      return NextResponse.json(
        { error: 'Invalid listing_id' },
        { status: 400 }
      );
    }

    // Delete the favorite
    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listing_id);

    if (deleteError) {
      console.error('Error removing favorite:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove favorite' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
