/**
 * Maps Yuhinkai catalog search results → CollectionItem fields.
 *
 * gold_values stores measurements in mm (×10), so we divide by 10 for cm.
 * Collection names map to cert_type display labels.
 */

import type { CatalogSearchResult, CreateCollectionItemInput, CatalogReference } from '@/types/collection';

/** Map Yuhinkai collection name → cert_type display label */
const COLLECTION_TO_CERT: Record<string, string> = {
  'Tokuju': 'Tokuju',
  'Juyo': 'Juyo',
  'Kokuho': 'Kokuho',
  'JuBun': 'Juyo Bunkazai',
  'Jubi': 'Juyo Bijutsuhin',
};

/** Map gold_form_type → normalized item_type */
const FORM_TO_ITEM_TYPE: Record<string, string> = {
  'katana': 'katana',
  'wakizashi': 'wakizashi',
  'tanto': 'tanto',
  'tachi': 'tachi',
  'naginata': 'naginata',
  'yari': 'yari',
  'ken': 'ken',
  'kodachi': 'kodachi',
  'tsuba': 'tsuba',
  'kozuka': 'kozuka',
  'kogai': 'kogai',
  'menuki': 'menuki',
  'fuchi-kashira': 'fuchi-kashira',
  'mitokoromono': 'mitokoromono',
  'futatokoromono': 'futatokoro',
  'soroimono': 'tosogu',
};

/**
 * Convert a catalog search result into pre-filled collection item fields.
 */
export function mapCatalogToCollectionItem(
  result: CatalogSearchResult
): Partial<CreateCollectionItemInput> {
  const formType = result.form_type?.toLowerCase().trim() || null;

  const catalogRef: CatalogReference = {
    collection: result.collection,
    volume: result.volume,
    item_number: result.item_number,
    object_uuid: result.object_uuid,
  };

  return {
    artisan_id: result.smith_id || undefined,
    artisan_display_name: result.smith_name || undefined,
    smith: result.smith_name || undefined,
    school: result.smith_school || undefined,
    province: result.province || undefined,
    era: result.era || undefined,
    item_type: formType ? (FORM_TO_ITEM_TYPE[formType] || formType) : undefined,
    cert_type: COLLECTION_TO_CERT[result.collection] || result.collection,
    cert_session: result.volume,
    cert_organization: 'NBTHK',
    nagasa_cm: result.nagasa || undefined,
    sori_cm: result.sori || undefined,
    motohaba_cm: result.motohaba || undefined,
    sakihaba_cm: result.sakihaba || undefined,
    mei_type: result.mei_status || undefined,
    catalog_reference: catalogRef,
  };
}
