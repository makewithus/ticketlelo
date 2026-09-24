import page from "@/ui/generated/terms";
import WebflowPage, { pageMetadata } from "@/ui/WebflowPage";

export const metadata = pageMetadata(page);

export default function TermsPage() {
  return <WebflowPage page={page} />;
}
