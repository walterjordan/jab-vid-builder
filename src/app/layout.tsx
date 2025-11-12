import "./globals.css";
import type { Metadata } from "next";
import GoogleSignIn from "../components/GoogleSignIn";   // NEW
import UserMenu from "../components/UserMenu";           // already in your project

export const metadata: Metadata = {
  title: "JAB Veo 3.1 Video Builder",
  description: "Generate up to 8s video ads with the worlds most advanced AI generator.",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/favicon.png" },]
};

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="en">
      <body>
        <header className="header">
          <nav className="nav container">
            <div className="brand">
              <div className="brand-badge" />
              <div className="brand-title">JAB • Video Builder</div>
            </div>
            <div>
              <a className="link" href="https://jordanborden.com" target="_blank" rel="noreferrer">by Jordan & Borden</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <UserMenu />
              <GoogleSignIn />
            </div>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}