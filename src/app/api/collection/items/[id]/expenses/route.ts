import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkCollectionAccess } from '@/lib/collection/access';
import { selectCollectionItemSingle } from '@/lib/supabase/collectionItems';
import {
  selectExpensesForItem,
  insertExpense,
  countExpensesForItem,
} from '@/lib/supabase/collectionExpenses';
import { EXPENSE_CATEGORIES } from '@/types/expense';

export const dynamic = 'force-dynamic';

const EXPENSE_CATEGORY_SET = new Set<string>(EXPENSE_CATEGORIES);
const MAX_EXPENSES_PER_ITEM = 100;

/**
 * GET /api/collection/items/[id]/expenses
 * List all expenses for a collection item.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Verify ownership (URL param is item_uuid, not PK)
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'item_uuid', id, 'id, owner_id'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { data: expenses, error } = await selectExpensesForItem(serviceClient, item.id);

    if (error) {
      logger.error('Expense list error', { error });
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    return NextResponse.json({ expenses: expenses || [] });
  } catch (error) {
    logger.logError('Expense list API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collection/items/[id]/expenses
 * Create a new expense for a collection item.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Verify ownership (URL param is item_uuid, not PK)
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'item_uuid', id, 'id, owner_id'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check expense count limit
    const expenseCount = await countExpensesForItem(serviceClient, item.id);
    if (expenseCount >= MAX_EXPENSES_PER_ITEM) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_EXPENSES_PER_ITEM} expenses per item` },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate required fields
    const { category, amount, currency, expense_date, description, vendor, notes } = body;

    if (!category || typeof category !== 'string' || !EXPENSE_CATEGORY_SET.has(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (amount == null || isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 });
    }

    const expenseCurrency = (typeof currency === 'string' && currency.length <= 10)
      ? currency.toUpperCase()
      : 'JPY';

    // Validate optional date
    let validDate: string | null = null;
    if (expense_date && typeof expense_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      validDate = expense_date;
    }

    const { data: expense, error } = await insertExpense(serviceClient, {
      item_id: item.id,
      owner_id: user.id,
      category: category as string,
      amount: numAmount,
      currency: expenseCurrency,
      expense_date: validDate,
      description: typeof description === 'string' ? description.slice(0, 500) || null : null,
      vendor: typeof vendor === 'string' ? vendor.slice(0, 500) || null : null,
      notes: typeof notes === 'string' ? notes.slice(0, 1000) || null : null,
    } as Partial<import('@/types/expense').CollectionExpense>);

    if (error) {
      logger.error('Expense insert error', { error });
      return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    logger.logError('Expense create API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
