import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Johden Business Consultancy Services | Strategy. Growth. Technology.",
    template: "%s | Johden Business Consultancy Services",
  },
  description:
    "Johden helps businesses grow through business consultancy, marketing and branding, software development, research, analytics and creative services.",
  applicationName: "Johden Business Consultancy Services",
  keywords: [
    "business consultancy Uganda",
    "marketing consultancy",
    "software development",
    "business plans",
    "branding",
    "Johden Business Consultancy Services",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}