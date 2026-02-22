import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { CreateAlertInput, UpdateAlertInput, AlertType } from '@/types';
import {
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  apiConflict,
  apiForbidden,
  apiServerError,
  apiSuccess,
} from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

// Type definitions for alert queries
type AlertWithListing = {
  id: number;
  user_id: string;
  alert_type: string;
  listing_id: number | null;
  target_price: number | null;
  search_criteria: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  listing: {
    id: number;
    url: string | null;
    title: string | null;
    item_type: string | null;
    price_value: number | null;
    price_currency: string | null;
    images: string[] | null;
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
      return apiUnauthorized();
    }

    // Parse query params for filtering
    const searchParams = request.nextUrl.searchParams;
    const alertType = searchParams.get('type') as AlertType | null;
    const activeOnly = searchParams.get('active') === 'true';

    // Type assertion for alerts table
    type AlertsTable = ReturnType<typeof supabase.from>;

    // Build query
    let query = (supabase.from('alerts') as unknown as AlertsTable)
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

    const { data: alerts, error } = await query as { data: AlertWithListing[] | null; error: { message: string } | null };

    if (error) {
      logger.error('Error fetching alerts', { error: error.message, userId: user.id });
      return apiServerError('Failed to fetch alerts');
    }

    return NextResponse.json({ alerts: alerts || [] });
  } catch (error) {
    logger.logError('Alerts API error', error);
    return apiServerError();
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
      return apiUnauthorized();
    }

    const body: CreateAlertInput = await request.json();

    // Validate required fields
    if (!body.alert_type) {
      return apiBadRequest('alert_type is required');
    }

    // Type assertion for alerts table
    type AlertsTable = ReturnType<typeof supabase.from>;

    // Validate based on alert type
    if (body.alert_type === 'price_drop' || body.alert_type === 'back_in_stock') {
      if (!body.listing_id) {
        return apiBadRequest('listing_id is required for price_drop and back_in_stock alerts');
      }

      // Check if listing exists
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id')
        .eq('id', body.listing_id)
        .single();

      if (listingError || !listing) {
        return apiNotFound('Listing');
      }

      // Check for duplicate alert
      const { data: existingAlert } = await (supabase
        .from('alerts') as unknown as AlertsTable)
        .select('id')
        .eq('user_id', user.id)
        .eq('alert_type', body.alert_type)
        .eq('listing_id', body.listing_id)
        .single() as { data: { id: number } | null };

      if (existingAlert) {
        return apiConflict('You already have this alert set up');
      }
    }

    if (body.alert_type === 'new_listing' && !body.search_criteria) {
      return apiBadRequest('search_criteria is required for new_listing alerts');
    }

    // Create the alert
    const { data: alert, error } = await (supabase
      .from('alerts') as unknown as AlertsTable)
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
      .single() as { data: AlertWithListing | null; error: { message: string } | null };

    if (error) {
      logger.error('Error creating alert', { error: error.message, userId: user.id });
      return apiServerError('Failed to create alert');
    }

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    logger.logError('Create alert error', error);
    return apiServerError();
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
      return apiUnauthorized();
    }

    const body: UpdateAlertInput & { id: number } = await request.json();

    if (!body.id) {
      return apiBadRequest('Alert id is required');
    }

    // Type assertion for alerts table
    type AlertsTable = ReturnType<typeof supabase.from>;

    // Verify ownership
    const { data: existingAlert, error: fetchError } = await (supabase
      .from('alerts') as unknown as AlertsTable)
      .select('id, user_id')
      .eq('id', body.id)
      .single() as { data: { id: number; user_id: string } | null; error: { message: string } | null };

    if (fetchError || !existingAlert) {
      return apiNotFound('Alert');
    }

    if (existingAlert.user_id !== user.id) {
      return apiForbidden();
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
    const { data: alert, error } = await (supabase
      .from('alerts') as unknown as AlertsTable)
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
      .single() as { data: AlertWithListing | null; error: { message: string } | null };

    if (error) {
      logger.error('Error updating alert', { error: error.message, alertId: body.id });
      return apiServerError('Failed to update alert');
    }

    return NextResponse.json({ alert });
  } catch (error) {
    logger.logError('Update alert error', error);
    return apiServerError();
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
      return apiUnauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('id');

    if (!alertId) {
      return apiBadRequest('Alert id is required');
    }

    // Type assertion for alerts table
    type AlertsTable = ReturnType<typeof supabase.from>;

    // Verify ownership
    const { data: existingAlert, error: fetchError } = await (supabase
      .from('alerts') as unknown as AlertsTable)
      .select('id, user_id')
      .eq('id', parseInt(alertId))
      .single() as { data: { id: number; user_id: string } | null; error: { message: string } | null };

    if (fetchError || !existingAlert) {
      return apiNotFound('Alert');
    }

    if (existingAlert.user_id !== user.id) {
      return apiForbidden();
    }

    // Delete the alert
    const { error } = await (supabase
      .from('alerts') as unknown as AlertsTable)
      .delete()
      .eq('id', parseInt(alertId)) as { error: { message: string } | null };

    if (error) {
      logger.error('Error deleting alert', { error: error.message, alertId });
      return apiServerError('Failed to delete alert');
    }

    return apiSuccess({ success: true });
  } catch (error) {
    logger.logError('Delete alert error', error);
    return apiServerError();
  }
}
