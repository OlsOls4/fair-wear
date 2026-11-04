import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: { default: "Fair Wear · Evidence first. People in control.", template: "%s · Fair Wear" },
  description: "Compare rental move-in and move-out evidence, inspect real recorded model results, and build a private review pack locally in your browser. Evidence first. People in control.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader />
      {children}
      <footer className="site-footer"><div><a className="footer-brand" href="/">Fair Wear.</a><span>Evidence first. People in control.</span></div><p>Built for the Meta Global AI Developer Hackathon · Prototype</p></footer>
    </body></html>
  );
}
