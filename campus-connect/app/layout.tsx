import type { Metadata } from "next";
import { Fredoka, Manrope } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus Connect",
  description: "Connecting CUHD Students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}