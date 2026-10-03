import { UserPlus, Users } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, Panel } from '@/components/ui/Misc'

export function NoStudents() {
  return (
    <Panel>
      <EmptyState
        icon={Users}
        title="No students yet"
        actions={
          <ButtonLink href="/students?new=1" variant="primary" icon={UserPlus}>
            Add student
          </ButtonLink>
        }
      >
        Add your first student to start tracking PACE progress, test scores and records.
      </EmptyState>
    </Panel>
  )
}
