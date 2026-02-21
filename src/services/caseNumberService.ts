import { supabase } from '../lib/supabase'

export class CaseNumberService {
  static async generateCaseNumber(): Promise<string> {
    const { data, error } = await supabase.rpc('generate_universal_case_number')

    if (error) throw new Error(`Kunde inte generera ärendenummer: ${error.message}`)
    return data
  }
}
