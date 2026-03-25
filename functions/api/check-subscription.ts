import Stripe from 'stripe';
import { Redis } from '@upstash/redis/cloudflare';

// Env型をファイル内で直接定義（env.d.tsに依存しない形）
interface Env {
  STRIPE_SECRET_KEY: string;
  VITE_STRIPE_PRICE_ID: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

// PagesFunctionの代わりに引数の型を明示的に定義
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const stripeKey = env.STRIPE_SECRET_KEY;
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

  if (!stripeKey || !redisUrl || !redisToken) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2026-02-25.clover', // SDKが要求するバージョンに変更
    httpClient: Stripe.createFetchHttpClient(),
  });

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  try {
    const body = await request.json() as { email?: string, forceRefresh?: boolean };
    const { email, forceRefresh } = body;

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cacheKey = `sub_status_${email}`;

    if (!forceRefresh) {
      const cachedStatus = await redis.get<string>(cacheKey);
      if (cachedStatus !== null) {
        return new Response(JSON.stringify({ isSubscribed: cachedStatus === 'active', fromCache: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const customers = await stripe.customers.list({
      email: email,
      expand: ['data.subscriptions'],
    });

    let isSubscribed = false;

    for (const customer of customers.data) {
      const subscriptions = customer.subscriptions?.data || [];
      if (subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing')) {
        isSubscribed = true;
        break;
      }
    }

    await redis.set(cacheKey, isSubscribed ? 'active' : 'inactive', { ex: 21600 });

    return new Response(JSON.stringify({ isSubscribed, fromCache: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Subscription check error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};