import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase-client';

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('gmb_refresh_token')
    .eq('id', userId)
    .single();

  if (error || !profile?.gmb_refresh_token) {
    console.error(`GMB token not found for user ${userId}:`, error);
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials for token refresh');
    return null;
  }

  // Always refresh for simplicity and reliability in serverless
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: profile.gmb_refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    const newTokens = await tokenRes.json();
    return newTokens.access_token || null;
  } catch (err) {
    console.error('Token refresh fetch failed:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId, accountName } = req.query;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const accessToken = await getValidAccessToken(userId as string);
    if (!accessToken) {
      return res.status(401).json({ error: 'Not connected to GMB or token expired. Please reconnect.' });
    }

    // If accountName provided, fetch locations for that account
    if (accountName) {
      console.log(`Fetching locations for account: ${accountName}`);
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locData = await locRes.json().catch(() => ({ error: 'Invalid JSON response from Google' }));
      console.log(`Google locations response for ${accountName}:`, JSON.stringify(locData).substring(0, 500));
      return res.json({ locations: locData.locations || [], error: locData.error });
    }

    // Otherwise, fetch all GMB accounts
    console.log(`Fetching GMB accounts for user: ${userId}`);
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accountsData = await accountsRes.json().catch(() => ({}));
    console.log(`Google accounts response:`, JSON.stringify(accountsData));
    res.json({ accounts: accountsData.accounts || [] });
  } catch (err: any) {
    console.error('GMB locations error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

