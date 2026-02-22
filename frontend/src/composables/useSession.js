import { ref } from 'vue'

const SESSION_KEY = 'einkaufsliste_session_name'

// Shared reactive state across all composable calls
const sessionName = ref(localStorage.getItem(SESSION_KEY) || '')

export function useSession() {
  function setSessionName(name) {
    sessionName.value = name.trim()
    localStorage.setItem(SESSION_KEY, sessionName.value)
  }

  function clearSession() {
    sessionName.value = ''
    localStorage.removeItem(SESSION_KEY)
  }

  return {
    sessionName,
    setSessionName,
    clearSession
  }
}
