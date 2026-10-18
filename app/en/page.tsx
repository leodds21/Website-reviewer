import type { Metadata } from "next";
import { localizedAlternates } from "../_shared/RootLayout";
import { HomeJsonLd } from "../_shared/HomeJsonLd";
import { Scanner } from "../_shared/Scanner";

export const metadata: Metadata = { alternates: localizedAlternates("en") };

export default function Page() {
  return (
    <>
      <HomeJsonLd locale="en" />
      <Scanner />
    </>
  );
}
