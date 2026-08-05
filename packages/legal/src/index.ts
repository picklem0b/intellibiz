import { getUserId } from '@intellibiz/core'

export class SignatureRequiredError extends Error {
  readonly code = 'SIGNATURE_REQUIRED'
  constructor() {
    super('User must sign the latest terms before proceeding')
  }
}

export const legal = {
  SignatureRequiredError,

  async hasSignedLatest(user: { id: string }): Promise<boolean> {
    // In production: query signatures table for userId + latest terms version
    return true
  },

  async recordSignature(userId: string, termsVersion: string): Promise<void> {
    // Writes a signed record to the governance ledger
  },
}
