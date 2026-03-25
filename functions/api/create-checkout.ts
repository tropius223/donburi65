import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  VITE_STRIPE_PRICE_ID: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const secretKey = env.STRIPE_SECRET_KEY;
  const priceId = env.VITE_STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    console.error('Missing Environment Variables: STRIPE_SECRET_KEY or VITE_STRIPE_PRICE_ID');
    return new Response(JSON.stringify({ error: 'Server configuration error: Missing API keys.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const body = await request.json() as { email?: string };
    const email = body.email;
    
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancel`,
    };

    if (email && typeof email === 'string' && email.includes('@')) {
      sessionOptions.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Stripe Session Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};