import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DirectorStudio - Professional Video Production Platform',
  description: 'Complete video production ecosystem for directors, creators, and production teams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
