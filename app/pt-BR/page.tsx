import type { Metadata } from "next";
import { localizedAlternates } from "../_shared/RootLayout";
import { Scanner } from "../_shared/Scanner";

export const metadata: Metadata = { alternates: localizedAlternates("pt-BR") };

export default function Page() {
  return <Scanner />;
}
