import { describe, expect, it } from 'vitest'
import { netUnitPrice, oneflowProductsValue, visiblePriceKey, wizardProductsValue, type OneflowProductGroup } from './oneflowProductValue'

const cols = (p1: boolean, p2: boolean) => ({
  columns: [
    { key: 'name', enabled: true },
    { key: 'price_1', enabled: p1 },
    { key: 'price_2', enabled: p2 },
    { key: 'count', enabled: true },
  ],
})

// Anlos 2, Oneflow 15085113: "Pris" (price_1) dold, "Pris totalt" (price_2) synlig, 20 % rabatt
const anlos: OneflowProductGroup = {
  configuration: cols(false, true),
  products: [{
    name: 'Mekaniska fällor',
    price_1: { amount: { amount: '4792' }, base_amount: { amount: '5990' }, discount_amount: { amount: '0' }, discount_percent: '20.000' },
    price_2: { amount: { amount: '5592' }, base_amount: { amount: '6990' }, discount_amount: { amount: '0' }, discount_percent: '20.000' },
    quantity: { amount: 5, type: 'quantity' },
  }],
}

describe('visiblePriceKey', () => {
  it('väljer kolumnen som syns', () => {
    expect(visiblePriceKey({ configuration: cols(false, true) })).toBe('price_2')
    expect(visiblePriceKey({ configuration: cols(true, false) })).toBe('price_1')
    expect(visiblePriceKey({ configuration: cols(true, true) })).toBe('price_1')
  })
  it('läser enabled_columns när configuration saknas, annars price_1', () => {
    expect(visiblePriceKey({ enabled_columns: [{ key: 'price_1', enabled: false }, { key: 'price_2', enabled: true }] })).toBe('price_2')
    expect(visiblePriceKey({})).toBe('price_1')
  })
})

describe('netUnitPrice', () => {
  it('amount är priset efter rabatt', () => {
    expect(netUnitPrice(anlos.products![0].price_2)).toBe(5592)
  })
  it('räknar rabatten själv när amount saknas (procent eller kronor)', () => {
    expect(netUnitPrice({ base_amount: { amount: '6990' }, discount_percent: '20' })).toBe(5592)
    expect(netUnitPrice({ base_amount: { amount: '1000' }, discount_amount: { amount: '150' } })).toBe(850)
    expect(netUnitPrice({ base_amount: { amount: '1000' }, discount_amount: { amount: '0' } })).toBe(1000)
  })
  it('saknat pris är 0', () => {
    expect(netUnitPrice(null)).toBe(0)
  })
})

describe('oneflowProductsValue', () => {
  it('Anlos 2: synlig kolumn efter rabatt gånger antal = 27 960', () => {
    const v = oneflowProductsValue([anlos])
    expect(v.total).toBe(27960)
    expect(v.rows[0]).toMatchObject({ priceKey: 'price_2', unitPrice: 5592, listPrice: 6990, quantity: 5 })
  })
  it('wizardens avtal: samma pris i båda kolumnerna, med och utan rabatt', () => {
    const utan: OneflowProductGroup = { configuration: cols(true, false), products: [{ name: 'Kontroll', price_1: { amount: { amount: '1200' }, base_amount: { amount: '1200' } }, price_2: { amount: { amount: '1200' }, base_amount: { amount: '1200' } }, quantity: { amount: 4 } }] }
    const med: OneflowProductGroup = { configuration: cols(true, false), products: [{ name: 'Station', price_1: { amount: { amount: '900' }, base_amount: { amount: '1000' }, discount_percent: '10' }, price_2: { amount: { amount: '900' }, base_amount: { amount: '1000' }, discount_percent: '10' }, quantity: { amount: 3 } }] }
    expect(oneflowProductsValue([utan]).total).toBe(4800)
    expect(oneflowProductsValue([med]).total).toBe(2700)
    expect(oneflowProductsValue([utan, med]).total).toBe(7500)
  })
  it('dolt pris i wizarden (price null) ger 0 för raden', () => {
    const v = oneflowProductsValue([{ configuration: cols(true, false), products: [{ name: 'Artikel', price_1: null, price_2: null, quantity: { amount: 2 } }] }])
    expect(v.total).toBe(0)
  })
  it('synlig kolumn utan pris faller tillbaka till den andra', () => {
    const v = oneflowProductsValue([{ configuration: cols(false, true), products: [{ name: 'X', price_1: { amount: { amount: '500' } }, quantity: { amount: 2 } }] }])
    expect(v.rows[0]).toMatchObject({ priceKey: 'price_1', total: 1000 })
  })
  it('val-produkter: antal 0 räknas inte', () => {
    const v = oneflowProductsValue([{ configuration: cols(true, false), products: [
      { name: 'Vald', price_1: { amount: { amount: '300' } }, quantity: { amount: 1, type: 'single_choice' } },
      { name: 'Ej vald', price_1: { amount: { amount: '700' } }, quantity: { amount: 0, type: 'single_choice' } },
    ] }])
    expect(v.total).toBe(300)
  })
  it('saknat antal räknas som 1, inga grupper ger 0', () => {
    expect(oneflowProductsValue([{ products: [{ price_1: { amount: { amount: '250' } } }] }]).total).toBe(250)
    expect(oneflowProductsValue(null).total).toBe(0)
  })
})

describe('wizardProductsValue', () => {
  it('oförändrad: price_1 gånger antal, även när price_1 är dold (ROT-offert)', () => {
    const rot: OneflowProductGroup = { configuration: cols(false, true), products: [
      { name: 'Arbetskostnad', price_1: { amount: { amount: '6720' } }, price_2: { amount: { amount: '8960' } }, quantity: { amount: 1 } },
      { name: 'Material', price_1: { amount: { amount: '1157' } }, price_2: { amount: { amount: '1157' } }, quantity: { amount: 1 } },
    ] }
    expect(wizardProductsValue([rot])).toBe(7877)
    expect(wizardProductsValue([anlos])).toBe(23960)
  })
  it('antal 0 eller saknat räknas som 1, som förut', () => {
    expect(wizardProductsValue([{ products: [{ price_1: { amount: { amount: '100' } }, quantity: { amount: 0 } }, { price_1: { amount: { amount: '50' } } }] }])).toBe(150)
  })
})
