import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

function initAdmin() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing');
  const serviceAccount = JSON.parse(key);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const app = initAdmin();
  const firestoreDbId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-4a3cb05f-57e2-4431-a235-8dc14579b508';
  const db = app.firestore(firestoreDbId);
  const userDoc = await db.collection('users').doc(userId).get();
  const gmb = userDoc.data()?.gmb;

  if (!gmb?.refreshToken) return null;

  // If token is still valid (with 60s buffer), use it
  if (gmb.tokenExpiry && Date.now() < gmb.tokenExpiry - 60000) {
    return gmb.accessToken;
  }

  // Refresh the token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: gmb.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });

  const newTokens = await tokenRes.json();
  if (!newTokens.access_token) return null;

  // Update stored token
  await db.collection('users').doc(userId).update({
    'gmb.accessToken': newTokens.access_token,
    'gmb.tokenExpiry': Date.now() + (newTokens.expires_in || 3600) * 1000,
  });

  return newTokens.access_token;
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
