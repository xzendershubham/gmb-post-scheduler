import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  if (!clientId) {
    console.error('Missing GOOGLE_CLIENT_ID environment variable');
    return res.status(500).json({ 
      error: 'Server configuration error: Missing Google Client ID.',
      details: 'Ensure GOOGLE_CLIENT_ID is set in Vercel settings.'
    });
  }

  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://gmb-post-scheduler.vercel.app';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/gmb-callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/business.manage',
      'email',
      'profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: userId as string,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

