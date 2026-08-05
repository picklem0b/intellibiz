import Decimal from 'decimal.js'

export class Money {
  private readonly amount: Decimal
  readonly currency: string

  constructor(amount: string | number, currency: string) {
    this.amount = new Decimal(amount)
    this.currency = currency
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch')
    return new Money(this.amount.add(other.amount).toString(), this.currency)
  }

  subtract(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch')
    return new Money(this.amount.sub(other.amount).toString(), this.currency)
  }

  multiply(factor: string | number): Money {
    return new Money(this.amount.mul(new Decimal(factor)).toString(), this.currency)
  }

  toMinorUnits(): number {
    return this.amount.mul(100).toNumber()
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`
  }

  toFixed(decimals: number): string {
    return this.amount.toFixed(decimals)
  }
}
