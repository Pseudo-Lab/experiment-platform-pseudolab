const STORAGE_KEY = 'demo_uid'

export function getUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

export function resetUserId(): string {
  const id = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}
