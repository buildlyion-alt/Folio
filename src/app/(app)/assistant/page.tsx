import { redirect } from 'next/navigation'

// The assistant is an input on Home, in Log progress and in search — not a separate place.
export default function AssistantPage() {
  redirect('/home')
}
