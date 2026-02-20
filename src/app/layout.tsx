import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "MedPriest Dashboard",
  description: "Dashboard หน่วยงานอายุรกรรม โรงพยาบาลสงฆ์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <Nav />
        <main className="app-shell">{children}</main>
        <footer className="site-footer">
          <p className="footer-brand">&copy; 2026 directed by <a href="mailto:uradev222@gmail.com" className="footer-link">Uradev</a></p>
          <p className="footer-motto">สร้างด้วยใจ เพื่อแผนกอายุรกรรม รักและสามัคคีกัน</p>
        </footer>
      </body>
    </html>
  );
}
