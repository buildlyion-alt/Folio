'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { HouseholdDTO, RosterStudentDTO, SubjectDTO } from '@/domain/dto'

export interface AppData {
  household: HouseholdDTO
  user: { name: string; email: string; initials: string }
  roster: RosterStudentDTO[]
  subjects: SubjectDTO[]
  today: string
  assistant: { provider: 'openai' | 'offline'; model: string | null }
}

const AppDataContext = createContext<AppData | null>(null)

export function AppDataProvider({ value, children }: { value: AppData; children: ReactNode }) {
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>')
  return value
}
