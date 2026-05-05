import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length > 0) return;
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error('Firebase admin init failed:', e);
  }
}

function getDb() {
  initAdmin();
  const firestoreDbId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-4a3cb05f-57e2-4431-a235-8dc14579b508';
  try {
    return admin.firestore(firestoreDbId);
  } catch (e) {
    console.error('Failed to init named firestore, falling back to default:', e);
    return admin.firestore();
  }
}

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

    // Step 2: Fetch GMB accounts (account management API)
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const accountsData = await accountsRes.json();
    const gmbAccounts = accountsData.accounts || [];

    // Step 3: Store tokens + accounts in Firestore
    const db = getDb();

    await db.collection('users').doc(userId as string).set(
      {
        gmb: {
          refreshToken: tokens.refresh_token || null,
          accessToken: tokens.access_token,
          tokenExpiry: Date.now() + (tokens.expires_in || 3600) * 1000,
          accounts: gmbAccounts,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          email: null, // will be set from ID token if needed
        },
      },
      { merge: true }
    );

    // Redirect back to app with success signal
    res.redirect(`${appUrl}?gmb_connected=true&accounts=${gmbAccounts.length}`);
  } catch (err: any) {
    console.error('GMB callback fatal error:', err);
    const errorType = err.message?.includes('database') ? 'db_error' : 'server_error';
    res.redirect(`${appUrl}?gmb_error=${errorType}&details=${encodeURIComponent(err.message || 'unknown')}`);
  }
}
