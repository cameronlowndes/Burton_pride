export type Sponsor = {
  id: string;

  sponsor_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;

  sponsorship_type?: string | null;
  sponsor_display_type?: string | null;
  is_main_sponsor?: boolean | null;

  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;

  logo_link?: string | null;
  website?: string | null;
  slug?: string | null;

  status?: string | null;
  created_at?: string | null;
  display_order?: number | null;
};