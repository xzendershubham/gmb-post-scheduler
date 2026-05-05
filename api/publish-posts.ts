import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ─── Firebase Admin Init ────────────────────────────────────────────────────
function initAdmin() {
  if (admin.apps.length > 0) return admin.app();
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY env var not set');
  try {
    const serviceAccount = JSON.parse(key);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
    throw err;
  }
}

// ─── Token Refresh ──────────────────────────────────────────────────────────
async function getValidAccessToken(db: admin.firestore.Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  const gmb = userDoc.data()?.gmb;
  if (!gmb?.refreshToken) throw new Error(`No GMB token for user ${userId}`);

  // Token still valid?
  if (gmb.tokenExpiry && Date.now() < gmb.tokenExpiry - 60000) {
    return gmb.accessToken as string;
  }

  // Refresh it
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: gmb.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) throw new Error('Token refresh failed');

  await db.collection('users').doc(userId).update({
    'gmb.accessToken': tokens.access_token,
    'gmb.tokenExpiry': Date.now() + (tokens.expires_in || 3600) * 1000,
  });
  return tokens.access_token as string;
}

// ─── Publish One Post to GMB ────────────────────────────────────────────────
async function publishToGMB(post: any, accessToken: string, locationId: string) {
  const payload: Record<string, any> = {
    languageCode: 'en-US',
    summary: post.summary,
    topicType: post.postType || 'STANDARD',
  };

  // CTA
  if (post.ctaType && post.ctaType !== 'CALL' && post.ctaUrl) {
    payload.callToAction = { actionType: post.ctaType, url: post.ctaUrl };
  }

  // Image (only external URLs, not base64 — GMB API doesn't accept base64)
  if (post.imageUrl && post.imageUrl.startsWith('http')) {
    payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.imageUrl }];
  }

  // Event / Offer
  if (post.postType === 'EVENT' || post.postType === 'OFFER') {
    const startDate = new Date(post.startTime || post.scheduledAt);
    const endDate = new Date(post.endTime || post.scheduledAt);
    const toDateObj = (d: Date) => ({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
    payload.event = {
      title: post.eventTitle || (post.postType === 'OFFER' ? 'Offer' : 'Event'),
      schedule: { startDate: toDateObj(startDate), endDate: toDateObj(endDate) },
    };
    if (post.postType === 'OFFER') {
      payload.offer = {
        couponCode: post.offerCoupon || undefined,
        redeemOnlineUrl: post.offerUrl || undefined,
        termsConditions: post.offerTerms || undefined,
      };
    }
  }

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
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
  // Security — only cron-job.org (with secret header) or manual trigger (with query secret) can call this
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const manualUserId = req.query.userId as string;

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const app = initAdmin();
    const firestoreDbId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-4a3cb05f-57e2-4431-a235-8dc14579b508';
    const db = getFirestore(app, firestoreDbId);
    const now = new Date().toISOString();

    const results = { published: 0, failed: 0, skipped: 0, errors: [] as string[] };

    // Query all SCHEDULED posts that are due (scheduledAt <= now)
    let queryRef = db.collection('posts').where('status', '==', 'SCHEDULED');
    
    // If triggered manually for a specific user, filter accordingly
    if (manualUserId) {
      queryRef = queryRef.where('userId', '==', manualUserId);
    }

    const snapshot = await queryRef.get();

    const duePosts = snapshot.docs.filter((doc) => {
      const data = doc.data();
      const isDue = data.scheduledAt && data.scheduledAt <= now;
      if (!isDue) {
        console.log(`Post ${doc.id} skipped: Scheduled for ${data.scheduledAt}, current time is ${now}`);
      }
      return isDue;
    });

    console.log(`Found ${duePosts.length} due posts to publish at ${now}`);

    for (const docSnap of duePosts) {
      const post = { id: docSnap.id, ...docSnap.data() };
      const postRef = db.collection('posts').doc(post.id);

      try {
        // Skip posts without an account or locationId
        if (!post.accountId) {
          await postRef.update({ status: 'FAILED', publishError: 'No account linked to this post' });
          results.skipped++;
          continue;
        }

        // Get the account's locationId from Firestore
        const accountDoc = await db.collection('accounts').doc(post.accountId).get();
        const account = accountDoc.data();

        if (!account?.locationId) {
          await postRef.update({ status: 'FAILED', publishError: 'Account has no GMB location linked. Please reconnect in Accounts tab.' });
          results.skipped++;
          continue;
        }

        // Get a valid access token for this user
        const accessToken = await getValidAccessToken(db, post.userId);

        // Publish to GMB
        const gmbResult = await publishToGMB(post, accessToken, account.locationId);

        // Mark as published
        await postRef.update({
          status: 'PUBLISHED',
          publishedAt: FieldValue.serverTimestamp(),
          gmbPostName: gmbResult.name || null,
          publishError: null,
        });

        results.published++;
        console.log(`✅ Published post ${post.id} to ${account.locationId}`);
      } catch (err: any) {
        const errMsg = err.message || String(err);
        console.error(`❌ Failed to publish post ${post.id}:`, errMsg);
        await postRef.update({
          status: 'FAILED',
          publishError: errMsg.substring(0, 500), // Firestore string limit
        });
        results.failed++;
        results.errors.push(`Post ${post.id}: ${errMsg.substring(0, 100)}`);
      }
    }

    res.json({
      ok: true,
      timestamp: now,
      ...results,
    });
  } catch (err: any) {
    console.error('publish-posts fatal error:', err);
    res.status(500).json({ error: err.message });
  }
}
