import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { getArtisan, getAiDescription } from '@/lib/supabase/yuhinkai';
import {
  assembleCuratorContextFromFormData,
  shouldSkipGeneration,
  getDataRichness,
} from '@/lib/listing/curatorNote';
import type { GenerateDescriptionFormData } from '@/lib/listing/curatorNote';
import { generateCuratorNote } from '@/lib/listing/generateCuratorNote';
import { buildArtistPageData } from '@/lib/artisan/getArtistPageData';
import { distillArtistOverview } from '@/lib/listing/distillArtistOverview';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Not authenticated' : 'Not a dealer' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const body = await req.json();

  // Validate cert type — only Juyo / Tokubetsu Juyo
  const certType = body.cert_type;
  if (certType !== 'Juyo' && certType !== 'Tokubetsu Juyo') {
    return NextResponse.json(
      { error: 'Scholar\'s notes are only available for Juyo and Tokubetsu Juyo items' },
      { status: 400 }
    );
  }

  // Build form data from request body
  const formData: GenerateDescriptionFormData = {
    item_type: body.item_type ?? null,
    nagasa_cm: body.nagasa_cm != null ? Number(body.nagasa_cm) : null,
    sori_cm: body.sori_cm != null ? Number(body.sori_cm) : null,
    motohaba_cm: body.motohaba_cm != null ? Number(body.motohaba_cm) : null,
    sakihaba_cm: body.sakihaba_cm != null ? Number(body.sakihaba_cm) : null,
    kasane_cm: body.kasane_cm != null ? Number(body.kasane_cm) : null,
    mei_type: body.mei_type ?? null,
    mei_text: body.mei_text ?? null,
    era: body.era ?? null,
    province: body.province ?? null,
    school: body.school ?? null,
    cert_type: certType,
    cert_session: body.cert_session != null ? Number(body.cert_session) : null,
    setsumei_text_en: body.setsumei_text_en ?? null,
    setsumei_text_ja: body.setsumei_text_ja ?? null,
    sayagaki: body.sayagaki ?? null,
    hakogaki: body.hakogaki ?? null,
    provenance: body.provenance ?? null,
    kiwame: body.kiwame ?? null,
    koshirae: body.koshirae ?? null,
    research_notes: body.research_notes ?? null,
  };

  // Fetch artisan data if provided
  const artisanId: string | null = body.artisan_id ?? null;
  let artisanEntity = null;
  let aiDescription = null;
  if (artisanId) {
    [artisanEntity, aiDescription] = await Promise.all([
      getArtisan(artisanId),
      getAiDescription(artisanId),
    ]);
  }

  // Distill artist overview for richer context (non-fatal)
  let artistOverview = null;
  if (artisanId) {
    try {
      const pageData = await buildArtistPageData(artisanId);
      if (pageData) artistOverview = distillArtistOverview(pageData);
    } catch {
      // Non-fatal — artist overview is supplementary
    }
  }

  // Assemble context
  const context = assembleCuratorContextFromFormData(formData, artisanEntity, aiDescription, artistOverview);

  // Check if we have enough data
  if (shouldSkipGeneration(context)) {
    return NextResponse.json(
      { error: 'Not enough data — select an artisan or add setsumei text first' },
      { status: 400 }
    );
  }

  // Generate EN description
  const description = await generateCuratorNote(context, 'en');

  if (!description) {
    return NextResponse.json(
      { error: 'Generation failed — please try again' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    description,
    data_richness: getDataRichness(context),
  });
}
