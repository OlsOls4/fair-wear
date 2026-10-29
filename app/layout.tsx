import "./globals.css";
export const metadata = { title: "Fair Wear", description: "Deposit-dispute evidence for UK renters from two phone walkthroughs." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
