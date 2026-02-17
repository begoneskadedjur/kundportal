import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { PestType } from '../utils/clickupFieldMapper' 

// --- TYPDEFINITIONER ---

// ✅ NYA TYPER FÖR DET FLEXIBLA ARBETSSCHEMAT
export type DaySchedule = {
  start: string; // Format "HH:MM"
  end: string;   // Format "HH:MM"
  active: boolean;
};

export type WorkSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};


// ✅ TEKNIKER-TYPEN ÄR UPPDATERAD MED work_schedule
export type Technician = {
  id: string
  name: string
  role: string
  email: string
  direct_phone: string | null
  office_phone: string | null
  address: string | null
  abax_vehicle_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  work_schedule: WorkSchedule | null // ✅ FÄLT TILLAGT
  has_login?: boolean
  user_id?: string | null
  display_name?: string | null
}

export type TechnicianFormData = {
  name: string
  role: string
  email: string
  direct_phone: string
  office_phone: string
  address: string
  abax_vehicle_id: string
}

export type TechnicianStats = {
  total: number
  active: number
  withLogin: number
  byRole: Record<string, number>
}

export const technicianManagementService = {

  /**
   * ✅ NY FUNKTION: Uppdaterar en teknikers arbetsschema i databasen.
   */
  async updateWorkSchedule(technicianId: string, schedule: WorkSchedule): Promise<void> {
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ work_schedule: schedule })
        .eq('id', technicianId);

      if (error) {
        throw error;
      }
      toast.success('Arbetsschemat har uppdaterats!');
    } catch (error: any) {
      console.error('Error updating work schedule:', error);
      toast.error('Kunde inte spara det nya arbetsschemat.');
      throw error;
    }
  },

  // --- KOMPETENS-FUNKTIONER ---
  /**
   * Hämta en persons specifika kompetenser.
   */
  async getCompetencies(staffId: string): Promise<PestType[]> {
    try {
      const { data, error } = await supabase
        .from('staff_competencies')
        .select('pest_type')
        .eq('staff_id', staffId)
      
      if (error) throw error;
      
      return data.map(item => item.pest_type as PestType);
    } catch (error) {
      console.error('Error fetching competencies:', error);
      toast.error('Kunde inte hämta kompetenser.');
      return [];
    }
  },

  /**
   * Uppdatera en persons hela kompetenslista.
   */
  async updateCompetencies(staffId: string, competencies: PestType[]): Promise<void> {
    try {
      await supabase.from('staff_competencies').delete().eq('staff_id', staffId);

      if (competencies.length > 0) {
        const rowsToInsert = competencies.map(pest => ({
          staff_id: staffId,
          pest_type: pest
        }));
        await supabase.from('staff_competencies').insert(rowsToInsert);
      }
      // Ingen toast här, det sköts av anropande funktion
    } catch (error) {
      console.error('Error updating competencies:', error);
      toast.error('Ett fel uppstod vid sparande av kompetenser.');
      throw error;
    }
  },
  
  // --- Befintliga funktioner nedan (kompletta och oförändrade) ---

  async getAllTechnicians(): Promise<Technician[]> {
    try {
      const [techniciansRes, profilesRes] = await Promise.all([
        supabase.from('technicians').select('*').order('name', { ascending: true }),
        supabase.from('profiles').select('user_id, email, display_name, technician_id')
      ]);
      if (techniciansRes.error) throw techniciansRes.error;
      if (profilesRes.error) throw profilesRes.error;

      // Bygg två index: FK-baserat (tekniker/koordinator) + email-baserat (admins, som har technician_id=NULL)
      const profilesByTechId = new Map(
        profilesRes.data.filter(p => p.technician_id).map(p => [p.technician_id, p])
      );
      const profilesByEmail = new Map(
        profilesRes.data.map(p => [p.email.toLowerCase(), p])
      );

      const enrichedData = (techniciansRes.data || []).map(tech => {
        // Primärt: matcha via FK (tekniker/koordinator)
        // Fallback: matcha via email (admins — check constraint tvingar technician_id=NULL för admin-profiler)
        const profile = profilesByTechId.get(tech.id) || profilesByEmail.get(tech.email.toLowerCase()) || null;
        return {
          ...tech,
          has_login: !!profile,
          user_id: profile?.user_id || null,
          display_name: profile?.display_name || tech.name
        };
      });
      return enrichedData;
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      toast.error('Kunde inte hämta personal');
      throw error;
    }
  },
  
  async createTechnician(technicianData: TechnicianFormData): Promise<Technician> {
    try {
      const formatPhone = (phone: string) => phone ? phone.replace(/[\s-]/g, '').replace(/^0/, '+46') : null;
      const insertData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        abax_vehicle_id: technicianData.abax_vehicle_id.trim() || null,
        is_active: true
      };
      const { data, error } = await supabase.from('technicians').insert(insertData).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('En person med denna e-postadress finns redan');
        throw error;
      }
      toast.success('Personal skapad!');
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte skapa person');
      throw error;
    }
  },

  async updateTechnician(id: string, technicianData: TechnicianFormData): Promise<Technician> {
    try {
      const { data: oldTechnician } = await supabase.from('technicians').select('name').eq('id', id).single();
      const formatPhone = (phone: string) => phone ? phone.replace(/[\s-]/g, '').replace(/^0/, '+46') : null;
      const updateData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        abax_vehicle_id: technicianData.abax_vehicle_id.trim() || null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('technicians').update(updateData).eq('id', id).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('En person med denna e-postadress finns redan');
        throw error;
      }
      if (oldTechnician && oldTechnician.name !== data.name) {
        await this.updateTechnicianNameInCases(oldTechnician.name, data.name);
        // Synka display_name i profiles om den fortfarande matchar det gamla namnet
        await supabase
          .from('profiles')
          .update({ display_name: data.name })
          .eq('technician_id', id)
          .eq('display_name', oldTechnician.name);
      }
      toast.success('Personal uppdaterad!');
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte uppdatera person');
      throw error;
    }
  },

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    if (!userId) {
      toast.error("Användar-ID saknas.");
      throw new Error("User ID is missing.");
    }
    if (newPassword.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken.");
      throw new Error("Password too short.");
    }
    try {
      // Använd API-route istället för direkt admin-anrop
      // (admin API kräver service_role key som inte ska exponeras i frontend)
      const response = await fetch('/api/update-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          new_password: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte uppdatera lösenordet');
      }

      toast.success("Lösenordet har uppdaterats!");
    } catch (error: any) {
      toast.error(`Kunde inte uppdatera lösenordet: ${error.message}`);
      throw error;
    }
  },
  
  async updateTechnicianNameInCases(oldName: string, newName: string): Promise<void> {
    try {
      console.log(`🔄 Updating staff name in cases: "${oldName}" → "${newName}"`);
      await Promise.all([
        supabase.from('private_cases').update({ primary_assignee_name: newName }).eq('primary_assignee_name', oldName),
        supabase.from('private_cases').update({ secondary_assignee_name: newName }).eq('secondary_assignee_name', oldName),
        supabase.from('private_cases').update({ tertiary_assignee_name: newName }).eq('tertiary_assignee_name', oldName),
        supabase.from('business_cases').update({ primary_assignee_name: newName }).eq('primary_assignee_name', oldName),
        supabase.from('business_cases').update({ secondary_assignee_name: newName }).eq('secondary_assignee_name', oldName),
        supabase.from('business_cases').update({ tertiary_assignee_name: newName }).eq('tertiary_assignee_name', oldName),
        supabase.from('cases').update({ assigned_technician_name: newName }).eq('assigned_technician_name', oldName),
        supabase.from('visits').update({ technician_name: newName }).eq('technician_name', oldName)
      ]);
    } catch (error) {
      console.error('Error updating staff name in cases:', error);
    }
  },

  async toggleTechnicianStatus(id: string, isActive: boolean): Promise<void> {
    try {
      const { data: tech } = await supabase.from('technicians').update({ is_active: isActive }).eq('id', id).select('email').single();
      // Uppdatera profil — försök via FK först, sedan via email (för admins)
      const { count } = await supabase.from('profiles').update({ is_active: isActive }).eq('technician_id', id).select('*', { count: 'exact', head: true });
      if (count === 0 && tech?.email) {
        await supabase.from('profiles').update({ is_active: isActive }).eq('email', tech.email);
      }
      toast.success(`Personal ${isActive ? 'aktiverad' : 'inaktiverad'}`);
    } catch (error: any) {
      toast.error('Kunde inte uppdatera status');
      throw error;
    }
  },

  async deleteTechnician(id: string): Promise<void> {
    try {
      const response = await fetch('/api/delete-technician', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician_id: id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte ta bort person');
      }

      toast.success('Personal borttagen permanent');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte ta bort person');
      throw error;
    }
  },
  
  async enableTechnicianAuth(technicianId: string, email: string, password: string, displayName: string, role: string): Promise<void> {
    try {
      // Använd API-route istället för direkt admin-anrop
      // (admin API kräver service_role key som inte ska exponeras i frontend)
      const response = await fetch('/api/enable-technician-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician_id: technicianId,
          email: email,
          password: password,
          display_name: displayName,
          role: role
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte aktivera inloggning');
      }

      toast.success('Inloggning aktiverat!');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte aktivera inloggning');
      throw error;
    }
  },

  async disableTechnicianAuth(technicianId: string): Promise<void> {
    try {
      // API:et hanterar allt server-side: slår upp user_id, raderar profil + auth-user
      const response = await fetch('/api/disable-technician-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_id: technicianId })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Kunde inte inaktivera inloggning');
      }

      toast.success('Inloggning inaktiverat!');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte inaktivera inloggning');
      throw error;
    }
  },
  
  async getTechnicianStats(): Promise<TechnicianStats> {
    try {
      const technicians = await this.getAllTechnicians();
      return {
        total: technicians.length,
        active: technicians.filter(t => t.is_active).length,
        withLogin: technicians.filter(t => t.has_login).length,
        byRole: technicians.reduce((acc, tech) => {
          acc[tech.role] = (acc[tech.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      return { total: 0, active: 0, withLogin: 0, byRole: {} };
    }
  },

  async getTechnicianById(id: string): Promise<Technician> {
    try {
      const { data, error } = await supabase.from('technicians').select(`*, profiles!profiles_technician_id_fkey(user_id, is_active, display_name)`).eq('id', id).single();
      if (error) throw error;

      // FK-join hittar tekniker/koordinator-profiler
      // Men admin-profiler har technician_id=NULL (pga check constraint) — fallback till email-matchning
      let profile = data.profiles;
      if (!profile?.user_id) {
        const { data: emailProfile } = await supabase
          .from('profiles')
          .select('user_id, is_active, display_name')
          .eq('email', data.email)
          .single();
        if (emailProfile) profile = emailProfile;
      }

      return {
        ...data,
        has_login: !!profile?.user_id,
        user_id: profile?.user_id || null,
        display_name: profile?.display_name || data.name
      };
    } catch (error: any) {
      console.error('Error fetching staff member:', error);
      throw error;
    }
  },

  async validateTechnicianNameConsistency(): Promise<any> {
    try {
      const { data: technicians } = await supabase.from('technicians').select('name');
      const technicianNames = new Set(technicians?.map(t => t.name) || []);
      const [privateNames] = await Promise.all([
        supabase.from('private_cases').select('primary_assignee_name').not('primary_assignee_name', 'is', null)
      ]);
      const inconsistencies: Array<{ technician_name: string, table: string, count: number }> = [];
      const privateMap = new Map<string, number>();
      privateNames.data?.forEach(row => {
        const name = row.primary_assignee_name;
        if (name && !technicianNames.has(name)) {
          privateMap.set(name, (privateMap.get(name) || 0) + 1);
        }
      });
      privateMap.forEach((count, name) => {
        inconsistencies.push({ technician_name: name, table: 'private_cases', count });
      });
      return { inconsistencies, suggestions: [] };
    } catch (error) {
      return { inconsistencies: [], suggestions: ['Kunde inte validera namn-konsistens'] };
    }
  },

  formatPhoneForDisplay(phone: string | null): string {
    if (!phone) return '-';
    if (phone.startsWith('+46')) {
      const number = phone.slice(3);
      return `0${number.slice(0, 2)}-${number.slice(2, 5)} ${number.slice(5, 7)} ${number.slice(7)}`;
    }
    return phone;
  },

  formatPhoneForLink(phone: string | null): string | null {
    if (!phone) return null;
    return phone;
  }
}