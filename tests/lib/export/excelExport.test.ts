import { describe, it, expect } from 'vitest';
import type { DisplayItem } from '@/types/displayItem';
import type { ItemReturnData } from '@/lib/fx/financialCalculator';
import { buildCollectorVaultWorkbook, buildDealerInventoryWorkbook } from '@/lib/export/excelExport';

// Use real ExcelJS for integration tests — tests the build functions directly
// (no Blob/download issues in test env)
const ExcelJS = require('exceljs');

// =============================================================================
// Helpers
// =============================================================================

function makeCollectionItem(overrides: Partial<DisplayItem> = {}): DisplayItem {
  return {
    id: 'test-uuid-1',
    source: 'collection',
    title: 'Katana by Masamune',
    item_type: 'katana',
    price_value: 5000000,
    price_currency: 'JPY',
    smith: 'Masamune',
    tosogu_maker: null,
    school: 'Sagami',
    tosogu_school: null,
    province: 'Sagami',
    era: 'Kamakura',
    cert_type: 'Juyo',
    nagasa_cm: 70.5,
    images: ['img1.jpg', 'img2.jpg'],
    status: 'owned',
    is_available: false,
    is_sold: false,
    first_seen_at: '2025-01-01T00:00:00Z',
    dealer_display_name: '',
    collection: {
      item_uuid: 'test-uuid-1',
      personal_notes: null,
      visibility: 'private',
      source_listing_id: null,
      holding_status: 'owned',
      purchase_price: 4500000,
      purchase_currency: 'JPY',
      purchase_date: '2024-06-15',
      purchase_source: 'Aoi Art',
      current_value: 5000000,
      current_currency: 'JPY',
      location: 'Home safe',
      sold_price: null,
      sold_currency: null,
      sold_date: null,
      sold_to: null,
      sold_venue: null,
      total_invested: 4800000,
    },
    ...overrides,
  };
}

function makeDealerItem(overrides: Partial<DisplayItem> = {}): DisplayItem {
  return {
    id: 123,
    source: 'dealer',
    title: 'Wakizashi by Tadayoshi',
    item_type: 'wakizashi',
    price_value: 2500000,
    price_currency: 'JPY',
    smith: 'Tadayoshi',
    tosogu_maker: null,
    school: 'Hizen',
    tosogu_school: null,
    province: 'Hizen',
    era: 'Shinto',
    cert_type: 'Tokubetsu Hozon',
    nagasa_cm: 52.3,
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
    status: 'available',
    is_available: true,
    is_sold: false,
    first_seen_at: '2026-01-15T00:00:00Z',
    dealer_display_name: 'Aoi Art',
    video_count: 1,
    description: 'A fine wakizashi.',
    browse: {
      url: 'https://example.com/listing/123',
      featured_score: 245,
    },
    ...overrides,
  };
}

function makeReturnData(overrides: Partial<ItemReturnData> = {}): ItemReturnData {
  return {
    currentValueHome: 5000000,
    totalInvestedHome: 4800000,
    totalReturn: 200000,
    totalReturnPct: 4.17,
    canDecompose: true,
    assetReturn: 500000,
    fxImpact: -200000,
    expenseDrag: -100000,
    inflationImpact: null,
    realReturn: null,
    realReturnPct: null,
    inflationAdjustedCost: null,
    isRealized: false,
    annualizedReturnPct: 5.2,
    holdingDays: 365,
    ...overrides,
  };
}

// =============================================================================
// Collector Vault Export
// =============================================================================

describe('buildCollectorVaultWorkbook', () => {
  it('creates a workbook with 18 columns', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    expect(ws).toBeDefined();
    expect(ws.columns.length).toBe(18);
  });

  it('maps item data to correct cells', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const row = ws.getRow(2); // row 1 = header

    expect(row.getCell(1).value).toBe('Owned'); // Status
    expect(row.getCell(2).value).toBe('Katana by Masamune'); // Title
    expect(row.getCell(3).value).toBe('Katana'); // Type
    expect(row.getCell(4).value).toBe('Juyo'); // Cert
    expect(row.getCell(5).value).toBe('Masamune'); // Attribution
    expect(row.getCell(6).value).toBe('Sagami'); // School
    expect(row.getCell(7).value).toBe('Kamakura'); // Era
    expect(row.getCell(8).value).toBe('Sagami'); // Province
    expect(row.getCell(9).value).toBe('2024-06-15'); // Purchase Date
    expect(row.getCell(10).value).toBe(4500000); // Purchase Price
    expect(row.getCell(11).value).toBe('JPY'); // Purchase Currency
    expect(row.getCell(12).value).toBe(5000000); // Current Value
    expect(row.getCell(18).value).toBe('Home safe'); // Location
  });

  it('includes return data from returnMap', () => {
    const returnData = makeReturnData({ totalReturn: 200000, totalReturnPct: 4.17, annualizedReturnPct: 5.2 });
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', returnData]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const row = ws.getRow(2);

    expect(row.getCell(14).value).toBe(4800000); // Total Invested
    expect(row.getCell(15).value).toBe(200000); // Return
    expect(row.getCell(16).value).toBeCloseTo(0.0417, 4); // Return % (as decimal)
    expect(row.getCell(17).value).toBeCloseTo(0.052, 3); // Annualized %
  });

  it('handles null return data gracefully', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map(), // no entry for item
      homeCurrency: 'USD',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const row = ws.getRow(2);

    expect(row.getCell(14).value).toBeNull(); // Total Invested
    expect(row.getCell(15).value).toBeNull(); // Return
    expect(row.getCell(16).value).toBeNull(); // Return %
  });

  it('applies green fill for positive returns', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData({ totalReturn: 100000 })]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const returnCell = ws.getRow(2).getCell(15);
    expect(returnCell.fill?.fgColor?.argb).toBe('FFE8F5E9');
  });

  it('applies red fill for negative returns', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData({ totalReturn: -300000 })]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const returnCell = ws.getRow(2).getCell(15);
    expect(returnCell.fill?.fgColor?.argb).toBe('FFFCE4EC');
  });

  it('freezes the header row', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    expect(ws.views[0]?.state).toBe('frozen');
    expect(ws.views[0]?.ySplit).toBe(1);
  });

  it('includes portfolio summary section', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');

    // Portfolio Summary header at row 4 (1 header + 1 data + 1 blank + 1 summary)
    expect(ws.getRow(4).getCell(1).value).toBe('Portfolio Summary');
    // Total Declared Value at row 5
    expect(ws.getRow(5).getCell(1).value).toContain('Total Declared Value');
    expect(ws.getRow(5).getCell(2).value).toBe(5000000);
  });

  it('handles sold items using sold_price as current value', () => {
    const soldItem = makeCollectionItem({
      id: 'sold-uuid',
      collection: {
        item_uuid: 'sold-uuid',
        personal_notes: null,
        visibility: 'private',
        source_listing_id: null,
        holding_status: 'sold',
        purchase_price: 3000000,
        purchase_currency: 'JPY',
        purchase_date: '2023-01-01',
        purchase_source: 'Direct',
        current_value: 3500000,
        current_currency: 'JPY',
        location: null,
        sold_price: 4000000,
        sold_currency: 'USD',
        sold_date: '2025-06-01',
        sold_to: 'Private collector',
        sold_venue: 'Direct sale',
        total_invested: 3200000,
      },
    });

    const wb = buildCollectorVaultWorkbook({
      items: [soldItem],
      returnMap: new Map([['sold-uuid', makeReturnData({ isRealized: true })]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const row = ws.getRow(2);

    expect(row.getCell(1).value).toBe('Sold'); // Status
    expect(row.getCell(12).value).toBe(4000000); // Current Value = sold_price
    expect(row.getCell(13).value).toBe('USD'); // Value Currency = sold_currency
  });

  it('handles tosogu dual-path attribution', () => {
    const tosoguItem = makeCollectionItem({
      smith: null,
      tosogu_maker: 'Goto Yujo',
      school: null,
      tosogu_school: 'Goto',
      item_type: 'tsuba',
    });

    const wb = buildCollectorVaultWorkbook({
      items: [tosoguItem],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const row = ws.getRow(2);

    expect(row.getCell(3).value).toBe('Tsuba');
    expect(row.getCell(5).value).toBe('Goto Yujo');
    expect(row.getCell(6).value).toBe('Goto');
  });

  it('handles empty items array', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [],
      returnMap: new Map(),
      homeCurrency: 'USD',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    expect(ws.getRow(2).getCell(1).value).toBeNull(); // No data rows
    // Summary still exists
    expect(ws.getRow(3).getCell(1).value).toBe('Portfolio Summary');
  });

  it('handles null collection extension gracefully', () => {
    const item = makeCollectionItem({ collection: undefined as any });

    const wb = buildCollectorVaultWorkbook({
      items: [item],
      returnMap: new Map(),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const row = ws.getRow(2);

    expect(row.getCell(1).value).toBe('Owned'); // Default status
    expect(row.getCell(10).value).toBeNull(); // Purchase Price
    expect(row.getCell(18).value).toBe(''); // Location
  });

  it('uses header styling (gold on dark)', () => {
    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    const headerCell = ws.getRow(1).getCell(1);

    expect(headerCell.font?.bold).toBe(true);
    expect(headerCell.font?.color?.argb).toBe('FFD4AF37');
    expect(headerCell.fill?.fgColor?.argb).toBe('FF2D2D2D');
  });

  it('includes decomposition in portfolio summary when available', () => {
    const returnMap = new Map([['test-uuid-1', makeReturnData({
      canDecompose: true,
      assetReturn: 500000,
      fxImpact: -200000,
      expenseDrag: -100000,
    })]]);

    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem()],
      returnMap,
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');

    let foundAssetReturn = false;
    ws.eachRow((row: any) => {
      if (row.getCell(1).value === 'Asset Return') {
        foundAssetReturn = true;
        expect(row.getCell(2).value).toBe(500000);
      }
    });
    expect(foundAssetReturn).toBe(true);
  });

  it('includes unrealized/realized splits when both exist', () => {
    const ownedReturn = makeReturnData({ isRealized: false, totalReturn: 200000 });
    const soldReturn = makeReturnData({ isRealized: true, totalReturn: 100000 });

    const soldItem = makeCollectionItem({
      id: 'sold-uuid',
      collection: {
        item_uuid: 'sold-uuid',
        personal_notes: null,
        visibility: 'private',
        source_listing_id: null,
        holding_status: 'sold',
        purchase_price: 2000000,
        purchase_currency: 'JPY',
        purchase_date: '2023-01-01',
        purchase_source: 'Direct',
        current_value: null,
        current_currency: null,
        location: null,
        sold_price: 2500000,
        sold_currency: 'JPY',
        sold_date: '2025-06-01',
        sold_to: null,
        sold_venue: null,
        total_invested: 2200000,
      },
    });

    const wb = buildCollectorVaultWorkbook({
      items: [makeCollectionItem(), soldItem],
      returnMap: new Map([['test-uuid-1', ownedReturn], ['sold-uuid', soldReturn]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    let foundUnrealized = false;
    let foundRealized = false;
    ws.eachRow((row: any) => {
      if (row.getCell(1).value === 'Unrealized (Owned)') foundUnrealized = true;
      if (row.getCell(1).value === 'Realized (Sold)') foundRealized = true;
    });
    expect(foundUnrealized).toBe(true);
    expect(foundRealized).toBe(true);
  });

  it('formats cert labels correctly', () => {
    const item = makeCollectionItem({ cert_type: 'Tokubetsu Juyo' });

    const wb = buildCollectorVaultWorkbook({
      items: [item],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    expect(ws.getRow(2).getCell(4).value).toBe('Tokubetsu Juyo');
  });

  it('handles null cert_type', () => {
    const item = makeCollectionItem({ cert_type: null });

    const wb = buildCollectorVaultWorkbook({
      items: [item],
      returnMap: new Map([['test-uuid-1', makeReturnData()]]),
      homeCurrency: 'JPY',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Vault');
    expect(ws.getRow(2).getCell(4).value).toBe('');
  });
});

// =============================================================================
// Dealer Inventory Export
// =============================================================================

describe('buildDealerInventoryWorkbook', () => {
  it('creates a workbook with 15 columns', () => {
    const wb = buildDealerInventoryWorkbook({
      items: [makeDealerItem()],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws).toBeDefined();
    expect(ws.columns.length).toBe(15);
  });

  it('maps dealer item data to correct cells', () => {
    const wb = buildDealerInventoryWorkbook({
      items: [makeDealerItem()],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    const row = ws.getRow(2);

    expect(row.getCell(1).value).toBe('Available'); // Status
    expect(row.getCell(2).value).toBe('Wakizashi by Tadayoshi'); // Title
    expect(row.getCell(3).value).toBe('Wakizashi'); // Type
    expect(row.getCell(4).value).toBe('Tokubetsu Hozon'); // Cert
    expect(row.getCell(5).value).toBe('Tadayoshi'); // Attribution
    expect(row.getCell(6).value).toBe('Hizen'); // School
    expect(row.getCell(9).value).toBe(2500000); // Price
    expect(row.getCell(10).value).toBe('JPY'); // Currency
  });

  it('computes days listed from first_seen_at', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeDealerItem({ first_seen_at: thirtyDaysAgo });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(11).value).toBe(30);
  });

  it('counts images correctly', () => {
    const item = makeDealerItem({ images: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'] });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(12).value).toBe(4);
  });

  it('uses stored_images over images when available', () => {
    const item = makeDealerItem({
      stored_images: ['s1.jpg', 's2.jpg'],
      images: ['o1.jpg'],
    });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(12).value).toBe(2);
  });

  it('computes completeness percentage', () => {
    const wb = buildDealerInventoryWorkbook({
      items: [makeDealerItem()],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    // makeDealerItem has: images(20), price(20), attribution(15), measurements(15),
    // description(10), era(5), cert(5), school(5), province(5) = 100
    expect(ws.getRow(2).getCell(14).value).toBe(1); // 100% = 1.0
  });

  it('includes featured_score from browse extension', () => {
    const item = makeDealerItem();
    item.browse = { url: 'https://example.com/123', featured_score: 312 };

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(15).value).toBe(312);
  });

  it('shows video count', () => {
    const item = makeDealerItem({ video_count: 3 });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(13).value).toBe(3);
  });

  it('uses tab label in sheet name', () => {
    const wb = buildDealerInventoryWorkbook({
      items: [makeDealerItem()],
      tabLabel: 'Hold',
      Workbook: ExcelJS.Workbook,
    });

    expect(wb.getWorksheet('Hold')).toBeDefined();
  });

  it('handles null images gracefully', () => {
    const item = makeDealerItem({ images: null, stored_images: undefined });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(12).value).toBe(0);
  });

  it('handles empty items array', () => {
    const wb = buildDealerInventoryWorkbook({
      items: [],
      tabLabel: 'Sold',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Sold');
    expect(ws.getRow(2).getCell(1).value).toBeNull();
  });

  it('shows Sold status for sold items', () => {
    const item = makeDealerItem({ is_sold: true, is_available: false, status: 'sold' });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Sold',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Sold');
    expect(ws.getRow(2).getCell(1).value).toBe('Sold');
  });

  it('freezes the header row', () => {
    const wb = buildDealerInventoryWorkbook({
      items: [makeDealerItem()],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.views[0]?.state).toBe('frozen');
    expect(ws.views[0]?.ySplit).toBe(1);
  });

  it('handles null featured_score when no browse extension', () => {
    const item = makeDealerItem({ browse: undefined });

    const wb = buildDealerInventoryWorkbook({
      items: [item],
      tabLabel: 'Available',
      Workbook: ExcelJS.Workbook,
    });

    const ws = wb.getWorksheet('Available');
    expect(ws.getRow(2).getCell(15).value).toBeNull();
  });
});
