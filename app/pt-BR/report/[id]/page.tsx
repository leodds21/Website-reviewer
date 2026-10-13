import { ReportPage, reportMetadata } from "../../../_shared/reportPage";

export function generateMetadata({ params }: PageProps<"/pt-BR/report/[id]">) {
  return reportMetadata("pt-BR", params);
}

export default function Page({ params }: PageProps<"/pt-BR/report/[id]">) {
  return <ReportPage locale="pt-BR" params={params} />;
}
