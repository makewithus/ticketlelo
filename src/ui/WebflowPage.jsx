import WebflowRuntime from "./WebflowRuntime";

const NAVBAR_SPACING_FIXES = `
  .navbar .container.is--nav { display:flex; align-items:center; justify-content:flex-start; gap:clamp(.5rem, 1.2vw, 1.25rem); min-width:0; }
  .navbar .container.is--nav > .nav_logo-wrap { flex:0 0 auto; }
  .navbar .container.is--nav > .sale-style { flex:1 1 auto; min-width:0; }
  .navbar .nav-right { flex:0 0 auto; gap:clamp(.4rem, .8vw, .75rem); margin-left:0; }
  .navbar .header-sale { gap:clamp(.75rem, 1.5vw, 1.5rem); padding-inline:clamp(1rem, 2vw, 2rem); min-width:0; }
  .navbar .timeline-wrapper { flex:1 1 auto; min-width:0; gap:clamp(.5rem, 1vw, 1rem); }
  .navbar .sale-style .timer { display:flex !important; align-items:center; flex:0 0 auto; width:max-content !important; gap:.08em !important; margin:0 !important; white-space:nowrap; }
  .navbar .timer__section { display:flex; flex:0 0 auto; align-items:center; gap:.15rem; white-space:nowrap; }
  .navbar .timer__section:not(.mr-16) { gap:0; }
  .navbar .timer__section.mr-16 { margin-right:.45rem !important; }
  .navbar .timer__days, .navbar .timer__hours, .navbar .timer__minutes, .navbar .timer__seconds { display:inline-block; font-variant-numeric:tabular-nums; line-height:1; }
  .navbar .timer__days { min-width:2ch; text-align:right; }
  .navbar .timer__hours, .navbar .timer__minutes, .navbar .timer__seconds { width:2ch; text-align:center; }
  .navbar .timer > .text-size-28 { flex:0 0 .55em; width:.55em; line-height:1; margin:0 !important; text-align:center; }
  .navbar .timeline-wrapper p { flex:1 1 auto; min-width:0; margin:0 !important; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .navbar .go_bot { flex:0 0 auto; gap:.5rem; margin-left:auto; white-space:nowrap; }
  @media screen and (max-width:767px) {
    .navbar .container.is--nav { align-items:center; gap:.4rem; }
    .navbar .header-sale { gap:.5rem; padding-inline:.8rem; }
    .navbar .timeline-wrapper { gap:.35rem; }
    .navbar .timer__section.mr-16 { margin-right:.35rem !important; }
    .navbar .timeline-wrapper p { max-width:38vw; }
    .navbar .nav-right { gap:.35rem; }
  }
`;

/** Renders one page of the UI dev's static export (see scripts/sync-ui.mjs). */
export default function WebflowPage({ page, children, skipStaticCountdown = false }) {
  const scripts = skipStaticCountdown
    ? page.scripts.filter((item) => !item.code?.includes("Target: Nov 4 2026 launch date"))
    : page.scripts;
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
      <style dangerouslySetInnerHTML={{ __html: NAVBAR_SPACING_FIXES }} />
      {children}
      <WebflowRuntime scripts={scripts} rootId="tl-ui-root" />
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
