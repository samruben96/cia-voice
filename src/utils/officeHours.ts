// ============================================================================
// Office Hours Utility
// ============================================================================

export interface OfficeHoursResult {
  isOpen: boolean;
  currentTime: string;
  currentDay: string;
  nextBusinessDay: string;
  message: string;
}

/**
 * Check if the office is currently open based on Pacific Time
 * Office hours: Monday-Friday, 9 AM - 5 PM Pacific Time
 *
 * @param date - Optional date to check (defaults to current time)
 * @returns Office hours status with current time and next business day info
 */
export function checkOfficeHours(date?: Date): OfficeHoursResult {
  const now = date ?? new Date();
  const pacificTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
  );
  const day = pacificTime.getDay();
  const hour = pacificTime.getHours();

  const isWeekday = day >= 1 && day <= 5;
  const isBusinessHours = hour >= 9 && hour < 17;
  const isOpen = isWeekday && isBusinessHours;

  const timeString = pacificTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dayName = pacificTime.toLocaleDateString('en-US', {
    weekday: 'long',
  });

  // Calculate next business day for after-hours messaging
  let nextBusinessDay = 'tomorrow';
  if (day === 5 && hour >= 17) nextBusinessDay = 'Monday';
  if (day === 6) nextBusinessDay = 'Monday';
  if (day === 0) nextBusinessDay = 'Monday';

  return {
    isOpen,
    currentTime: timeString,
    currentDay: dayName,
    nextBusinessDay,
    message: isOpen
      ? `The office is currently open. It's ${timeString} on ${dayName} Pacific Time.`
      : `The office is currently closed. It's ${timeString} on ${dayName} Pacific Time. Office hours are Monday through Friday, 9 AM to 5 PM Pacific Time. Agents will be back at 8 AM on ${nextBusinessDay}.`,
  };
}
