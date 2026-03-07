import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!stripeKey || !redisUrl || !redisToken) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server configuration error.' }) 
    };
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16' as any,
  });

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  try {
    const { email, forceRefresh } = JSON.parse(event.body || '{}');
    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Valid email is required' }) };
    }

    const cacheKey = `sub_status_${email}`;

    // 強制更新でない場合はキャッシュを確認
    if (!forceRefresh) {
      const cachedStatus = await redis.get<string>(cacheKey);
      if (cachedStatus !== null) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isSubscribed: cachedStatus === 'active', fromCache: true }),
        };
      }
    }

    // Stripeから該当メールアドレスの全顧客を取得
    const customers = await stripe.customers.list({
      email: email,
      expand: ['data.subscriptions'],
    });

    let isSubscribed = false;

    // 取得したすべての顧客オブジェクトをチェック
    for (const customer of customers.data) {
      const subscriptions = customer.subscriptions?.data || [];
      if (subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing')) {
        isSubscribed = true;
        break;
      }
    }

    // 最新状態をキャッシュに保存（TTL: 6時間）
    await redis.set(cacheKey, isSubscribed ? 'active' : 'inactive', { ex: 21600 });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSubscribed, fromCache: false }),
    };
  } catch (error: any) {
    console.error('Subscription check error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};