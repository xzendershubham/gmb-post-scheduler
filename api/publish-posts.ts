import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase-client';

// ─── Token Refresh ──────────────────────────────────────────────────────────
async function getValidAccessToken(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('gmb_refresh_token')
    .eq('id', userId)
    .single();

  if (error || !profile?.gmb_refresh_token) throw new Error(`No GMB token for user ${userId}`);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: profile.gmb_refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) throw new Error('Token refresh failed');

  return tokens.access_token as string;
}

// ─── Publish One Post to GMB ────────────────────────────────────────────────
async function publishToGMB(post: any, accessToken: string, locationId: string) {
  const payload: Record<string, any> = {
    languageCode: 'en-US',
    summary: post.summary,
    topicType: post.post_type || 'STANDARD',
  };

  if (post.cta_type && post.cta_type !== 'CALL' && post.cta_url) {
    payload.callToAction = { actionType: post.cta_type, url: post.cta_url };
  }

  if (post.image_url) {
    if (post.image_url.startsWith('data:')) {
      throw new Error('Image format invalid (base64 not supported).');
    }
    payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.image_url }];
  }

  if (post.post_type === 'EVENT' || post.post_type === 'OFFER') {
    const startDate = new Date(post.start_time || post.scheduled_at);
    const endDate = new Date(post.end_time || post.scheduled_at);
    const toDateObj = (d: Date) => ({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
    payload.event = {
      title: post.event_title || (post.post_type === 'OFFER' ? 'Offer' : 'Event'),
      schedule: { startDate: toDateObj(startDate), endDate: toDateObj(endDate) },
    };
    if (post.post_type === 'OFFER') {
      payload.offer = {
        couponCode: post.offer_coupon || undefined,
        redeemOnlineUrl: post.offer_url || undefined,
        termsConditions: post.offer_terms || undefined,
      };
    }
  }

  const response = await fetch(
    `https://mybusiness.googleapis.com/v1/${locationId}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errBody = await response.json();
    throw new Error(JSON.stringify(errBody?.error || errBody));
  }

  return response.json();
}

// ─── Main Handler ────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const secret = req.headers['x-cron-secret'] || req.query.secret || bearerToken;
  const manualUserId = req.query.userId as string;

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date().toISOString();
    const results = { published: 0, failed: 0, skipped: 0, errors: [] as string[] };

    let query = supabaseAdmin
      .from('posts')
      .select('*')
      .eq('status', 'SCHEDULED')
      .lte('scheduled_at', now);
    
    if (manualUserId) {
      query = query.eq('user_id', manualUserId);
    }

    const { data: duePosts, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    console.log(`Found ${duePosts?.length || 0} due posts to publish at ${now}`);

    for (const post of (duePosts || [])) {
      try {
        if (!post.account_id) {
          await supabaseAdmin.from('posts').update({ status: 'FAILED', publish_error: 'No account linked' }).eq('id', post.id);
          results.skipped++;
          continue;
        }

        const { data: account } = await supabaseAdmin
          .from('accounts')
          .select('location_id')
          .eq('id', post.account_id)
          .single();

        if (!account?.location_id) {
          await supabaseAdmin.from('posts').update({ status: 'FAILED', publish_error: 'Account has no GMB location linked' }).eq('id', post.id);
          results.skipped++;
          continue;
        }

        const accessToken = await getValidAccessToken(post.user_id);
        const gmbResult = await publishToGMB(post, accessToken, account.location_id);

        await supabaseAdmin.from('posts').update({
          status: 'PUBLISHED',
          updated_at: new Date().toISOString(),
          gmb_post_name: gmbResult.name || null,
          publish_error: null,
        }).eq('id', post.id);

        results.published++;
      } catch (err: any) {
        const errMsg = err.message || String(err);
        await supabaseAdmin.from('posts').update({
          status: 'FAILED',
          publish_error: errMsg.substring(0, 500),
        }).eq('id', post.id);
        results.failed++;
        results.errors.push(`Post ${post.id}: ${errMsg}`);
      }
    }

    res.json({ ok: true, timestamp: now, ...results });
  } catch (err: any) {
    console.error('publish-posts fatal error:', err);
    res.status(500).json({ error: err.message });
  }
}
