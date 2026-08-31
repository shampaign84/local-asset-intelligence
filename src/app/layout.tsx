import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Local Asset Intelligence · 마포구 상권 RAG 챗봇",
  description: "지자체(B2G) 자산가치·상권 쇠퇴 예측 On-premise RAG 챗봇 프로토타입",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased bg-ink-950 ${manrope.variable}`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
