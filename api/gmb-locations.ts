import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase-client';

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('gmb_refresh_token')
    .eq('id', userId)
    .single();

  if (error || !profile?.gmb_refresh_token) return null;

  // Always refresh for simplicity and reliability in serverless
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: profile.gmb_refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });

  const newTokens = await tokenRes.json();
  return newTokens.access_token || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId, accountName } = req.query;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const accessToken = await getValidAccessToken(userId as string);
    if (!accessToken) {
      return res.status(401).json({ error: 'Not connected to GMB. Please reconnect.' });
    }

    // If accountName provided, fetch locations for that account
    if (accountName) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,websiteUri`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locData = await locRes.json();
      return res.json({ locations: locData.locations || [], error: locData.error });
    }

    // Otherwise, fetch all GMB accounts
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accountsData = await accountsRes.json();
    res.json({ accounts: accountsData.accounts || [] });
  } catch (err: any) {
    console.error('GMB locations error:', err);
    res.status(500).json({ error: err.message });
  }
}
