import type { Metadata } from "next";
import "./globals.css";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  metadataBase: new URL("https://masir1128.github.io/MusicBox/"),
  title: "ORBITONE 星轨音乐盒",
  description: "上传音乐，在浏览器本地生成全曲同步的 9:16 弹珠音乐视频。开发者：科学羊。",
  icons: {
    icon: `${publicBasePath}/kexueyang.jpg`,
    apple: `${publicBasePath}/kexueyang.jpg`,
  },
  openGraph: {
    title: "ORBITONE 星轨音乐盒",
    description: "上传音乐 · 同步弹跳 · 9:16 成片",
    images: [{ url: "og.png", width: 1672, height: 941, alt: "ORBITONE 星轨音乐盒" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ORBITONE 星轨音乐盒",
    description: "上传音乐 · 同步弹跳 · 9:16 成片",
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
