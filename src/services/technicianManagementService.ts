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

      const profilesByEmail = new Map(profilesRes.data.map(p => [p.email.toLowerCase(), p]));
      const enrichedData = (techniciansRes.data || []).map(tech => {
        const profile = profilesByEmail.get(tech.email.toLowerCase());
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
      await supabase.from('technicians').update({ is_active: isActive }).eq('id', id);
      await supabase.from('profiles').update({ is_active: isActive }).eq('technician_id', id);
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
      const { data: existingProfile } = await supabase.from('profiles').select('user_id').or(`technician_id.eq.${technicianId},email.eq.${email}`).single();
      if (existingProfile) throw new Error('Personen har redan inloggning aktiverat');
      
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: email, password: password, email_confirm: true,
        user_metadata: { display_name: displayName, role: role, technician_id: technicianId }
      });
      if (authError) throw new Error(`Kunde inte skapa konto: ${authError.message}`);

      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: newAuthUser.user.id, email: email, is_active: true,
        technician_id: technicianId, role: role, display_name: displayName
      });
      if (profileError) {
        await supabase.auth.admin.deleteUser(newAuthUser.user.id);
        throw new Error(`Kunde inte skapa profil: ${profileError.message}`);
      }
      toast.success('Inloggning aktiverat!');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte aktivera inloggning');
      throw error;
    }
  },
  
  async disableTechnicianAuth(technicianId: string): Promise<void> {
    try {
      const { data: profile } = await supabase.from('profiles').select('user_id').eq('technician_id', technicianId).single();
      if (profile) {
        await supabase.from('profiles').delete().eq('technician_id', technicianId);
        await supabase.auth.admin.deleteUser(profile.user_id);
      }
      toast.success('Inloggning inaktiverat!');
    } catch (error: any) {
      toast.error('Kunde inte inaktivera inloggning');
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
      return {
        ...data,
        has_login: !!data.profiles?.user_id,
        user_id: data.profiles?.user_id || null,
        display_name: data.profiles?.display_name || null
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