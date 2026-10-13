"use client";

import { ErrorScreen } from "../_shared/ErrorScreen";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen retry={retry} />;
}
