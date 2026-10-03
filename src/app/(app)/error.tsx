'use client'

import { useEffect } from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, Panel } from '@/components/ui/Misc'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Panel>
      <EmptyState
        icon={CircleAlert}
        title="This page didn’t load"
        actions={
          <>
            <Button variant="primary" icon={RotateCcw} onClick={reset}>
              Try again
            </Button>
            <ButtonLink href="/home">Go to Home</ButtonLink>
          </>
        }
      >
        Your records are safe — nothing was changed. If this keeps happening, check that the database is reachable.
        {error.digest ? <span style={{ display: 'block', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Reference {error.digest}</span> : null}
      </EmptyState>
    </Panel>
  )
}
