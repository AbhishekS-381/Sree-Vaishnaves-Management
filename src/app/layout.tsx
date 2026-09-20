import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sree Vaishnaves',
  description: 'Hotel Sree Vaishnaves — Quality Vegetarian Restaurant in Kannur',
  icons: {
    icon: 'https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Flogo%2Fhero-img.webp?alt=media&token=66baa7eb-8f3c-48b9-8c1f-c1443889e719',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
