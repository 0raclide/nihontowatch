import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { CreateAlertInput, UpdateAlertInput, AlertType } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/alerts
 * Fetch all alerts for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params for filtering
    const searchParams = request.nextUrl.searchParams;
    const alertType = searchParams.get('type') as AlertType | null;
    const activeOnly = searchParams.get('active') === 'true';

    // Build query
    let query = supabase
      .from('alerts')
      .select(`
        *,
        listing:listings (
          id,
          url,
          title,
          item_type,
          price_value,
          price_currency,
          images,
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

    // Apply filters
    if (alertType) {
      query = query.eq('alert_type', alertType);
    }
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ alerts: alerts || [] });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Create a new alert
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateAlertInput = await request.json();

    // Validate required fields
    if (!body.alert_type) {
      return NextResponse.json(
        { error: 'alert_type is required' },
        { status: 400 }
      );
    }

    // Validate based on alert type
    if (body.alert_type === 'price_drop' || body.alert_type === 'back_in_stock') {
      if (!body.listing_id) {
        return NextResponse.json(
          { error: 'listing_id is required for price_drop and back_in_stock alerts' },
          { status: 400 }
        );
      }

      // Check if listing exists
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id')
        .eq('id', body.listing_id)
        .single();

      if (listingError || !listing) {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }

      // Check for duplicate alert
      const { data: existingAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', user.id)
        .eq('alert_type', body.alert_type)
        .eq('listing_id', body.listing_id)
        .single();

      if (existingAlert) {
        return NextResponse.json(
          { error: 'You already have this alert set up' },
          { status: 409 }
        );
      }
    }

    if (body.alert_type === 'new_listing' && !body.search_criteria) {
      return NextResponse.json(
        { error: 'search_criteria is required for new_listing alerts' },
        { status: 400 }
      );
    }

    // Create the alert
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        user_id: user.id,
        alert_type: body.alert_type,
        listing_id: body.listing_id || null,
        target_price: body.target_price || null,
        search_criteria: body.search_criteria || null,
        is_active: true,
      })
      .select(`
        *,
        listing:listings (
          id,
          url,
          title,
          item_type,
          price_value,
          price_currency,
          images,
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
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json(
        { error: 'Failed to create alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts
 * Update an alert (toggle is_active, update target_price, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdateAlertInput & { id: number } = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Alert id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingAlert, error: fetchError } = await supabase
      .from('alerts')
      .select('id, user_id')
      .eq('id', body.id)
      .single();

    if (fetchError || !existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    if (existingAlert.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }
    if (body.target_price !== undefined) {
      updateData.target_price = body.target_price;
    }
    if (body.search_criteria !== undefined) {
      updateData.search_criteria = body.search_criteria;
    }

    // Update the alert
    const { data: alert, error } = await supabase
      .from('alerts')
      .update(updateData)
      .eq('id', body.id)
      .select(`
        *,
        listing:listings (
          id,
          url,
          title,
          item_type,
          price_value,
          price_currency,
          images,
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
      .single();

    if (error) {
      console.error('Error updating alert:', error);
      return NextResponse.json(
        { error: 'Failed to update alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert });
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts
 * Delete an alert
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('id');

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingAlert, error: fetchError } = await supabase
      .from('alerts')
      .select('id, user_id')
      .eq('id', parseInt(alertId))
      .single();

    if (fetchError || !existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    if (existingAlert.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the alert
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', parseInt(alertId));

    if (error) {
      console.error('Error deleting alert:', error);
      return NextResponse.json(
        { error: 'Failed to delete alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
