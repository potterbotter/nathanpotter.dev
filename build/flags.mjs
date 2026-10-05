// Feature flags shared by the build and the Worker. Unbuilt features stay off public pages.
export const FLAGS = {
  jobFitLive: false, // fit CTAs and the job-fit tile link to a working tool
  adminLive: false,  // footer Admin link → /sign-in/ (turn on once Cloudflare Access guards /admin/)
  pdfLive: false,    // "Download the CV as a PDF" in the contact menu
};
