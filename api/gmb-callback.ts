import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://gmb-post-scheduler.vercel.app';
  const { code, state: userId, error } = req.query;

  if (error) {
    return res.redirect(`${appUrl}?gmb_error=access_denied`);
  }

  if (!code || !userId) {
    return res.redirect(`${appUrl}?gmb_error=missing_params`);
  }

  try {
    // Step 1: Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/gmb-callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return res.redirect(`${appUrl}?gmb_error=token_failed`);
    }

    // Step 2: Store refresh token in Supabase Profile
    if (tokens.refresh_token) {
       const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          gmb_refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId as string);

      if (dbError) throw dbError;
    }

    // Redirect back to app with success signal
    res.redirect(`${appUrl}?gmb_connected=true`);
  } catch (err: any) {
    console.error('GMB callback fatal error:', err);
    res.redirect(`${appUrl}?gmb_error=server_error&details=${encodeURIComponent(err.message || 'unknown')}`);
  }
}
