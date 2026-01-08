import assert from 'node:assert';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { checkOfficeHours, type OfficeHoursResult } from '../../utils/officeHours.js';

/**
 * Office Hours Tool Tests
 *
 * Tests the checkOfficeHours utility which determines if the Chrysalis Insurance
 * Agency office is open (Monday-Friday, 9 AM - 5 PM Pacific Time).
 *
 * Test Strategy:
 * - Boundary value analysis for time edges (8:59 AM, 9:00 AM, 4:59 PM, 5:00 PM)
 * - Day of week coverage (all 7 days)
 * - Next business day calculation
 * - Time zone handling verification
 */
describe('checkOfficeHours', () => {
  /**
   * Helper to create a date in Pacific Time
   * Note: We pass dates directly to the function which handles timezone conversion
   */
  function createPacificDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number = 0,
  ): Date {
    // Create a date string in Pacific Time and let JavaScript parse it
    // Format: "2024-01-15T10:00:00" in America/Los_Angeles
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    // Use Intl.DateTimeFormat to get the offset and create correct Date
    const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Los_Angeles' };
    const pacificDate = new Date(
      new Date(dateStr).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC',
    );

    // Alternative: Create date that when converted to Pacific, gives us the desired time
    // This is complex due to DST, so we'll use a different approach
    // We create a date and adjust based on what time we want in Pacific

    // Simpler approach: Create the date in UTC and let the function convert
    // January 2024: PST is UTC-8
    // 2024-01-15 is a Monday
    const utcDate = new Date(
      Date.UTC(year, month - 1, day, hour + 8, minute, 0), // +8 for PST offset
    );
    return utcDate;
  }

  describe('Business Hours - Monday through Friday, 9 AM - 5 PM Pacific', () => {
    it('should return isOpen: true for Monday 10 AM Pacific', () => {
      // Monday, January 15, 2024 at 10:00 AM Pacific (18:00 UTC)
      const monday10am = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
      const result = checkOfficeHours(monday10am);

      assert.strictEqual(result.isOpen, true, 'Office should be open at 10 AM on Monday');
      assert.strictEqual(result.currentDay, 'Monday', 'Day should be Monday');
      assert.strictEqual(result.nextBusinessDay, 'tomorrow', 'Next business day should be tomorrow');
    });

    it('should return isOpen: true for Wednesday 12 PM Pacific (noon)', () => {
      // Wednesday, January 17, 2024 at 12:00 PM Pacific (20:00 UTC)
      const wednesdayNoon = new Date(Date.UTC(2024, 0, 17, 20, 0, 0));
      const result = checkOfficeHours(wednesdayNoon);

      assert.strictEqual(result.isOpen, true, 'Office should be open at noon on Wednesday');
      assert.strictEqual(result.currentDay, 'Wednesday', 'Day should be Wednesday');
    });

    it('should return isOpen: true for Friday 4:59 PM Pacific', () => {
      // Friday, January 19, 2024 at 4:59 PM Pacific (00:59 UTC next day)
      const friday459pm = new Date(Date.UTC(2024, 0, 20, 0, 59, 0));
      const result = checkOfficeHours(friday459pm);

      assert.strictEqual(result.isOpen, true, 'Office should be open at 4:59 PM on Friday');
      assert.strictEqual(result.currentDay, 'Friday', 'Day should be Friday');
    });

    it('should return isOpen: true at exactly 9:00 AM Pacific', () => {
      // Tuesday, January 16, 2024 at 9:00 AM Pacific (17:00 UTC)
      const tuesday9am = new Date(Date.UTC(2024, 0, 16, 17, 0, 0));
      const result = checkOfficeHours(tuesday9am);

      assert.strictEqual(result.isOpen, true, 'Office should be open at exactly 9:00 AM');
    });
  });

  describe('Before Business Hours', () => {
    it('should return isOpen: false for Monday 8:59 AM Pacific (before 9 AM)', () => {
      // Monday, January 15, 2024 at 8:59 AM Pacific (16:59 UTC)
      const monday859am = new Date(Date.UTC(2024, 0, 15, 16, 59, 0));
      const result = checkOfficeHours(monday859am);

      assert.strictEqual(result.isOpen, false, 'Office should be closed before 9 AM');
      assert.strictEqual(result.currentDay, 'Monday', 'Day should be Monday');
      assert.strictEqual(result.nextBusinessDay, 'tomorrow', 'Next business day should be tomorrow');
    });

    it('should return isOpen: false for Wednesday 6:00 AM Pacific', () => {
      // Wednesday, January 17, 2024 at 6:00 AM Pacific (14:00 UTC)
      const wednesday6am = new Date(Date.UTC(2024, 0, 17, 14, 0, 0));
      const result = checkOfficeHours(wednesday6am);

      assert.strictEqual(result.isOpen, false, 'Office should be closed at 6 AM');
    });
  });

  describe('After Business Hours', () => {
    it('should return isOpen: false for Friday 5:00 PM Pacific', () => {
      // Friday, January 19, 2024 at 5:00 PM Pacific (01:00 UTC next day)
      const friday5pm = new Date(Date.UTC(2024, 0, 20, 1, 0, 0));
      const result = checkOfficeHours(friday5pm);

      assert.strictEqual(result.isOpen, false, 'Office should be closed at exactly 5 PM');
      assert.strictEqual(result.currentDay, 'Friday', 'Day should be Friday');
      assert.strictEqual(result.nextBusinessDay, 'Monday', 'Next business day should be Monday after Friday evening');
    });

    it('should return isOpen: false for Monday 8:00 PM Pacific', () => {
      // Monday, January 15, 2024 at 8:00 PM Pacific (04:00 UTC next day)
      const monday8pm = new Date(Date.UTC(2024, 0, 16, 4, 0, 0));
      const result = checkOfficeHours(monday8pm);

      assert.strictEqual(result.isOpen, false, 'Office should be closed at 8 PM');
      assert.strictEqual(result.nextBusinessDay, 'tomorrow', 'Next business day should be tomorrow');
    });
  });

  describe('Weekend - Office Closed', () => {
    it('should return isOpen: false for Saturday noon Pacific', () => {
      // Saturday, January 20, 2024 at 12:00 PM Pacific (20:00 UTC)
      const saturdayNoon = new Date(Date.UTC(2024, 0, 20, 20, 0, 0));
      const result = checkOfficeHours(saturdayNoon);

      assert.strictEqual(result.isOpen, false, 'Office should be closed on Saturday');
      assert.strictEqual(result.currentDay, 'Saturday', 'Day should be Saturday');
      assert.strictEqual(result.nextBusinessDay, 'Monday', 'Next business day should be Monday');
    });

    it('should return isOpen: false for Sunday noon Pacific', () => {
      // Sunday, January 21, 2024 at 12:00 PM Pacific (20:00 UTC)
      const sundayNoon = new Date(Date.UTC(2024, 0, 21, 20, 0, 0));
      const result = checkOfficeHours(sundayNoon);

      assert.strictEqual(result.isOpen, false, 'Office should be closed on Sunday');
      assert.strictEqual(result.currentDay, 'Sunday', 'Day should be Sunday');
      assert.strictEqual(result.nextBusinessDay, 'Monday', 'Next business day should be Monday');
    });

    it('should return isOpen: false for Saturday 10 AM Pacific (during typical business hours)', () => {
      // Saturday, January 20, 2024 at 10:00 AM Pacific (18:00 UTC)
      const saturday10am = new Date(Date.UTC(2024, 0, 20, 18, 0, 0));
      const result = checkOfficeHours(saturday10am);

      assert.strictEqual(result.isOpen, false, 'Office should be closed on Saturday even during typical business hours');
    });

    it('should return isOpen: false for Sunday 3 PM Pacific', () => {
      // Sunday, January 21, 2024 at 3:00 PM Pacific (23:00 UTC)
      const sunday3pm = new Date(Date.UTC(2024, 0, 21, 23, 0, 0));
      const result = checkOfficeHours(sunday3pm);

      assert.strictEqual(result.isOpen, false, 'Office should be closed on Sunday');
    });
  });

  describe('Next Business Day Calculation', () => {
    it('should return "tomorrow" for Monday through Thursday', () => {
      // Monday
      const monday = new Date(Date.UTC(2024, 0, 15, 22, 0, 0)); // 2 PM Pacific
      assert.strictEqual(
        checkOfficeHours(monday).nextBusinessDay,
        'tomorrow',
        'Monday should have tomorrow as next business day',
      );

      // Tuesday
      const tuesday = new Date(Date.UTC(2024, 0, 16, 22, 0, 0));
      assert.strictEqual(
        checkOfficeHours(tuesday).nextBusinessDay,
        'tomorrow',
        'Tuesday should have tomorrow as next business day',
      );

      // Wednesday
      const wednesday = new Date(Date.UTC(2024, 0, 17, 22, 0, 0));
      assert.strictEqual(
        checkOfficeHours(wednesday).nextBusinessDay,
        'tomorrow',
        'Wednesday should have tomorrow as next business day',
      );

      // Thursday
      const thursday = new Date(Date.UTC(2024, 0, 18, 22, 0, 0));
      assert.strictEqual(
        checkOfficeHours(thursday).nextBusinessDay,
        'tomorrow',
        'Thursday should have tomorrow as next business day',
      );
    });

    it('should return "Monday" for Friday after 5 PM', () => {
      // Friday at 6 PM Pacific (02:00 UTC Saturday)
      const fridayEvening = new Date(Date.UTC(2024, 0, 20, 2, 0, 0));
      const result = checkOfficeHours(fridayEvening);

      assert.strictEqual(result.nextBusinessDay, 'Monday', 'Friday evening should have Monday as next business day');
    });

    it('should return "tomorrow" for Friday during business hours', () => {
      // Friday at 10 AM Pacific (18:00 UTC)
      const fridayMorning = new Date(Date.UTC(2024, 0, 19, 18, 0, 0));
      const result = checkOfficeHours(fridayMorning);

      // During business hours on Friday, the office is open so nextBusinessDay should be tomorrow
      // But the logic says day === 5 && hour >= 17 for Monday
      // At 10 AM, hour is 10, not >= 17, so it should be "tomorrow"
      assert.strictEqual(result.nextBusinessDay, 'tomorrow', 'Friday morning should have tomorrow as next business day');
    });

    it('should return "Monday" for Saturday', () => {
      // Saturday at any time
      const saturday = new Date(Date.UTC(2024, 0, 20, 18, 0, 0));
      const result = checkOfficeHours(saturday);

      assert.strictEqual(result.nextBusinessDay, 'Monday', 'Saturday should have Monday as next business day');
    });

    it('should return "Monday" for Sunday', () => {
      // Sunday at any time
      const sunday = new Date(Date.UTC(2024, 0, 21, 18, 0, 0));
      const result = checkOfficeHours(sunday);

      assert.strictEqual(result.nextBusinessDay, 'Monday', 'Sunday should have Monday as next business day');
    });
  });

  describe('Message Content', () => {
    it('should include "open" in message when office is open', () => {
      const monday10am = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
      const result = checkOfficeHours(monday10am);

      assert.ok(
        result.message.includes('currently open'),
        `Message should indicate office is open: "${result.message}"`,
      );
    });

    it('should include "closed" in message when office is closed', () => {
      const saturday = new Date(Date.UTC(2024, 0, 20, 18, 0, 0));
      const result = checkOfficeHours(saturday);

      assert.ok(
        result.message.includes('currently closed'),
        `Message should indicate office is closed: "${result.message}"`,
      );
    });

    it('should include office hours info when closed', () => {
      const saturday = new Date(Date.UTC(2024, 0, 20, 18, 0, 0));
      const result = checkOfficeHours(saturday);

      assert.ok(
        result.message.includes('9 AM to 5 PM'),
        `Message should include office hours: "${result.message}"`,
      );
      assert.ok(
        result.message.includes('Monday through Friday'),
        `Message should mention weekdays: "${result.message}"`,
      );
    });

    it('should include next business day in closed message', () => {
      const sunday = new Date(Date.UTC(2024, 0, 21, 18, 0, 0));
      const result = checkOfficeHours(sunday);

      assert.ok(
        result.message.includes('Monday'),
        `Message should mention next business day: "${result.message}"`,
      );
    });
  });

  describe('Result Structure', () => {
    it('should return all required fields', () => {
      const testDate = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
      const result = checkOfficeHours(testDate);

      assert.ok('isOpen' in result, 'Result should have isOpen field');
      assert.ok('currentTime' in result, 'Result should have currentTime field');
      assert.ok('currentDay' in result, 'Result should have currentDay field');
      assert.ok('nextBusinessDay' in result, 'Result should have nextBusinessDay field');
      assert.ok('message' in result, 'Result should have message field');
    });

    it('should return boolean for isOpen', () => {
      const testDate = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
      const result = checkOfficeHours(testDate);

      assert.strictEqual(typeof result.isOpen, 'boolean', 'isOpen should be a boolean');
    });

    it('should return valid time string', () => {
      const testDate = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
      const result = checkOfficeHours(testDate);

      // Time string should be in format like "10:00 AM"
      assert.ok(
        result.currentTime.includes('AM') || result.currentTime.includes('PM'),
        `Time should include AM/PM: "${result.currentTime}"`,
      );
    });

    it('should return valid day name', () => {
      const validDays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const testDate = new Date(Date.UTC(2024, 0, 15, 18, 0, 0));
      const result = checkOfficeHours(testDate);

      assert.ok(
        validDays.includes(result.currentDay),
        `Day should be a valid day name: "${result.currentDay}"`,
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle date at midnight', () => {
      // Monday at midnight Pacific (08:00 UTC)
      const mondayMidnight = new Date(Date.UTC(2024, 0, 15, 8, 0, 0));
      const result = checkOfficeHours(mondayMidnight);

      assert.strictEqual(result.isOpen, false, 'Office should be closed at midnight');
    });

    it('should work with current date when no argument provided', () => {
      // This test verifies the function works without a date argument
      const result = checkOfficeHours();

      assert.ok('isOpen' in result, 'Should return result when called without date');
      assert.ok(typeof result.isOpen === 'boolean', 'isOpen should be boolean');
    });

    it('should handle year boundary (New Year)', () => {
      // January 1, 2024 is a Monday
      const newYearsDay10am = new Date(Date.UTC(2024, 0, 1, 18, 0, 0));
      const result = checkOfficeHours(newYearsDay10am);

      // New Year's Day is a Monday in 2024, so technically the function would say open
      // (it doesn't account for holidays)
      assert.strictEqual(result.currentDay, 'Monday', 'Should correctly identify New Years Day 2024 as Monday');
    });
  });
});
