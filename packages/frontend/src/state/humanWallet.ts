type WalletListener = () => void

const STORAGE_KEY = 'arenax:human-wallet'
const listeners = new Set<WalletListener>()
let memoryBalance = 500
let walletVersion = 0

function readStoredBalance(): number {
  if (typeof window === 'undefined') return memoryBalance
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return memoryBalance
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : memoryBalance
}

function writeBalance(next: number) {
  memoryBalance = Number(Math.max(0, next).toFixed(2))
  if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, String(memoryBalance))
  walletVersion += 1
  listeners.forEach((listener) => listener())
}

export function getHumanWalletBalance(): number {
  memoryBalance = readStoredBalance()
  return memoryBalance
}

export function getHumanWalletVersion(): number {
  return walletVersion
}

export function subscribeToHumanWallet(listener: WalletListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function debitHumanWallet(amount: number): boolean {
  const balance = getHumanWalletBalance()
  if (amount <= 0 || balance < amount) return false
  writeBalance(balance - amount)
  return true
}

export function creditHumanWallet(amount: number): void {
  if (amount <= 0) return
  writeBalance(getHumanWalletBalance() + amount)
}

