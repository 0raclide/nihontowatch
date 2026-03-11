import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkCollectionAccess } from '@/lib/collection/access';
import { selectCollectionItemSingle } from '@/lib/supabase/collectionItems';
import {
  collectionExpensesFrom,
  updateExpense,
  deleteExpense,
} from '@/lib/supabase/collectionExpenses';
import { EXPENSE_CATEGORIES } from '@/types/expense';

export const dynamic = 'force-dynamic';

const EXPENSE_CATEGORY_SET = new Set<string>(EXPENSE_CATEGORIES);

/**
 * PATCH /api/collection/items/[id]/expenses/[expenseId]
 * Update an expense.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Verify item ownership
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', id, 'id, owner_id'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify expense exists and belongs to this item
    const { data: existing } = await collectionExpensesFrom(serviceClient)
      .select('id, item_id, owner_id')
      .eq('id', expenseId)
      .single();

    if (!existing || existing.item_id !== id || existing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if ('category' in body) {
      if (typeof body.category === 'string' && EXPENSE_CATEGORY_SET.has(body.category)) {
        updates.category = body.category;
      }
    }
    if ('amount' in body) {
      const num = Number(body.amount);
      if (!isNaN(num) && num > 0) {
        updates.amount = num;
      }
    }
    if ('currency' in body) {
      if (typeof body.currency === 'string' && body.currency.length <= 10) {
        updates.currency = body.currency.toUpperCase();
      }
    }
    if ('expense_date' in body) {
      if (body.expense_date && typeof body.expense_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expense_date)) {
        updates.expense_date = body.expense_date;
      } else {
        updates.expense_date = null;
      }
    }
    if ('description' in body) {
      updates.description = typeof body.description === 'string' ? body.description.slice(0, 500) || null : null;
    }
    if ('vendor' in body) {
      updates.vendor = typeof body.vendor === 'string' ? body.vendor.slice(0, 500) || null : null;
    }
    if ('notes' in body) {
      updates.notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) || null : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await updateExpense(
      serviceClient,
      expenseId,
      updates as Partial<import('@/types/expense').CollectionExpense>
    );

    if (error) {
      logger.error('Expense update error', { error });
      return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.logError('Expense update API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/collection/items/[id]/expenses/[expenseId]
 * Delete an expense.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Verify item ownership
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', id, 'id, owner_id'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify expense exists and belongs to this item
    const { data: existing } = await collectionExpensesFrom(serviceClient)
      .select('id, item_id, owner_id')
      .eq('id', expenseId)
      .single();

    if (!existing || existing.item_id !== id || existing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const { error } = await deleteExpense(serviceClient, expenseId);

    if (error) {
      logger.error('Expense delete error', { error });
      return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Expense delete API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
