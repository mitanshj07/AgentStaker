export function readErrorDetail(error: unknown) {
  if (error instanceof Error) return error.message.split('\n')[0] || 'Unknown wallet error'
  if (typeof error === 'string') return error
  return 'Unknown wallet error'
}

export function humanizeTransactionError(action: string, error: unknown) {
  const detail = readErrorDetail(error)
  const normalized = detail.toLowerCase()
  const lowerAction = action.toLowerCase()

  if (normalized.includes('user rejected') || normalized.includes('user denied') || normalized.includes('rejected the request') || normalized.includes('4001')) {
    return `No panic. ${action} was cancelled in the wallet, so nothing moved on Monad.`
  }

  if (normalized.includes('real testnet setup required') || normalized.includes('add the deployed') || normalized.includes('map ui market') || normalized.includes('not mapped')) {
    return `Almost ready. ${action} needs deployed Monad testnet addresses before it can sign. Paste the deployment map, then try again.`
  }

  if (normalized.includes('connect a monad testnet wallet') || normalized.includes('no injected wallet') || normalized.includes('metamask') || normalized.includes('provider')) {
    return `Wallet first. Connect MetaMask on Monad Testnet 10143, then ${lowerAction} will unlock.`
  }

  if (normalized.includes('wrong chain') || normalized.includes('switch') || normalized.includes('chain id') || normalized.includes('4902')) {
    return `Wrong network. Switch the wallet to Monad Testnet 10143 and try ${lowerAction} again.`
  }

  if (normalized.includes('insufficient funds') || normalized.includes('exceeds balance')) {
    return `Not enough test MON for ${lowerAction}. Use the faucet or lower the size; no position was opened.`
  }

  if (normalized.includes('execution reverted') || normalized.includes('revert')) {
    return `Monad rejected ${lowerAction} under contract rules. Funds stayed safe; check limits, market state, or slippage.`
  }

  return `${action} did not go through: ${detail}`
}
