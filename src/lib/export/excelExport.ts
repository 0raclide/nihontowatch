/**
 * Excel export for Vault (collector) and Dealer Inventory tabs.
 *
 * Uses ExcelJS for professional formatting: frozen headers, number formats,
 * conditional fill colors on return cells, and a portfolio summary section.
 *
 * Both functions accept a pre-loaded ExcelJS `Workbook` constructor so the
 * caller can dynamic-import exceljs once and pass it in (zero bundle impact).
 *
 * The `build*` functions return an ExcelJS Workbook (testable).
 * The `export*` functions call build + trigger browser download.
 */

import type { DisplayItem } from '@/types/displayItem';
import type { ItemReturnData } from '@/lib/fx/financialCalculator';
import { computePortfolioTotals } from '@/lib/fx/financialCalculator';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';
import { getItemTypeLabel, CERT_LABELS } from '@/lib/collection/labels';
import { computeInventoryCompleteness } from '@/lib/dealer/completeness';
import { downloadBlob } from './downloadBlob';

// =============================================================================
// Types
// =============================================================================

export interface CollectorExportOptions {
  items: DisplayItem[];
  returnMap: Map<string, ItemReturnData>;
  homeCurrency: string;
  /** ExcelJS Workbook class (dynamic import) */
  Workbook: any;
}

export interface DealerExportOptions {
  items: DisplayItem[];
  tabLabel: string;
  Workbook: any;
}

// =============================================================================
// Shared styling constants
// =============================================================================

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2D2D2D' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFD4AF37' }, size: 11 };
const HEADER_BORDER = {
  bottom: { style: 'thin' as const, color: { argb: 'FF555555' } },
};
const POSITIVE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8F5E9' } };
const NEGATIVE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFCE4EC' } };
const SUMMARY_LABEL_FONT = { bold: true, size: 11 };
const SUMMARY_HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF5F5F5' } };

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function certLabel(certType: string | null): string {
  if (!certType) return '';
  const info = CERT_LABELS[certType];
  return info ? info.label : certType;
}

function safeStr(v: string | null | undefined): string {
  return v ?? '';
}

// =============================================================================
// Collector Vault — Build Workbook
// =============================================================================

const COLLECTOR_COLUMNS = [
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Title', key: 'title', width: 36 },
  { header: 'Type', key: 'type', width: 14 },
  { header: 'Certification', key: 'cert', width: 20 },
  { header: 'Attribution', key: 'attribution', width: 22 },
  { header: 'School', key: 'school', width: 18 },
  { header: 'Era', key: 'era', width: 16 },
  { header: 'Province', key: 'province', width: 16 },
  { header: 'Purchase Date', key: 'purchaseDate', width: 16 },
  { header: 'Purchase Price', key: 'purchasePrice', width: 16 },
  { header: 'Purchase Currency', key: 'purchaseCurrency', width: 12 },
  { header: 'Current Value', key: 'currentValue', width: 16 },
  { header: 'Value Currency', key: 'valueCurrency', width: 12 },
  { header: 'Total Invested', key: 'totalInvested', width: 16 },
  { header: 'Return', key: 'return', width: 16 },
  { header: 'Return %', key: 'returnPct', width: 12 },
  { header: 'Annualized %', key: 'annualizedPct', width: 14 },
  { header: 'Location', key: 'location', width: 20 },
];

/**
 * Build an ExcelJS Workbook for the collector vault. Returns the workbook instance.
 */
export function buildCollectorVaultWorkbook(opts: CollectorExportOptions): any {
  const { items, returnMap, homeCurrency, Workbook } = opts;

  const wb = new Workbook();
  const ws = wb.addWorksheet('Vault');

  // -- Columns --
  ws.columns = COLLECTOR_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // -- Header styling --
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell: any) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = { vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];

  // -- Data rows --
  for (const item of items) {
    const col = item.collection;
    const returnData = returnMap.get(String(item.id));

    const holdingStatus = col?.holding_status ?? 'owned';
    const statusLabel = holdingStatus.charAt(0).toUpperCase() + holdingStatus.slice(1);

    // For sold items, use sold_price/sold_currency; otherwise use current_value
    const isSold = holdingStatus === 'sold';
    const displayValue = isSold ? (col?.sold_price ?? null) : (col?.current_value ?? null);
    const displayValueCurrency = isSold ? (col?.sold_currency ?? null) : (col?.current_currency ?? null);

    const row = ws.addRow({
      status: statusLabel,
      title: safeStr(item.title),
      type: getItemTypeLabel(item.item_type),
      cert: certLabel(item.cert_type),
      attribution: safeStr(getAttributionName(item)),
      school: safeStr(getAttributionSchool(item)),
      era: safeStr(item.era),
      province: safeStr(item.province),
      purchaseDate: col?.purchase_date ?? '',
      purchasePrice: col?.purchase_price ?? null,
      purchaseCurrency: safeStr(col?.purchase_currency),
      currentValue: displayValue,
      valueCurrency: safeStr(displayValueCurrency),
      totalInvested: returnData?.totalInvestedHome ?? null,
      return: returnData?.totalReturn ?? null,
      returnPct: returnData?.totalReturnPct != null ? returnData.totalReturnPct / 100 : null,
      annualizedPct: returnData?.annualizedReturnPct != null ? returnData.annualizedReturnPct / 100 : null,
      location: safeStr(col?.location),
    });

    // Number formats
    const priceFormat = '#,##0';
    const pctFormat = '0.0%';
    row.getCell('purchasePrice').numFmt = priceFormat;
    row.getCell('currentValue').numFmt = priceFormat;
    row.getCell('totalInvested').numFmt = priceFormat;
    row.getCell('return').numFmt = '#,##0';
    row.getCell('returnPct').numFmt = pctFormat;
    row.getCell('annualizedPct').numFmt = pctFormat;

    // Conditional return coloring
    if (returnData?.totalReturn != null) {
      const fill = returnData.totalReturn >= 0 ? POSITIVE_FILL : NEGATIVE_FILL;
      row.getCell('return').fill = fill;
      row.getCell('returnPct').fill = fill;
    }
  }

  // -- Portfolio Summary --
  const totals = computePortfolioTotals(returnMap);
  const gapRow = items.length + 2; // 1-indexed header + data rows + 1 blank

  ws.getCell(`A${gapRow + 1}`).value = 'Portfolio Summary';
  ws.getCell(`A${gapRow + 1}`).font = { bold: true, size: 12 };

  const summaryData: [string, number | string | null][] = [
    [`Total Declared Value (${homeCurrency})`, totals.totalValueHome],
    [`Total Invested (${homeCurrency})`, totals.totalInvestedHome],
    [`Total Return (${homeCurrency})`, totals.totalReturn],
    ['Return %', totals.totalReturnPct != null ? totals.totalReturnPct / 100 : null],
  ];

  if (totals.hasDecomposition) {
    summaryData.push(
      ['Asset Return', totals.totalAssetReturn],
      ['FX Impact', totals.totalFxImpact],
      ['Expenses', totals.totalExpenseDrag],
    );
  }

  if (totals.unrealized.itemCount > 0) {
    summaryData.push(
      ['', ''],
      ['Unrealized (Owned)', ''],
      ['  Value', totals.unrealized.totalValueHome],
      ['  Invested', totals.unrealized.totalInvestedHome],
      ['  Return', totals.unrealized.totalReturn],
    );
  }

  if (totals.realized.itemCount > 0) {
    summaryData.push(
      ['', ''],
      ['Realized (Sold)', ''],
      ['  Value', totals.realized.totalValueHome],
      ['  Invested', totals.realized.totalInvestedHome],
      ['  Return', totals.realized.totalReturn],
    );
  }

  let summaryRow = gapRow + 2;
  for (const [label, value] of summaryData) {
    const row = ws.getRow(summaryRow);
    row.getCell(1).value = label;
    row.getCell(1).font = SUMMARY_LABEL_FONT;
    if (label && !label.startsWith(' ')) {
      row.getCell(1).fill = SUMMARY_HEADER_FILL;
      row.getCell(2).fill = SUMMARY_HEADER_FILL;
    }
    if (typeof value === 'number') {
      const cell = row.getCell(2);
      cell.value = value;
      cell.numFmt = label === 'Return %' ? '0.0%' : '#,##0';
    } else if (value != null && value !== '') {
      row.getCell(2).value = value;
    }
    summaryRow++;
  }

  return wb;
}

/**
 * Build workbook + trigger browser download.
 */
export async function exportCollectorVault(opts: CollectorExportOptions): Promise<void> {
  const wb = buildCollectorVaultWorkbook(opts);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `NihontoWatch_Vault_${dateStamp()}.xlsx`);
}

// =============================================================================
// Dealer Inventory — Build Workbook
// =============================================================================

const DEALER_COLUMNS = [
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Title', key: 'title', width: 36 },
  { header: 'Type', key: 'type', width: 14 },
  { header: 'Certification', key: 'cert', width: 20 },
  { header: 'Attribution', key: 'attribution', width: 22 },
  { header: 'School', key: 'school', width: 18 },
  { header: 'Era', key: 'era', width: 16 },
  { header: 'Province', key: 'province', width: 16 },
  { header: 'Price', key: 'price', width: 16 },
  { header: 'Currency', key: 'currency', width: 10 },
  { header: 'Days Listed', key: 'daysListed', width: 12 },
  { header: 'Images', key: 'images', width: 10 },
  { header: 'Videos', key: 'videos', width: 10 },
  { header: 'Completeness %', key: 'completeness', width: 14 },
  { header: 'Featured Score', key: 'featuredScore', width: 14 },
];

/**
 * Build an ExcelJS Workbook for dealer inventory. Returns the workbook instance.
 */
export function buildDealerInventoryWorkbook(opts: DealerExportOptions): any {
  const { items, tabLabel, Workbook } = opts;

  const wb = new Workbook();
  const ws = wb.addWorksheet(tabLabel);

  // -- Columns --
  ws.columns = DEALER_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // -- Header styling --
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell: any) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = { vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];

  // -- Data rows --
  const now = Date.now();
  for (const item of items) {
    const imageCount = (item.stored_images?.length || 0) || (item.images?.length || 0);
    const completeness = computeInventoryCompleteness(item);

    // Days listed = days since first_seen_at
    let daysListed: number | null = null;
    if (item.first_seen_at) {
      const seen = new Date(item.first_seen_at).getTime();
      if (!isNaN(seen)) {
        daysListed = Math.round((now - seen) / (1000 * 60 * 60 * 24));
      }
    }

    const statusLabel = item.is_sold ? 'Sold' : item.is_available ? 'Available' : (item.status || 'Unknown');

    const row = ws.addRow({
      status: statusLabel,
      title: safeStr(item.title),
      type: getItemTypeLabel(item.item_type),
      cert: certLabel(item.cert_type),
      attribution: safeStr(getAttributionName(item)),
      school: safeStr(getAttributionSchool(item)),
      era: safeStr(item.era),
      province: safeStr(item.province),
      price: item.price_value ?? null,
      currency: safeStr(item.price_currency),
      daysListed,
      images: imageCount,
      videos: item.video_count ?? 0,
      completeness: completeness.score / 100,
      featuredScore: item.browse?.featured_score ?? null,
    });

    row.getCell('price').numFmt = '#,##0';
    row.getCell('completeness').numFmt = '0%';
    row.getCell('featuredScore').numFmt = '#,##0';
  }

  return wb;
}

/**
 * Build workbook + trigger browser download.
 */
export async function exportDealerInventory(opts: DealerExportOptions): Promise<void> {
  const wb = buildDealerInventoryWorkbook(opts);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const safeTab = opts.tabLabel.replace(/[^a-zA-Z0-9]/g, '_');
  downloadBlob(blob, `NihontoWatch_Inventory_${safeTab}_${dateStamp()}.xlsx`);
}
