import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Asset Intelligence · 마포구 상권 RAG 챗봇",
  description: "지자체(B2G) 자산가치·상권 쇠퇴 예측 On-premise RAG 챗봇 프로토타입",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
