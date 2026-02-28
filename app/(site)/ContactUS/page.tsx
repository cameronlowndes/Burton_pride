import MetaHead from '../components/MetaHead';
import ContactContent from '../components/Client/ContactContent'; 

export const metadata = {
  title: 'Burton Pride - Contact Us',
  description: 'Learn more about Burton Pride, our mission, and how to get in touch.',
};

export default function ContactPage() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Contact Us"
        description="Have any questions or want to get in touch with Burton Pride? Reach out to us through our contact form or email."
        keywords="Burton Pride, contact us, LGBTQ+ community, Pride organization, email us, inquiry"
      />
      <ContactContent />
    </>
  );
}
