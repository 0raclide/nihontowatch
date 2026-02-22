import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  apiConflict,
  apiServerError,
  apiSuccess,
} from '@/lib/api/responses';

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
      return apiUnauthorized('Authentication required');
    }

    // Type for favorites with nested listing data
    type FavoriteWithListing = {
      id: number;
      created_at: string;
      listing_id: number;
      listings: {
        id: number;
        url: string | null;
        title: string | null;
        item_type: string | null;
        price_value: number | null;
        price_currency: string | null;
        smith: string | null;
        tosogu_maker: string | null;
        school: string | null;
        tosogu_school: string | null;
        cert_type: string | null;
        nagasa_cm: number | null;
        images: string[] | null;
        first_seen_at: string | null;
        status: string | null;
        is_available: boolean | null;
        is_sold: boolean | null;
        dealer_id: number | null;
        dealers: {
          id: number;
          name: string;
          name_ja?: string | null;
          domain: string;
        } | null;
      } | null;
    };

    // Type assertion needed - user_favorites table may not be in generated types
    type UserFavoritesTable = ReturnType<typeof supabase.from>;

    // Fetch favorites with listing details
    const { data: favorites, error } = await (supabase
      .from('user_favorites') as unknown as UserFavoritesTable)
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
            name_ja,
            domain
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) as { data: FavoriteWithListing[] | null; error: { message: string } | null };

    if (error) {
      logger.error('Error fetching favorites', { error: error.message, userId: user.id });
      return apiServerError('Failed to fetch favorites');
    }

    // Transform the data to extract listings with favorite metadata
    const favoritesWithListings = favorites?.map(fav => ({
      favoriteId: fav.id,
      favoritedAt: fav.created_at,
      listing: fav.listings,
    })) || [];

    // Also return just the listing IDs for quick lookup
    const favoriteIds = favorites?.map(fav => fav.listing_id) || [];

    return apiSuccess({
      favorites: favoritesWithListings,
      favoriteIds,
      total: favorites?.length || 0,
    });
  } catch (error) {
    logger.logError('Favorites API error', error);
    return apiServerError();
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
      return apiUnauthorized('Authentication required');
    }

    const body = await request.json();
    const { listing_id } = body;

    if (!listing_id || typeof listing_id !== 'number') {
      return apiBadRequest('Invalid listing_id');
    }

    // Check if listing exists
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return apiNotFound('Listing');
    }

    // Type assertion needed - user_favorites table may not be in generated types
    type UserFavoritesTable = ReturnType<typeof supabase.from>;

    // Check if already favorited
    const { data: existing } = await (supabase
      .from('user_favorites') as unknown as UserFavoritesTable)
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', listing_id)
      .single() as { data: { id: number } | null };

    if (existing) {
      return apiConflict('Already favorited');
    }

    // Add to favorites
    const { data: favorite, error: insertError } = await (supabase
      .from('user_favorites') as unknown as UserFavoritesTable)
      .insert({
        user_id: user.id,
        listing_id,
      })
      .select('id, created_at')
      .single() as { data: { id: number; created_at: string } | null; error: { message: string } | null };

    if (insertError || !favorite) {
      logger.error('Error adding favorite', { error: insertError?.message, userId: user.id, listing_id });
      return apiServerError('Failed to add favorite');
    }

    return NextResponse.json({
      success: true,
      favoriteId: favorite.id,
      createdAt: favorite.created_at,
    }, { status: 201 });
  } catch (error) {
    logger.logError('Add favorite error', error);
    return apiServerError();
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
      return apiUnauthorized('Authentication required');
    }

    const body = await request.json();
    const { listing_id } = body;

    if (!listing_id || typeof listing_id !== 'number') {
      return apiBadRequest('Invalid listing_id');
    }

    // Type assertion needed - user_favorites table may not be in generated types
    type UserFavoritesTable = ReturnType<typeof supabase.from>;

    // Delete the favorite
    const { error: deleteError } = await (supabase
      .from('user_favorites') as unknown as UserFavoritesTable)
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listing_id) as { error: { message: string } | null };

    if (deleteError) {
      logger.error('Error removing favorite', { error: deleteError.message, userId: user.id, listing_id });
      return apiServerError('Failed to remove favorite');
    }

    return apiSuccess({ success: true });
  } catch (error) {
    logger.logError('Remove favorite error', error);
    return apiServerError();
  }
}
