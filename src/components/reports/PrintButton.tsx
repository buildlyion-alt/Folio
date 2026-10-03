'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function PrintButton() {
  return (
    <Button variant="primary" icon={Printer} onClick={() => window.print()}>
      Print or save PDF
    </Button>
  )
}
