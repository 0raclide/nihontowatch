import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3020';

describe('Exchange Rates API', () => {
  it('should return exchange rates', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('base');
    expect(data).toHaveProperty('rates');
    expect(data).toHaveProperty('timestamp');
  });

  it('should have USD as base currency', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    expect(data.base).toBe('USD');
  });

  it('should include USD, JPY, and EUR rates', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    expect(data.rates).toHaveProperty('USD');
    expect(data.rates).toHaveProperty('JPY');
    expect(data.rates).toHaveProperty('EUR');
  });

  it('should have USD rate of 1', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    expect(data.rates.USD).toBe(1);
  });

  it('should have reasonable JPY rate (100-200)', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    // JPY is typically 100-200 per USD
    expect(data.rates.JPY).toBeGreaterThan(100);
    expect(data.rates.JPY).toBeLessThan(200);
  });

  it('should have reasonable EUR rate (0.8-1.2)', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    // EUR is typically 0.8-1.2 per USD
    expect(data.rates.EUR).toBeGreaterThan(0.8);
    expect(data.rates.EUR).toBeLessThan(1.2);
  });

  it('should have recent timestamp', async () => {
    const res = await fetch(`${API_BASE}/api/exchange-rates`);
    const data = await res.json();

    const now = Date.now();
    const ratesTime = data.timestamp;

    // Rates should be from the last 24 hours
    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(now - ratesTime).toBeLessThan(oneDayMs);
  });
});

describe('Currency Conversion Logic', () => {
  interface ExchangeRates {
    base: string;
    rates: Record<string, number>;
    timestamp: number;
  }

  type Currency = 'USD' | 'JPY' | 'EUR';

  function convertPrice(
    value: number,
    sourceCurrency: string,
    targetCurrency: Currency,
    rates: ExchangeRates | null
  ): number {
    if (!rates || sourceCurrency === targetCurrency) {
      return value;
    }

    const source = sourceCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    const sourceRate = rates.rates[source] || 1;
    const targetRate = rates.rates[target] || 1;

    const valueInUsd = value / sourceRate;
    return valueInUsd * targetRate;
  }

  const mockRates: ExchangeRates = {
    base: 'USD',
    rates: {
      USD: 1,
      JPY: 150,
      EUR: 0.92,
    },
    timestamp: Date.now(),
  };

  describe('Same currency conversion', () => {
    it('should return same value for USD to USD', () => {
      expect(convertPrice(1000, 'USD', 'USD', mockRates)).toBe(1000);
    });

    it('should return same value for JPY to JPY', () => {
      expect(convertPrice(150000, 'JPY', 'JPY', mockRates)).toBe(150000);
    });
  });

  describe('USD conversions', () => {
    it('should convert USD to JPY correctly', () => {
      const result = convertPrice(1000, 'USD', 'JPY', mockRates);
      expect(result).toBe(150000); // 1000 * 150
    });

    it('should convert USD to EUR correctly', () => {
      const result = convertPrice(1000, 'USD', 'EUR', mockRates);
      expect(result).toBe(920); // 1000 * 0.92
    });
  });

  describe('JPY conversions', () => {
    it('should convert JPY to USD correctly', () => {
      const result = convertPrice(150000, 'JPY', 'USD', mockRates);
      expect(result).toBe(1000); // 150000 / 150
    });

    it('should convert JPY to EUR correctly', () => {
      const result = convertPrice(150000, 'JPY', 'EUR', mockRates);
      expect(result).toBeCloseTo(920, 0); // (150000 / 150) * 0.92
    });
  });

  describe('EUR conversions', () => {
    it('should convert EUR to USD correctly', () => {
      const result = convertPrice(920, 'EUR', 'USD', mockRates);
      expect(result).toBe(1000); // 920 / 0.92
    });

    it('should convert EUR to JPY correctly', () => {
      const result = convertPrice(920, 'EUR', 'JPY', mockRates);
      expect(result).toBe(150000); // (920 / 0.92) * 150
    });
  });

  describe('Edge cases', () => {
    it('should return same value when rates is null', () => {
      expect(convertPrice(1000, 'USD', 'JPY', null)).toBe(1000);
    });

    it('should handle zero value', () => {
      expect(convertPrice(0, 'USD', 'JPY', mockRates)).toBe(0);
    });

    it('should handle case-insensitive currency codes', () => {
      const result = convertPrice(1000, 'usd', 'JPY', mockRates);
      expect(result).toBe(150000);
    });
  });

  describe('Real-world price examples', () => {
    it('should convert typical nihonto JPY price to USD', () => {
      // A typical sword at 3,500,000 JPY
      const jpyPrice = 3500000;
      const usdPrice = convertPrice(jpyPrice, 'JPY', 'USD', mockRates);
      expect(usdPrice).toBeCloseTo(23333, 0); // ~$23,333
    });

    it('should convert typical nihonto JPY price to EUR', () => {
      const jpyPrice = 3500000;
      const eurPrice = convertPrice(jpyPrice, 'JPY', 'EUR', mockRates);
      expect(eurPrice).toBeCloseTo(21467, 0); // ~€21,467
    });
  });
});
