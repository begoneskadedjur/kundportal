// Spärr mot besök med negativ längd. Ett sådant besök ritas inte i schemat
// och teknikerns beläggning blir negativ (hänt på BE-0009027 och BE-0009178).
// Databasen har samma spärr (trigger kontrollera_besokstid) som sista skydd.

export const SLUTTID_FORE_START_FEL = 'Sluttid kan inte vara tidigare än starttiden.'

type Tidpunkt = Date | string | null | undefined

export const sluttidForeStart = (start: Tidpunkt, slut: Tidpunkt): boolean => {
  if (!start || !slut) return false
  return new Date(slut).getTime() < new Date(start).getTime()
}
