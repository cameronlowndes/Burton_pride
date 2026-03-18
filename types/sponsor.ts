export type Sponsor = {
  id: string;
  sponsor_name: string;
  sponsorship_type: string | null;
  logo_link: string | null;
  story: string | null;
  slug: string | null;
  website?: string | null;
  status?: string | null;
};