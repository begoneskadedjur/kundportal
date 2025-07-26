// 📁 api/ruttplanerare/find-team-assistant.ts
// ⭐ VERSION 1.3 - ANVÄNDER NU DEN KORRIGERADE VERKTYGSLÅDAN FÖR FRÅNVARO

import { VercelRequest, VercelResponse } from '@vercel/node';
import { startOfDay, addDays, addMinutes, subMinutes, areIntervalsOverlapping } from 'date-fns';

import {
    TechnicianDaySchedule, TeamSuggestion,
    getCompetentStaff, getSchedules, getAbsences, getTravelTimes,
    buildDailySchedules, DEFAULT_TRAVEL_TIME
} from './assistant-utils';

// --- Konfiguration ---
const SEARCH_DAYS_LIMIT = 7;
const TIME_SLOT_INCREMENT = 15;
const MAX_TEAM_SUGGESTIONS = 10;

// Hjälpfunktioner specifika för team-sökning
function isAvailable(schedule: TechnicianDaySchedule, slot: { start: Date, end: Date }): boolean {
    const isOverlappingCase = schedule.existingCases.some(c => areIntervalsOverlapping(slot, c));
    const isOverlappingAbsence = schedule.absences.some(a => areIntervalsOverlapping(slot, a));
    return !isOverlappingCase && !isOverlappingAbsence;
}

function getCombinations<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    function combinate(temp: T[], start: number) {
        if (temp.length === size) { result.push([...temp]); return; }
        for (let i = start; i < array.length; i++) { temp.push(array[i]); combinate(temp, i + 1); temp.pop(); }
    }
    combinate([], 0);
    return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { newCaseAddress, pestType, timeSlotDuration = 60, searchStartDate, numberOfTechnicians } = req.body;

    if (!numberOfTechnicians || numberOfTechnicians < 2) {
        return res.status(400).json({ error: 'Denna funktion kräver minst två tekniker.' });
    }

    const searchStart = searchStartDate ? startOfDay(new Date(searchStartDate)) : startOfDay(new Date());
    const searchEnd = addDays(searchStart, SEARCH_DAYS_LIMIT);

    const allCompetentStaff = await getCompetentStaff(pestType);
    if (allCompetentStaff.length < numberOfTechnicians) {
        return res.status(200).json([]);
    }

    const staffIds = allCompetentStaff.map(s => s.id);
    const [schedules, absences] = await Promise.all([ getSchedules(allCompetentStaff, searchStart, searchEnd), getAbsences(staffIds, searchStart, searchEnd) ]);
    const allAddresses = new Set<string>(allCompetentStaff.map(s => s.address).filter(Boolean));
    const travelTimes = await getTravelTimes(Array.from(allAddresses), newCaseAddress);
    
    // Använder den nu korrigerade buildDailySchedules-funktionen
    const allDailySchedules = buildDailySchedules(allCompetentStaff, schedules, absences, searchStart, searchEnd);
    
    const schedulesByDay = allDailySchedules.reduce((acc, s) => {
        const day = s.date.toISOString().split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(s);
        return acc;
    }, {} as Record<string, TechnicianDaySchedule[]>);

    const allTeamSuggestions: TeamSuggestion[] = [];

    for (const day in schedulesByDay) {
        const daySchedules = schedulesByDay[day];
        if (daySchedules.length < numberOfTechnicians) continue;

        const technicianCombinations = getCombinations(daySchedules, numberOfTechnicians);

        for (const teamCombination of technicianCombinations) {
            const referenceSchedule = teamCombination[0];
            let currentTime = referenceSchedule.workStart;

            while (currentTime <= subMinutes(referenceSchedule.workEnd, timeSlotDuration)) {
                const slot = { start: currentTime, end: addMinutes(currentTime, timeSlotDuration) };
                const isTeamAvailable = teamCombination.every(techSchedule => isAvailable(techSchedule, slot));

                if (isTeamAvailable) {
                    let totalTravelTime = 0;
                    const teamDetails = teamCombination.map(ts => {
                        const travel_time_minutes = travelTimes.get(ts.technician.address) || DEFAULT_TRAVEL_TIME;
                        totalTravelTime += travel_time_minutes;
                        return { id: ts.technician.id, name: ts.technician.name, travel_time_minutes, origin_description: "Startar från hemadress" };
                    });
                    
                    allTeamSuggestions.push({
                        technicians: teamDetails,
                        start_time: slot.start.toISOString(),
                        end_time: slot.end.toISOString(),
                        efficiency_score: 200 - totalTravelTime,
                    });
                }
                currentTime = addMinutes(currentTime, TIME_SLOT_INCREMENT);
            }
        }
    }
    
    const sortedSuggestions = allTeamSuggestions
        .sort((a, b) => b.efficiency_score - a.efficiency_score)
        .slice(0, MAX_TEAM_SUGGESTIONS);

    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i team-bokningsassistent:", error);
    res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
  }
}