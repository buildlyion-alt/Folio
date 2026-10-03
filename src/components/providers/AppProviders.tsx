'use client'

import type { ReactNode } from 'react'
import { CommandProvider } from '@/components/command/CommandProvider'
import { LogProgressProvider } from '@/components/log/LogProgressProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { AppDataProvider, type AppData } from './AppData'

export function AppProviders({ data, children }: { data: AppData; children: ReactNode }) {
  return (
    <AppDataProvider value={data}>
      <ToastProvider>
        <LogProgressProvider>
          <CommandProvider>{children}</CommandProvider>
        </LogProgressProvider>
      </ToastProvider>
    </AppDataProvider>
  )
}
