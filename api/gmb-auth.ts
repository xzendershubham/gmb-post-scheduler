import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query;

  if (!userId || !process.env.GOOGLE_CLIENT_ID) {
    return res.status(400).json({ error: 'Missing userId or GOOGLE_CLIENT_ID env var' });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gmb-post-scheduler.vercel.app';

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
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
