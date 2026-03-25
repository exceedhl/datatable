import type { NumberFormatConfig } from './types';

const CURRENCY_MAP: Record<string, { locale: string; currency: string }> = {
  CNY: { locale: 'zh-CN', currency: 'CNY' },
  USD: { locale: 'en-US', currency: 'USD' },
  EUR: { locale: 'de-DE', currency: 'EUR' },
  GBP: { locale: 'en-GB', currency: 'GBP' },
  JPY: { locale: 'ja-JP', currency: 'JPY' },
};

export function formatNumber(value: any, config?: NumberFormatConfig): string {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);

  if (!config) return String(value);

  // Currency formatting
  if (config.currency) {
    const cm = CURRENCY_MAP[config.currency];
    if (cm) {
      const formatted = new Intl.NumberFormat(cm.locale, {
        style: 'currency',
        currency: cm.currency,
        minimumFractionDigits: config.decimals ?? 2,
        maximumFractionDigits: config.decimals ?? 2,
      }).format(num);
      return config.suffix ? `${formatted}${config.suffix}` : formatted;
    }
  }

  // Standard number formatting
  const opts: Intl.NumberFormatOptions = {};
  if (config.decimals !== undefined) {
    opts.minimumFractionDigits = config.decimals;
    opts.maximumFractionDigits = config.decimals;
  }
  if (config.thousandSeparator) {
    opts.useGrouping = true;
  } else {
    opts.useGrouping = false;
  }

  const formatted = new Intl.NumberFormat('en-US', opts).format(num);
  return config.suffix ? `${formatted}${config.suffix}` : formatted;
}
