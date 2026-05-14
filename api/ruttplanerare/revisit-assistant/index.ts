// 📁 api/ruttplanerare/revisit-assistant/index.ts
// Separat API för återbesöksmodalen — söker bland teknikerna på befintligt ärende.
// Intersection-logik: om flera tekniker skickas visas bara tider där ALLA är lediga.

import { VercelRequest, VercelResponse } from '@vercel/node';
import { startOfDay, addDays, subMinutes, max, min, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import {
    TechnicianDaySchedule, Suggestion, EventSlot,
    getCompetentStaff, getAllActiveStaff, getSchedules, getAbsences, getTravelTimes,
    buildDailySchedules, calculateEfficiencyScore, TIMEZONE, DEFAULT_TRAVEL_TIME
} from '../assistant-utils';

// --- Konfiguration ---
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

  const now = new Date();
  const isToday = daySchedule.date.toDateString() === now.toDateString();
  const minStartTimeToday = isToday ? addMinutes(now, 15) : null;

  for (let i = 0; i < allEvents.length; i++) {
    const currentEvent = allEvents[i]; const nextEvent = allEvents[i + 1];
    const gapStart = currentEvent.end; const gapEnd = nextEvent ? nextEvent.start : daySchedule.workEnd;
    if (gapEnd <= gapStart) continue;

    const travelTime = travelTimes.get(currentEvent.address || daySchedule.technician.address) || DEFAULT_TRAVEL_TIME;
    const isFirstJob = (currentEvent.title === 'Hemadress');

    let baseStartTime = isFirstJob ? daySchedule.workStart : max([addMinutes(gapStart, travelTime), daySchedule.workStart]);
    let currentTry = minStartTimeToday ? max([baseStartTime, minStartTimeToday]) : baseStartTime;

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
        is_first_job: isFirstJob, travel_time_home_minutes: travelTimeHome,
        origin_address: currentEvent.address || daySchedule.technician.address,
        origin_case_title: isFirstJob ? undefined : (currentEvent.title || undefined),
        origin_end_time: isFirstJob ? undefined : currentEvent.end.toISOString()
      });
      currentTry = addMinutes(currentTry, SUGGESTION_STRIDE_MINUTES);
    }
  }
  return suggestions;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Endast POST är tillåtet' }); }
  try {
    const { newCaseAddress, pestType, timeSlotDuration = 60, searchStartDate, selectedTechnicianIds, excludeCaseId } = req.body;
    if (!newCaseAddress) { return res.status(400).json({ error: 'Adress måste anges.' }); }
    if (!selectedTechnicianIds || selectedTechnicianIds.length === 0) { return res.status(400).json({ error: 'Minst en tekniker måste anges.' }); }
    if (timeSlotDuration < 30 || timeSlotDuration > 480) { return res.status(400).json({ error: 'Arbetstid måste vara mellan 30 minuter och 8 timmar.' }); }

    const searchStart = searchStartDate ? startOfDay(new Date(searchStartDate)) : startOfDay(new Date());
    const searchEnd = addDays(searchStart, SEARCH_DAYS_LIMIT);

    // Hämta alla kompetenta tekniker och filtrera sedan på de som är kopplade till ärendet
    const allCompetentStaff = pestType ? await getCompetentStaff(pestType) : await getAllActiveStaff();
    const staffToSearch = allCompetentStaff.filter(staff => selectedTechnicianIds.includes(staff.id));

    // Om ingen av ärendets tekniker hittades bland kompetenta — prova hämta direkt från alla aktiva
    const finalStaff = staffToSearch.length > 0
      ? staffToSearch
      : (await getAllActiveStaff()).filter(s => selectedTechnicianIds.includes(s.id));

    if (finalStaff.length === 0) { return res.status(200).json([]); }

    const staffIds = finalStaff.map(s => s.id);
    console.log(`[revisit-assistant] Söker schema för ${staffIds.length} tekniker: ${finalStaff.map(s => s.name).join(', ')}`);
    console.log(`[revisit-assistant] Datumintervall: ${searchStart.toISOString()} - ${searchEnd.toISOString()}`);

    const [schedules, absences] = await Promise.all([ getSchedules(finalStaff, searchStart, searchEnd), getAbsences(staffIds, searchStart, searchEnd) ]);

    // Exkludera originalärendet från schemaberäkningen så det inte blockerar sin egen tid
    if (excludeCaseId) {
      schedules.forEach((cases, techId) => {
        schedules.set(techId, cases.filter(c => c.caseId !== excludeCaseId));
      });
    }

    let totalCasesFound = 0;
    schedules.forEach((cases, techId) => {
      if (cases.length > 0) {
        const techName = finalStaff.find(s => s.id === techId)?.name || techId;
        console.log(`[revisit-assistant] ${techName}: ${cases.length} ärenden hittade`);
        totalCasesFound += cases.length;
      }
    });
    console.log(`[revisit-assistant] TOTALT: ${totalCasesFound} ärenden hittade för perioden`);

    const allAddresses = new Set<string>(finalStaff.map(s => s.address).filter(Boolean));
    schedules.forEach(cases => cases.forEach(c => { if (c.address) allAddresses.add(c.address); }));

    const travelTimesToJob = await getTravelTimes(Array.from(allAddresses), newCaseAddress);

    const dailySchedules = buildDailySchedules(finalStaff, schedules, absences, searchStart, searchEnd);

    const suggestionPromises = dailySchedules.map(daySchedule => findAvailableSlots(daySchedule, timeSlotDuration, travelTimesToJob, newCaseAddress));
    const nestedSuggestions = await Promise.all(suggestionPromises);
    let allSuggestions = nestedSuggestions.flat();

    // Intersection: om flera tekniker valdes, visa bara tider där ALLA är lediga samtidigt
    if (selectedTechnicianIds.length > 1 && finalStaff.length > 1) {
      const requiredCount = finalStaff.length;
      const grouped = allSuggestions.reduce((acc, s) => {
        const key = s.start_time;
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {} as Record<string, Suggestion[]>);

      allSuggestions = Object.values(grouped)
        .filter(g => g.length >= requiredCount)
        .map(g => ({
          ...g[0],
          technician_name: g.map(s => s.technician_name).join(', '),
          travel_time_minutes: Math.max(...g.map(s => s.travel_time_minutes)),
          efficiency_score: Math.round(g.reduce((sum, s) => sum + s.efficiency_score, 0) / g.length),
        }));
    }

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
    console.error("Fel i återbesöksassistent:", error);
    res.status(500).json({ error: "Ett internt fel uppstod.", details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}
