'use client';

import { useState, useEffect } from 'react';

interface TimeOnMarketCounterProps {
  startDate: string;
  className?: string;
}

interface TimeComponents {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeComponents(startDate: string): TimeComponents {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - start.getTime());

  const seconds = Math.floor(diffMs / 1000) % 60;
  const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
  const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds };
}

function formatTimeComponent(value: number): string {
  return value.toString().padStart(2, '0');
}

export function TimeOnMarketCounter({ startDate, className = '' }: TimeOnMarketCounterProps) {
  const [time, setTime] = useState<TimeComponents>(() => calculateTimeComponents(startDate));

  useEffect(() => {
    // Update immediately on mount
    setTime(calculateTimeComponents(startDate));

    // Update every second
    const interval = setInterval(() => {
      setTime(calculateTimeComponents(startDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [startDate]);

  // Format based on age - show days if >= 1 day, otherwise just HH:MM:SS
  const showDays = time.days > 0;

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums text-muted ${className}`}>
      <span className="text-muted/70">&#x23F1;</span>
      {showDays && (
        <>
          <span>{time.days}d</span>
          <span className="text-muted/40">&middot;</span>
        </>
      )}
      <span>
        {formatTimeComponent(time.hours)}:
        {formatTimeComponent(time.minutes)}:
        <span className="text-muted/60">{formatTimeComponent(time.seconds)}</span>
      </span>
    </span>
  );
}

export default TimeOnMarketCounter;
