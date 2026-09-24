import page from "@/ui/generated/privacy";
import WebflowPage, { pageMetadata } from "@/ui/WebflowPage";

export const metadata = pageMetadata(page);

export default function PrivacyPage() {
  return <WebflowPage page={page} />;
}
