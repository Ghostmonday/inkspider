import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SpiderInk.art',
  description: 'Video sharing platform',
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
