import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, OPERATOR, ORGANIZATION_NAME, ORGANIZATION_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const organizationId = `${SITE_URL}/#organization`;

export function StructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/brand/logo-mark.png"),
          width: 256,
          height: 256,
        },
        email: OPERATOR.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: OPERATOR.address,
          addressCountry: "JP",
        },
        parentOrganization: {
          "@type": "Organization",
          name: OPERATOR.name,
          alternateName: ORGANIZATION_NAME,
          url: ORGANIZATION_URL,
        },
      }}
    />
  );
}
