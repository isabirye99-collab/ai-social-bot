import "./globals.css";
import CRMLayout from "../components/CRMLayout";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CRMLayout>{children}</CRMLayout>
      </body>
    </html>
  );
}