import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiUnauthorized, apiForbidden, apiServerError } from '@/lib/api/responses';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Quick timeout - we just trigger the workflow

/**
 * Trigger the Oshi-scrapper GitHub Actions workflow
 * Uses the workflow_dispatch event to start the daily-scrape.yml workflow
 */
async function triggerGitHubWorkflow(options: {
  dealer?: string;
  discoverOnly?: boolean;
  scrapeOnly?: boolean;
  extractOnly?: boolean;
  noExtract?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'christopherhill';
  const repo = process.env.GITHUB_REPO || 'Oshi-scrapper';

  if (!token) {
    return {
      success: false,
      error: 'GitHub token not configured. Add GITHUB_TOKEN to environment variables.'
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/daily-scrape.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            dealer: options.dealer || '',
            discover_only: options.discoverOnly ? 'true' : 'false',
            scrape_only: options.scrapeOnly ? 'true' : 'false',
            extract_only: options.extractOnly ? 'true' : 'false',
            no_extract: options.noExtract ? 'true' : 'false',
          },
        }),
      }
    );

    // GitHub returns 204 No Content on success
    if (response.status === 204) {
      return { success: true };
    }

    // Handle errors
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('GitHub API error', { status: response.status, body: errorBody });

      if (response.status === 401) {
        return { success: false, error: 'GitHub token is invalid or expired' };
      }
      if (response.status === 403) {
        return { success: false, error: 'GitHub token lacks workflow permissions' };
      }
      if (response.status === 404) {
        return { success: false, error: 'Workflow not found. Check GITHUB_OWNER and GITHUB_REPO settings.' };
      }

      return { success: false, error: `GitHub API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    logger.logError('GitHub workflow trigger error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger workflow'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const body = await request.json();
    const {
      dealer,
      discoverOnly = false,
      scrapeOnly = false,
      extractOnly = false,
      noExtract = false,
    } = body;

    // Trigger the GitHub Actions workflow
    const workflowResult = await triggerGitHubWorkflow({
      dealer,
      discoverOnly,
      scrapeOnly,
      extractOnly,
      noExtract,
    });

    if (!workflowResult.success) {
      // If GitHub trigger fails, still try to create a pending record for visibility
      const serviceClient = createServiceClient();

      try {
        let dealerId: number | null = null;
        if (dealer) {
          const { data: dealerData } = await serviceClient
            .from('dealers')
            .select('id')
            .eq('name', dealer)
            .single() as { data: { id: number } | null };
          dealerId = dealerData?.id || null;
        }

        // Type assertion needed as scrape_runs table may not be in generated types
        await (serviceClient
          .from('scrape_runs') as ReturnType<typeof serviceClient.from>)
          .insert({
            dealer_id: dealerId,
            run_type: 'scrape',
            status: 'failed',
            error_message: workflowResult.error,
            urls_processed: 0,
            errors: 0,
          } as Record<string, unknown>);
      } catch {
        // Table might not exist, ignore
      }

      return NextResponse.json({
        success: false,
        error: workflowResult.error,
        message: 'Failed to trigger scraper workflow',
      }, { status: 500 });
    }

    // NOTE: We do NOT create a scrape_run record here.
    // The Oshi-scrapper Python script creates its own run when it starts.
    // Creating one here caused duplicate/orphaned "running" records.
    const runId = null;

    const targetDesc = dealer ? `dealer "${dealer}"` : 'all dealers';
    const modeDesc = discoverOnly ? 'discovery only'
      : scrapeOnly ? 'scrape only'
      : extractOnly ? 'extraction only'
      : noExtract ? 'full (no extraction)'
      : 'full run';

    return NextResponse.json({
      success: true,
      runId,
      message: `Scrape workflow triggered for ${targetDesc} (${modeDesc})`,
      workflowUrl: `https://github.com/${process.env.GITHUB_OWNER || 'christopherhill'}/${process.env.GITHUB_REPO || 'Oshi-scrapper'}/actions`,
    });
  } catch (error) {
    logger.logError('Trigger scrape error', error);
    return apiServerError();
  }
}
