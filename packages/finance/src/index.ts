import { Money } from './money'

export { Money }

interface CartItem {
  price: string | number
  quantity: number
  currency: string
}

interface TotalInput {
  items: CartItem[]
  destination?: { country: string }
}

interface TotalResult {
  subtotal: Money
  tax: Money
  grandTotal: Money
  currency: string
}

export const finance = {
  money: (amount: string | number, currency: string) => new Money(amount, currency),

  async calculateTotal(input: TotalInput): Promise<TotalResult> {
    const currency = input.items[0]?.currency ?? 'USD'

    const subtotal = input.items.reduce((acc, item) => {
      const lineTotal = new Money(item.price, currency).multiply(item.quantity)
      return acc.add(lineTotal)
    }, new Money('0', currency))

    const taxRate = input.destination?.country === 'GB' ? '0.20'
      : input.destination?.country === 'DE' ? '0.19'
      : '0.00'

    const tax = subtotal.multiply(taxRate)
    const grandTotal = subtotal.add(tax)

    return { subtotal, tax, grandTotal, currency }
  },
}
