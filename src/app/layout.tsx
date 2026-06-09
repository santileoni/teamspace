import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teamspace",
  description: "A compact project management app."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
