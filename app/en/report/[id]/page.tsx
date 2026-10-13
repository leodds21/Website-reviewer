import { ReportPage, reportMetadata } from "../../../_shared/reportPage";

export function generateMetadata({ params }: PageProps<"/en/report/[id]">) {
  return reportMetadata("en", params);
}

export default function Page({ params }: PageProps<"/en/report/[id]">) {
  return <ReportPage locale="en" params={params} />;
}
