/**
 * Expand an artisan code to include school member codes.
 * NS-* codes → [code, ...memberCodes]. Others → [code].
 * Silently falls back to [code] on error.
 */
export async function expandArtisanCodes(code: string): Promise<string[]> {
  if (!code.startsWith('NS-')) return [code];
  try {
    const { getArtisan, getSchoolMemberCodes } = await import('@/lib/supabase/yuhinkai');
    const entity = await getArtisan(code);
    if (!entity?.is_school_code || !entity?.school) return [code];
    const memberCodesMap = await getSchoolMemberCodes([{
      code,
      school: entity.school,
      entity_type: entity.entity_type,
    }]);
    const memberCodes = memberCodesMap.get(code) || [];
    return memberCodes.length > 0 ? [code, ...memberCodes] : [code];
  } catch {
    return [code];
  }
}
