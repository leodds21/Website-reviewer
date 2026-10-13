import { connection } from "next/server";
import { RootLayout, rootMetadata } from "../_shared/RootLayout";
import { PtBrLanguage } from "../i18n/PtBrLanguage";

export const metadata = rootMetadata("pt-BR");

export default async function Layout({ children }: LayoutProps<"/pt-BR">) {
  // The nonce CSP needs every page rendered per request.
  await connection();
  return (
    <RootLayout locale="pt-BR">
      <PtBrLanguage>{children}</PtBrLanguage>
    </RootLayout>
  );
}
