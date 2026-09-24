import page from "@/ui/generated/index";
import WebflowPage, { pageMetadata } from "@/ui/WebflowPage";
import LandingEvents from "@/ui/LandingEvents";

export const metadata = pageMetadata(page);

export default function LandingPage() {
  return (
    <WebflowPage page={page}>
      <LandingEvents />
    </WebflowPage>
  );
}
