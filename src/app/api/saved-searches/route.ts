import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription } from '@/lib/subscription/server';
import { canAccessFeature } from '@/types/subscription';
import { logger } from '@/lib/logger';
import type {
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchCriteria,
  NotificationFrequency,
} from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Validate saved search criteria
 */
function validateCriteria(criteria: SavedSearchCriteria): string | null {
  // At least one filter should be set
  const hasFilter =
    criteria.itemTypes?.length ||
    criteria.certifications?.length ||
    criteria.dealers?.length ||
    criteria.schools?.length ||
    criteria.query ||
    criteria.minPrice !== undefined ||
    criteria.maxPrice !== undefined ||
    criteria.askOnly;

  if (!hasFilter) {
    return 'At least one search filter is required';
  }

  // Validate arrays
  if (criteria.itemTypes && !Array.isArray(criteria.itemTypes)) {
    return 'itemTypes must be an array';
  }
  if (criteria.certifications && !Array.isArray(criteria.certifications)) {
    return 'certifications must be an array';
  }
  if (criteria.dealers && !Array.isArray(criteria.dealers)) {
    return 'dealers must be an array';
  }

  // Validate price range
  if (
    criteria.minPrice !== undefined &&
    criteria.maxPrice !== undefined &&
    criteria.minPrice > criteria.maxPrice
  ) {
    return 'minPrice cannot be greater than maxPrice';
  }

  return null;
}

/**
 * GET /api/saved-searches
 * Fetch all saved searches for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params for filtering
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') === 'true';
    const withNotifications = searchParams.get('withNotifications') === 'true';

    // Build query
    let query = supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (withNotifications) {
      query = query.neq('notification_frequency', 'none');
    }

    const { data: savedSearches, error } = await query;

    if (error) {
      logger.error('Error fetching saved searches', { error });
      return NextResponse.json(
        { error: 'Failed to fetch saved searches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ savedSearches: savedSearches || [] });
  } catch (error) {
    logger.logError('Saved searches API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-searches
 * Create a new saved search
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check subscription tier for saved searches feature
    const subscription = await getUserSubscription();
    if (!canAccessFeature(subscription.tier, 'saved_searches')) {
      return NextResponse.json(
        {
          error: 'Upgrade required',
          feature: 'saved_searches',
          requiredTier: 'enthusiast',
          message: 'Saved searches require an Enthusiast subscription or higher.',
        },
        { status: 403 }
      );
    }

    const body: CreateSavedSearchInput = await request.json();

    // Validate search criteria
    if (!body.search_criteria) {
      return NextResponse.json(
        { error: 'search_criteria is required' },
        { status: 400 }
      );
    }

    const validationError = validateCriteria(body.search_criteria);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Validate notification frequency
    const validFrequencies: NotificationFrequency[] = [
      'instant',
      'daily',
      'none',
    ];
    if (
      body.notification_frequency &&
      !validFrequencies.includes(body.notification_frequency)
    ) {
      return NextResponse.json(
        { error: 'Invalid notification_frequency' },
        { status: 400 }
      );
    }

    // Check for max saved searches (limit to prevent abuse)
    const { count, error: countError } = await supabase
      .from('saved_searches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      logger.error('Error counting saved searches', { error: countError });
    } else if (count && count >= 20) {
      return NextResponse.json(
        { error: 'Maximum of 20 saved searches allowed' },
        { status: 400 }
      );
    }

    // Create the saved search
    const { data: savedSearch, error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: user.id,
        name: body.name || null,
        search_criteria: body.search_criteria,
        notification_frequency: body.notification_frequency || 'none',
        is_active: true,
        last_match_count: 0,
      } as never)
      .select()
      .single();

    if (error) {
      logger.error('Error creating saved search', { error });
      return NextResponse.json(
        { error: 'Failed to create saved search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ savedSearch }, { status: 201 });
  } catch (error) {
    logger.logError('Create saved search error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/saved-searches
 * Update a saved search
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateSavedSearchInput & { id: string } = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Saved search id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingData, error: fetchError } = await supabase
      .from('saved_searches')
      .select('id, user_id')
      .eq('id', body.id)
      .single();

    const existingSearch = existingData as { id: string; user_id: string } | null;

    if (fetchError || !existingSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    if (existingSearch.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate search criteria if provided
    if (body.search_criteria) {
      const validationError = validateCriteria(body.search_criteria);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.search_criteria !== undefined) {
      updateData.search_criteria = body.search_criteria;
    }
    if (body.notification_frequency !== undefined) {
      updateData.notification_frequency = body.notification_frequency;
    }
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    // Update the saved search
    const { data: savedSearch, error } = await supabase
      .from('saved_searches')
      .update(updateData as never)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating saved search', { error });
      return NextResponse.json(
        { error: 'Failed to update saved search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ savedSearch });
  } catch (error) {
    logger.logError('Update saved search error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved-searches
 * Delete a saved search
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const searchId = searchParams.get('id');

    if (!searchId) {
      return NextResponse.json(
        { error: 'Saved search id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingData, error: fetchError } = await supabase
      .from('saved_searches')
      .select('id, user_id')
      .eq('id', searchId)
      .single();

    const existingSearch = existingData as { id: string; user_id: string } | null;

    if (fetchError || !existingSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    if (existingSearch.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the saved search
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', searchId);

    if (error) {
      logger.error('Error deleting saved search', { error });
      return NextResponse.json(
        { error: 'Failed to delete saved search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Delete saved search error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
