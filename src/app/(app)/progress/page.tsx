import { redirect } from 'next/navigation'

// Progress now lives where parents look for it: Home (everyone) and each student's page.
export default function ProgressPage() {
  redirect('/home')
}
