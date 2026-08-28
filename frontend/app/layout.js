import "./globals.css";

export const metadata = {
  title: "Sign Language Translator | Real-Time AI",
  description: "Production-grade real-time American Sign Language recognition powered by MediaPipe and Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
