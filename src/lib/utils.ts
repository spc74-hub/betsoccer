import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatInTimeZone } from 'date-fns-tz';
import { isAfter, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TIMEZONE = 'Europe/Madrid';

export function formatMatchDate(dateString: string): string {
  const date = parseISO(dateString);
  return formatInTimeZone(date, TIMEZONE, "EEEE d 'de' MMMM", { locale: es });
}

export function formatMatchTime(dateString: string): string {
  const date = parseISO(dateString);
  return formatInTimeZone(date, TIMEZONE, 'HH:mm', { locale: es });
}

export function formatFullDate(dateString: string): string {
  const date = parseISO(dateString);
  return formatInTimeZone(date, TIMEZONE, "d MMM yyyy, HH:mm", { locale: es });
}

export function isPredictionLocked(kickoffUtc: string): boolean {
  const kickoff = parseISO(kickoffUtc);
  return isAfter(new Date(), kickoff);
}

export function getTeamSlug(teamName: string): 'real-madrid' | 'barcelona' | null {
  const lower = teamName.toLowerCase();
  if (lower.includes('real madrid')) return 'real-madrid';
  if (lower.includes('barcelona')) return 'barcelona';
  return null;
}

export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 1;
  }
  return 0;
}
