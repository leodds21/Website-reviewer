import { connection } from "next/server";
import { RootLayout, rootMetadata } from "../_shared/RootLayout";
import { EnLanguage } from "../i18n/EnLanguage";

export const metadata = rootMetadata("en");

export default async function Layout({ children }: LayoutProps<"/en">) {
  // The nonce CSP needs every page rendered per request.
  await connection();
  return (
    <RootLayout locale="en">
      <EnLanguage>{children}</EnLanguage>
    </RootLayout>
  );
}
