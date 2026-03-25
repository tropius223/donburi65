import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  VITE_STRIPE_PRICE_ID: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const stripeKey = env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2026-02-25.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const body = await request.json() as { email?: string };
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const customerId = customers.data[0].id;
    
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Portal Session Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};