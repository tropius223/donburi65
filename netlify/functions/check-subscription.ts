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

  // 初期化前のバリデーション
  if (!stripeKey || !redisUrl || !redisToken) {
    console.error('Missing Environment Variables for Subscription Check');
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server configuration error.' }) 
    };
  }

  // ハンドラー内で各クライアントを初期化
  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16' as any,
  });

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    const cacheKey = `sub_status_${email}`;
    const cachedStatus = await redis.get<string>(cacheKey);
    
    if (cachedStatus !== null) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSubscribed: cachedStatus === 'active', fromCache: true }),
      };
    }

    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
      expand: ['data.subscriptions'],
    });

    let isSubscribed = false;
    if (customers.data.length > 0) {
      const customer = customers.data[0];
      const subscriptions = customer.subscriptions?.data || [];
      isSubscribed = subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing');
    }

    await redis.set(cacheKey, isSubscribed ? 'active' : 'inactive', { ex: 21600 });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSubscribed, fromCache: false }),
    };
  } catch (error: any) {
    console.error('Subscription Check Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};