import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://gmb-post-scheduler.vercel.app';
  const { code, state: userId, error } = req.query;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (error) {
    return res.redirect(`${appUrl}?gmb_error=access_denied`);
  }

  if (!code || !userId) {
    return res.redirect(`${appUrl}?gmb_error=missing_params`);
  }

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error: Missing Google OAuth credentials.',
      details: 'Check Vercel environment variables.'
    });
  }

  try {
    // Step 1: Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/gmb-callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return res.redirect(`${appUrl}?gmb_error=token_failed&details=${encodeURIComponent(JSON.stringify(tokens))}`);
    }

    // Step 2: Fetch User Info (Email)
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    if (!userRes.ok) {
       console.warn('Failed to fetch user info from Google');
    }
    
    const userData = await userRes.json().catch(() => ({}));
    const gmbEmail = userData.email;

    // Step 3: Store refresh token and email in Supabase Profile
    const updateData: any = { 
      updated_at: new Date().toISOString() 
    };
    
    if (tokens.refresh_token) {
      updateData.gmb_refresh_token = tokens.refresh_token;
    }
    
    if (gmbEmail) {
      updateData.email = gmbEmail;
    }

    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId as string);

    if (dbError) {
      console.error('Database update error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Redirect back to app with success signal
    res.redirect(`${appUrl}?gmb_connected=true`);
  } catch (err: any) {
    console.error('GMB callback fatal error:', err);
    // If we've already started sending a response, don't try to redirect
    if (res.writableEnded) return;
    
    res.status(500).json({ 
      error: 'GMB callback failed', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

