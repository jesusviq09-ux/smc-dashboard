import { useNavigate } from 'react-router-dom'
import BriefingForm from './BriefingForm'

// Debrief is a post-race briefing — reuse the form with type="post" preset
export default function DebriefForm() {
  return <BriefingForm />
}
