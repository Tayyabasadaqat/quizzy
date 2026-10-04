import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Quizzy | AI-Powered Multiplayer Quiz",
    template: "%s | Quizzy",
  },

  description:
    "Create, host, and play real-time multiplayer quizzes with Quizzy. Generate quizzes with AI, compete with friends, climb the leaderboard, and make learning more interactive.",

  keywords: [
    "Quizzy",
    "AI Quiz Maker",
    "Multiplayer Quiz",
    "Online Quiz",
    "Real-Time Quiz",
    "Quiz Game",
    "Educational Quiz",
    "AI Quiz Generator",
    "Interactive Learning",
  ],

  authors: [{ name: "Tayyaba Sadaqat" }],

  applicationName: "Quizzy",

  openGraph: {
    title: "Quizzy | AI-Powered Multiplayer Quiz",
    description:
      "Create quizzes with AI, host live games, compete in real time, and climb the leaderboard.",
    type: "website",
    siteName: "Quizzy",
  },

  twitter: {
    card: "summary_large_image",
    title: "Quizzy | AI-Powered Multiplayer Quiz",
    description:
      "Create quizzes with AI, host live games, and compete with friends in real time.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
