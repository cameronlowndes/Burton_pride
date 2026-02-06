import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      businessName,
      contactName,
      email,
      phone,
      address,
      website,
      imageUrl,
    } = body;

    // basic validation
    if (!businessName || !contactName || !email || !phone || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('competition_entries')
      .insert([
        {
          business_name: businessName,
          contact_name: contactName,
          email,
          phone,
          address,
          website: website || null,
          image_url: imageUrl || null,
          payment_status: 'pending',
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entryId: data.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
