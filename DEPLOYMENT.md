# Deployment Notes

This app must be deployed as a Next.js server app, not as a GitHub Pages
static site. The organiser, admin, payment, messaging, ticket, upload, and cron
features depend on `/api/...` route handlers, which GitHub Pages cannot run.

## Vercel

- Project root directory: `ticketlelo`
- Build command: `npm run build`
- Output directory: leave empty/default (`.next`)
- Framework preset: Next.js
- Do not use `next export` or a GitHub Pages static export for this app.

## Custom Domain

The `ticketlelo.in` DNS records must point to the deployed Next.js project
(for example Vercel), not GitHub Pages. If the domain still opens a page saying
"GitHub Pages - 404 File not found", then the domain is still connected to
GitHub Pages and direct URLs like `/organiser-login` will fail for some users.

Remove the custom domain from the GitHub Pages/static export repository before
assigning it to the Next.js deployment. In this workspace, the static export
folder `../ticketlelo-ui` contains a `CNAME` file for `ticketlelo.in`; that
static Pages deployment should not own the production app domain.

## Verification

After deployment, test these URLs in a fresh/incognito browser:

- `https://ticketlelo.in/`
- `https://ticketlelo.in/organiser-login`
- `https://ticketlelo.in/user-login`
- `https://ticketlelo.in/super-admin-login`
- `https://ticketlelo.in/host-event`
- `https://ticketlelo.in/admin/dashboard`
