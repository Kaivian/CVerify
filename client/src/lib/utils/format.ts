/**
 * Formats a number as a localized currency.
 * Note: This function is strictly responsible for layout formatting. 
 * Financial conversions and arithmetic must be handled by the business logic tier.
 * 
 * @param amount - The numerical amount to format.
 * @param currency - The ISO currency code (default: 'VND').
 * @param locale - The preferred locale code (default: 'vi-VN').
 */
export function formatCurrency(amount: number, currency: string = 'VND', locale: string = 'vi-VN'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'VND' ? 0 : 2,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount);
  } catch (error) {
    console.error('Failed to format currency:', error);
    return `${amount} ${currency}`;
  }
}

/**
 * Formats a date using locale-specific formats.
 * 
 * @param date - The Date object, ISO string, or timestamp.
 * @param options - Custom DateTimeFormat options.
 * @param locale - The target locale (default: 'vi-VN').
 */
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'vi-VN'
): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return String(date);
    }
    return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(d);
  } catch (error) {
    console.error('Failed to format date:', error);
    return String(date);
  }
}

/**
 * Formats a relative time interval (e.g., "5 minutes ago", "3 ngày trước").
 * 
 * @param value - The numeric value of the interval.
 * @param unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day').
 * @param locale - The target locale (default: 'vi-VN').
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string = 'vi-VN'
): string {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
  } catch (error) {
    console.error('Failed to format relative time:', error);
    return `${value} ${unit}`;
  }
}
