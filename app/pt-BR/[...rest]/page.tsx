import { notFound } from "next/navigation";

// Unknown addresses inside a locale get that locale's not-found page.
export default function UnknownPage() {
  notFound();
}
