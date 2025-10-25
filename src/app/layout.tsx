import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JAB Veo 3.1 Video Builder",
  description: "Generate 8s–45s Veo 3.1 video ads with JAB branding for WOW 1 DAY PAINTING.",
  icons: [{ url: "/favicon.ico" }]
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
              <a className="link" href="https://jordanborden.com" target="_blank" rel="noreferrer">Jordan & Borden</a>
            </div>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}