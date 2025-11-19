import "./globals.css";
import type { Metadata } from "next";
import GoogleSignIn from "../components/GoogleSignIn";
import UserMenu from "../components/UserMenu";

export const metadata: Metadata = {
  title: "JAB Veo 3.1 Video Builder",
  description:
    "Generate up to 8s video ads with the worlds most advanced AI generator.",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/favicon.png" },
  ],
  themeColor: "#630183",   // <<< THIS MAKES iMESSAGE PREVIEW PURPLE
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* 👇 Padding added here: pushes everything down on mobile */}
      <body className="pt-16 md:pt-0">
        <header className="header">
          <nav className="nav container">
            <div className="brand">
              <div className="brand-badge" />
              <div className="brand-title">JAB • Video Builder</div>
            </div>

            <div>
              <a
                className="link"
                href="https://jordanborden.com"
                target="_blank"
                rel="noreferrer"
              >
                by Jordan &amp; Borden
              </a>
            </div>

            {/* Floating on mobile */}
            <div className="auth-area">
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
