// Feature flags shared by the build and the Worker. Unbuilt features stay off public pages.
export const FLAGS = {
  jobFitLive: true,  // fit CTAs and the job-fit tile link to a working tool
  adminLive: true,   // footer Admin link → /sign-in/ (Cloudflare Access guards /admin/)
  pdfLive: false,    // "Download the CV as a PDF" in the contact menu
  // Cloudflare Turnstile site key for the public job-fit form (public by design; the secret is TURNSTILE_SECRET in the
  // dashboard). Empty = no widget. Set both together: with a secret but no widget, every visitor would fail the check.
  turnstileSiteKey: '0x4AAAAAAFVEQ4jG-5IB6h7O',
};
