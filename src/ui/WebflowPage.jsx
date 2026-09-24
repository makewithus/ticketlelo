import WebflowRuntime from "./WebflowRuntime";

/** Renders one page of the UI dev's static export (see scripts/sync-ui.mjs). */
export default function WebflowPage({ page, children }) {
  return (
    <>
      {page.stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {page.styles.map((css, i) => (
        <style key={i} dangerouslySetInnerHTML={{ __html: css }} />
      ))}
      <div
        id="tl-ui-root"
        style={{ display: "contents" }}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: page.body }}
      />
      {children}
      <WebflowRuntime scripts={page.scripts} rootId="tl-ui-root" />
    </>
  );
}

export const pageMetadata = ({ meta }) => ({
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta["og:title"] || meta.title,
    description: meta["og:description"] || meta.description,
    type: meta["og:type"] || "website",
  },
  twitter: {
    card: meta["twitter:card"] || "summary_large_image",
    title: meta["twitter:title"] || meta.title,
    description: meta["twitter:description"] || meta.description,
  },
});
