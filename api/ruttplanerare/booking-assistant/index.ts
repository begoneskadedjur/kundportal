// 📁 api/ruttplanerare/booking-assistant/index.ts
// ⭐ VERSION 7.2 - KORRIGERAR SÖKVÄG TILL DELAD LOGIK.

import { VercelRequest, VercelResponse } from '@vercel/node';
import { startOfDay, addDays, subMinutes, max, min } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// ✅ KORRIGERING: Importerar nu från den korrekt namngivna filen på rätt plats.
import { 
    TechnicianDaySchedule, Suggestion, EventSlot,
    getCompetentStaff, getSchedules, getAbsences, getTravelTimes,
    buildDailySchedules, calculateEfficiencyScore, TIMEZONE, DEFAULT_TRAVEL_TIME
} from '../assistant-utils';

// --- Konfiguration (specifik för denna fil) ---
const SEARCH_DAYS_LIMIT = 7;
const SUGGESTION_STRIDE_MINUTES = 60;
const MAX_SUGGESTIONS_TOTAL = 20;
const MAX_SUGGESTIONS_PER_TECH_DAY_HIGH_SCORE = 5;
const MAX_SUGGESTIONS_PER_TECH_DAY_LOW_SCORE = 2;
const HIGH_SCORE_THRESHOLD = 80;
const LATE_JOB_THRESHOLD_MINUTES = 90;

async function findAvailableSlots(daySchedule: TechnicianDaySchedule, timeSlotDuration: number, travelTimes: Map<string, number>, newCaseAddress: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const lastPossibleStartForJob = subMinutes(daySchedule.workEnd, timeSlotDuration);
  const virtualStartEvent: EventSlot = { start: subMinutes(daySchedule.workStart, 1), end: daySchedule.workStart, type: 'case', title: 'Hemadress', address: daySchedule.technician.address };
  const allEvents = [ virtualStartEvent, ...daySchedule.existingCases, ...daySchedule.absences.map(a => ({ start: a.start, end: a.end, type: 'absence' as const, title: 'Frånvaro' })) ].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  for (let i = 0; i < allEvents.length; i++) {
    const currentEvent = allEvents[i]; const nextEvent = allEvents[i + 1];
    const gapStart = currentEvent.end; const gapEnd = nextEvent ? nextEvent.start : daySchedule.workEnd;
    if (gapEnd <= gapStart) continue;

    const travelTime = travelTimes.get(currentEvent.address || daySchedule.technician.address) || DEFAULT_TRAVEL_TIME;
    const isFirstJob = (currentEvent.title === 'Hemadress');
    let currentTry = isFirstJob ? daySchedule.workStart : max([addMinutes(gapStart, travelTime), daySchedule.workStart]);
    const absoluteLatestStart = min([subMinutes(gapEnd, timeSlotDuration), lastPossibleStartForJob]);
    const isLastGap = !nextEvent;

    while (currentTry <= absoluteLatestStart) {
      const slotEnd = addMinutes(currentTry, timeSlotDuration);
      let travelTimeHome: number | undefined = undefined;
      let originDescription = '';
      const isLateJob = slotEnd >= subMinutes(daySchedule.workEnd, LATE_JOB_THRESHOLD_MINUTES);

      if (isLastGap && isLateJob) {
          const homeTravelTimes = await getTravelTimes([newCaseAddress], daySchedule.technician.address);
          travelTimeHome = homeTravelTimes.get(newCaseAddress);
      }
      
      const arrivalTimeStr = formatInTimeZone(currentTry, TIMEZONE, 'HH:mm');
      if (isFirstJob) {
          originDescription = `Från hemadress (Ankomst beräknad kl. ${arrivalTimeStr})`;
      } else {
          const prevEndTimeStr = formatInTimeZone(currentEvent.end, TIMEZONE, 'HH:mm');
          const prevEventTitle = currentEvent.title ? `"${currentEvent.title.substring(0, 20)}..."` : "föregående ärende";
          originDescription = `Efter ${prevEventTitle} (slutar ${prevEndTimeStr}). Ankomst beräknad kl. ${arrivalTimeStr} (+${travelTime} min restid).`;
      }
      if (travelTimeHome !== undefined) {
          originDescription += ` Sista jobbet för dagen (Beräknad hemresa: ${travelTimeHome} min).`;
      }
      
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / 60000;
      const usedDuration = timeSlotDuration + (isFirstJob ? 0 : travelTime);
      const gapUtilization = gapDuration > 0 ? Math.min(1, usedDuration / gapDuration) : 1;
      
      suggestions.push({
        technician_id: daySchedule.technician.id, technician_name: daySchedule.technician.name,
        start_time: currentTry.toISOString(), end_time: slotEnd.toISOString(),
        travel_time_minutes: travelTime, origin_description: originDescription,
        efficiency_score: calculateEfficiencyScore(travelTime, isFirstJob, gapUtilization, travelTimeHome), 
        is_first_job: isFirstJob, travel_time_home_minutes: travelTimeHome
      });
      currentTry = addMinutes(currentTry, SUGGESTION_STRIDE_MINUTES);
    }
  }
  return suggestions;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Endast POST är tillåtet' }); }
  try {
    const { newCaseAddress, pestType, timeSlotDuration = 60, searchStartDate, selectedTechnicianIds } = req.body;
    if (!newCaseAddress || !pestType) { return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' }); }
    if (timeSlotDuration < 30 || timeSlotDuration > 480) { return res.status(400).json({ error: 'Arbetstid måste vara mellan 30 minuter och 8 timmar.' }); }

    const searchStart = searchStartDate ? startOfDay(new Date(searchStartDate)) : startOfDay(new Date());
    const searchEnd = addDays(searchStart, SEARCH_DAYS_LIMIT);
    const allCompetentStaff = await getCompetentStaff(pestType);
    if (allCompetentStaff.length === 0) { return res.status(200).json([]); }

    const staffToSearch = selectedTechnicianIds?.length > 0 ? allCompetentStaff.filter(staff => selectedTechnicianIds.includes(staff.id)) : allCompetentStaff;
    if (staffToSearch.length === 0) { return res.status(200).json([]); }
    
    const staffIds = staffToSearch.map(s => s.id);
    const [schedules, absences] = await Promise.all([ getSchedules(staffToSearch, searchStart, searchEnd), getAbsences(staffIds, searchStart, searchEnd) ]);
    const allAddresses = new Set<string>(staffToSearch.map(s => s.address).filter(Boolean));
    schedules.forEach(cases => cases.forEach(c => { if (c.address) allAddresses.add(c.address); }));
    
    const travelTimesToJob = await getTravelTimes(Array.from(allAddresses), newCaseAddress);
    const dailySchedules = buildDailySchedules(staffToSearch, schedules, absences, searchStart, searchEnd);
    
    const suggestionPromises = dailySchedules.map(daySchedule => findAvailableSlots(daySchedule, timeSlotDuration, travelTimesToJob, newCaseAddress));
    const nestedSuggestions = await Promise.all(suggestionPromises);
    const allSuggestions = nestedSuggestions.flat();
    
    const groupedByDayAndTech = allSuggestions.reduce((acc, sugg) => {
        const day = sugg.start_time.split('T')[0];
        const key = `${day}-${sugg.technician_id}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(sugg);
        return acc;
    }, {} as Record<string, Suggestion[]>);

    let balancedSuggestions: Suggestion[] = [];
    for (const key in groupedByDayAndTech) {
        const group = groupedByDayAndTech[key].sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        const score = group[0].efficiency_score;
        const limit = score >= HIGH_SCORE_THRESHOLD ? MAX_SUGGESTIONS_PER_TECH_DAY_HIGH_SCORE : MAX_SUGGESTIONS_PER_TECH_DAY_LOW_SCORE;
        balancedSuggestions.push(...group.slice(0, limit));
    }
    
    const sortedSuggestions = balancedSuggestions
      .sort((a, b) => {
        const dateA = new Date(a.start_time).setHours(0,0,0,0);
        const dateB = new Date(b.start_time).setHours(0,0,0,0);
        if (dateA !== dateB) return dateA - dateB;
        if (a.efficiency_score !== b.efficiency_score) return b.efficiency_score - a.efficiency_score;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      })
      .slice(0, MAX_SUGGESTIONS_TOTAL);
    
    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i bokningsassistent (v7.2):", error);
    res.status(500).json({ error: "Ett internt fel uppstod.", details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}