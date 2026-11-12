import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const noto = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "จองคิวตรวจสายตา | Social Eyewear",
  description: "จองคิวตรวจสายตาและนัดหมายบริการกับร้านแว่นตา Social Eyewear ได้ด้วยตนเอง",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://socialeyewearbooking.vercel.app"),
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "จองคิวตรวจสายตา | Social Eyewear",
    description: "เลือกวัน เลือกเวลา และยืนยันการจองได้ทันที",
    images: ["/logo.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174d34",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={noto.variable}>
      <body className="min-h-dvh font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
