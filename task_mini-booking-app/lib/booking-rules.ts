import { TZDate } from "@date-fns/tz";

const LONDON_TIME_ZONE = "Europe/London";
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 18 * 60;
const SLOT_INTERVAL_MINUTES = 30;

type ExistingBooking = {
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
};

type AvailabilityOptions = {
  date: string; // London calendar date, formatted YYYY-MM-DD
  durationMinutes: number;
  existingBookings: ExistingBooking[];
  now?: Date; // Optional clock makes the rule easier to verify later
};

function parseLondonDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Noon avoids midnight edge cases. TZDate interprets these as London time.
  const londonDate = new TZDate(
    year,
    month - 1,
    day,
    12,
    0,
    LONDON_TIME_ZONE
  );

  // Reject impossible dates such as 2026-02-31.
  if (
    londonDate.getFullYear() !== year ||
    londonDate.getMonth() !== month - 1 ||
    londonDate.getDate() !== day
  ) {
    return null;
  }

  return { year, monthIndex: month - 1, day, londonDate };
}

export function getAvailableStartTimes({
  date,
  durationMinutes,
  existingBookings,
  now = new Date(),
}: AvailabilityOptions): string[] {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return [];
  }

  const parsedDate = parseLondonDate(date);
  if (!parsedDate) return [];

  const { year, monthIndex, day, londonDate } = parsedDate;

  // Sunday is closed. Monday through Saturday are open.
  if (londonDate.getDay() === 0) return [];

  const latestStartMinutes = CLOSE_MINUTES - durationMinutes;
  const availableTimes: string[] = [];

  for (
    let startMinutes = OPEN_MINUTES;
    startMinutes <= latestStartMinutes;
    startMinutes += SLOT_INTERVAL_MINUTES
  ) {
    const hours = Math.floor(startMinutes / 60);
    const minutes = startMinutes % 60;

    const start = new TZDate(
      year,
      monthIndex,
      day,
      hours,
      minutes,
      LONDON_TIME_ZONE
    );
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    // Reject start times that have already passed.
    if (start.getTime() <= now.getTime()) continue;

    const conflicts = existingBookings.some((booking) => {
      if (booking.status !== "booked") return false;

      const bookingStart = new Date(booking.startsAt).getTime();
      const bookingEnd = new Date(booking.endsAt).getTime();

      // Intervals overlap when each one starts before the other one ends.
      return start.getTime() < bookingEnd && end.getTime() > bookingStart;
    });

    if (!conflicts) {
      availableTimes.push(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
      );
    }
  }

  return availableTimes;
}