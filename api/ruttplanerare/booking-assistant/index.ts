// api/ruttplanerare/booking-assistant/index.ts
// VERSION 4.2 – FÖRSTA RESA PLANERAS, ANVÄNDER RESTID, START KL 08

import { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- KONFIGURATION ---
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;
const SEARCH_DAYS_LIMIT = 14;

// --- TYPER ---
interface StaffMember { id: string; name: string; address: string; }
interface CaseInfo { start: Date; end: Date; title: string; adress: any; }
interface Suggestion {
  technician_id: string;
  technician_name: string;
  start_time: string;            // ISO-sträng
  end_time: string;              // ISO-sträng
  travel_time_minutes: number;   // alltid med i första slot
  origin_description: string;    // t.ex. "Hemadress" eller titel på föregående case
}

// --- HJÄLPFUNKTIONER ---
const formatAddress = (address: any): string => {
  if (!address) return "";
  if (typeof address === "object" && address.formatted_address) {
    return address.formatted_address;
  }
  return String(address);
};

// --- HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Endast POST är tillåtet" });
  }

  try {
    const {
      newCaseAddress,
      pestType,
      timeSlotDuration = 120,
      searchStartDate
    } = req.body;
    if (!newCaseAddress || !pestType) {
      return res.status(400).json({ error: "Adress och skadedjurstyp måste anges." });
    }

    // 1) Techniker med rätt kompetens
    const staffList = await getCompetentStaff(pestType);
    if (staffList.length === 0) {
      return res.status(200).json([]);
    }

    // 2) Sök-intervall
    const startDate = searchStartDate
      ? new Date(searchStartDate)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + SEARCH_DAYS_LIMIT);

    // 3) Hämta befintliga ärenden per tekniker
    const schedules = await getSchedules(staffList, startDate, endDate);

    // 4) Förbered restids-API: alla hem- och case-adresser
    const allOrigins = Array.from(schedules.values())
      .flat()
      .map(c => formatAddress(c.adress))
      .concat(staffList.map(s => s.address));
    const travelTimes = await getTravelTimes(
      Array.from(new Set(allOrigins)),
      newCaseAddress
    );

    const suggestions: Suggestion[] = [];

    // 5) Loop dag för dag
    for (let dayOffset = 0; dayOffset < SEARCH_DAYS_LIMIT; dayOffset++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + dayOffset);

      // --- IGNORERA HELGER ---
      const wd = current.getDay();
      if (wd === 0 || wd === 6) continue;

      // Arbetsdagens start/slut
      const workStart = new Date(current);
      workStart.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
      const workEnd = new Date(current);
      workEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

      // 6) För varje tekniker: hitta luckor
      for (const tech of staffList) {
        const techCases = (schedules.get(tech.id) || []).sort(
          (a, b) => a.start.getTime() - b.start.getTime()
        );

        // Varje "lucka" mellan föregående sluttid och nästa starttid
        for (let idx = 0; idx <= techCases.length; idx++) {
          // 6a) Bestäm föregående event
          let prevEnd: Date;
          let originDesc: string;
          let originAddr: string;

          if (idx === 0) {
            // Första luckan: hemifrån → arbetsdagens start
            prevEnd = workStart;
            originDesc = "Hemadress";
            originAddr = tech.address;
          } else {
            const prevCase = techCases[idx - 1];
            prevEnd = prevCase.end;
            originDesc = prevCase.title;
            originAddr = formatAddress(prevCase.adress) || tech.address;
          }

          // 6b) Bestäm när nästa jobb börjar (eller slut på dagen)
          const nextStart =
            idx < techCases.length ? techCases[idx].start : workEnd;

          // 6c) ALLTID beräkna restid (även för första slot)
          const travelMin = travelTimes.get(originAddr) ?? 999;
          if (travelMin === 999) continue;  // ingen restids-info → hoppa

          // 6d) Bestäm starttid för slot
          let slotStart: Date;
          if (idx === 0) {
            // alltid arbetsdagens start (tekniker planerad att anlända 08:00)
            slotStart = workStart;
          } else {
            // vanlig lucka efter ett case
            const arrival = new Date(prevEnd.getTime() + travelMin * 60000);
            slotStart = new Date(Math.max(arrival.getTime(), workStart.getTime()));
          }

          const slotEnd = new Date(slotStart.getTime() + timeSlotDuration * 60000);

          // 6e) Kontrollera att slot ryms före nästa jobb
          if (slotEnd.getTime() <= nextStart.getTime()) {
            suggestions.push({
              technician_id: tech.id,
              technician_name: tech.name,
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              travel_time_minutes: travelMin,
              origin_description: originDesc
            });
          }
        }
      }
    }

    // 7) Filtrera unika + sortera på tid och restid
    const uniq = new Map<string, Suggestion>();
    for (const s of suggestions) {
      const key = `${s.technician_id}-${s.start_time}`;
      if (!uniq.has(key)) uniq.set(key, s);
    }
    const sorted = Array.from(uniq.values()).sort((a, b) => {
      const da = new Date(a.start_time).getTime();
      const db = new Date(b.start_time).getTime();
      if (da !== db) return da - db;
      return a.travel_time_minutes - b.travel_time_minutes;
    });

    return res.status(200).json(sorted.slice(0, 5));
  } catch (err: any) {
    console.error("Fel i bokningsassistent:", err);
    return res
      .status(500)
      .json({ error: "Ett internt fel uppstod.", details: err.message });
  }
}

// --- HJÄLPFUNKTIONER ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff_competencies")
    .select("technicians(id, name, address)")
    .eq("pest_type", pestType);
  if (error) throw error;
  return data
    .map((r: any) => r.technicians as StaffMember)
    .filter((t) => t.address && t.address.trim() !== "");
}

async function getSchedules(
  staff: StaffMember[],
  from: Date,
  to: Date
): Promise<Map<string, CaseInfo[]>> {
  const ids = staff.map((s) => s.id);
  const { data, error } = await supabase
    .from("cases_with_technician_view")
    .select("start_date, due_date, technician_id, adress, title")
    .in("technician_id", ids)
    .gte("start_date", from.toISOString())
    .lte("start_date", to.toISOString());
  if (error) throw error;

  const map = new Map<string, CaseInfo[]>();
  staff.forEach((s) => map.set(s.id, []));
  data.forEach((c: any) => {
    if (c.start_date && c.due_date) {
      map.get(c.technician_id)!.push({
        start: new Date(c.start_date),
        end: new Date(c.due_date),
        title: c.title,
        adress: c.adress,
      });
    }
  });
  return map;
}

async function getTravelTimes(
  origins: string[],
  destination: string
): Promise<Map<string, number>> {
  if (origins.length === 0) return new Map();
  const apiKey = encodeURIComponent(process.env.GOOGLE_MAPS_API_KEY!);
  const origParam = origins.map(encodeURIComponent).join("|");
  const destParam = encodeURIComponent(destination);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origParam}&destinations=${destParam}&key=${apiKey}`;

  const resp = await fetch(url);
  const json = (await resp.json()) as any;
  if (json.status !== "OK") {
    console.error("Google Maps API-fel:", json);
    throw new Error("Fel från Google Maps API: " + json.status);
  }

  const result = new Map<string, number>();
  json.rows.forEach((row: any, i: number) => {
    const orig = origins[i];
    if (row.elements[0]?.status === "OK") {
      result.set(orig, Math.round(row.elements[0].duration.value / 60));
    }
  });
  return result;
}
