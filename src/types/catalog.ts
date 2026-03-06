/** A single catalog record from the Yuhinkai search_catalog RPC, transformed for client use. */
export interface CatalogMatchItem {
  object_uuid: string;
  collection: string;
  volume: number;
  item_number: number;
  /** Candidate image URLs in priority order (oshigata first, setsumei fallback) */
  image_urls: string[];
  form_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;
  mei_status: string | null;
  period: string | null;
  artisan_kanji: string | null;
  item_type: string | null;
}

export interface CatalogMatchResponse {
  total: number;
  items: CatalogMatchItem[];
  volumes: Array<{ volume: number; count: number }>;
}
