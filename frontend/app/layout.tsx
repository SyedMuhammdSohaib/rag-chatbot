import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reading Room — RAG Chatbot",
  description: "Ask questions grounded in your own documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
