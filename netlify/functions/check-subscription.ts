import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

// Stripeの初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

// Upstash Redisの初期化
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL as string,
  token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // キャッシュキーの作成
    const cacheKey = `sub_status_${email}`;

    // 1. Upstash Redisからキャッシュを確認
    const cachedStatus = await redis.get<string>(cacheKey);
    if (cachedStatus !== null) {
      console.log('Cache hit for:', email);
      return {
        statusCode: 200,
        body: JSON.stringify({ isSubscribed: cachedStatus === 'active', fromCache: true }),
      };
    }

    console.log('Cache miss, querying Stripe for:', email);

    // 2. キャッシュがない場合のみStripeへ問い合わせ
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
      expand: ['data.subscriptions'],
    });

    let isSubscribed = false;

    if (customers.data.length > 0) {
      const customer = customers.data[0];
      const subscriptions = customer.subscriptions?.data || [];
      // アクティブなサブスクリプションがあるか確認
      isSubscribed = subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing');
    }

    // 3. 取得した結果をRedisにキャッシュとして保存（TTL: 6時間 = 21600秒）
    await redis.set(cacheKey, isSubscribed ? 'active' : 'inactive', { ex: 21600 });

    return {
      statusCode: 200,
      body: JSON.stringify({ isSubscribed, fromCache: false }),
    };
  } catch (error: any) {
    console.error('Subscription check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};