import { supabase } from '../lib/supabase'

export class CaseNumberService {
  static async generateCaseNumber(): Promise<string> {
    const { data, error } = await supabase.rpc('generate_universal_case_number')
    if (error) throw new Error(`Kunde inte generera ärendenummer: ${error.message}`)
    return data
  }

  /** Generera unikt ärendenummer med retry vid kollision */
  static async generateUniqueCaseNumber(maxRetries = 3): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const caseNumber = await this.generateCaseNumber()

      const [c1, c2, c3] = await Promise.all([
        supabase.from('cases').select('id').eq('case_number', caseNumber).maybeSingle(),
        supabase.from('private_cases').select('id').eq('case_number', caseNumber).maybeSingle(),
        supabase.from('business_cases').select('id').eq('case_number', caseNumber).maybeSingle(),
      ])

      if (!c1.data && !c2.data && !c3.data) {
        return caseNumber
      }
      console.warn(`Ärendenummer ${caseNumber} redan taget, försöker igen (${attempt + 1}/${maxRetries})`)
    }
    throw new Error('Kunde inte generera ett unikt ärendenummer efter flera försök')
  }
}
