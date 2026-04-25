import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const addToWaitlist = async (email) => {
  try {
    const { data: result, error } = await supabase
      .from('waitlist')
      .insert([
        {
          email: email,
        }
      ])
      .select();

    if (error) {
      throw error;
    }
    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    return { success: false, error: error.message };
  }
};

export const checkEmailExists = async (email) => {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (error) { 
      throw error;
    }

    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false, error: error.message };
  }
};

export const getWaitlistCount = async () => {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return { count: count || 0, error: null };
  } catch (error) {
    console.error('Error getting waitlist count:', error);
    return { count: 0, error: error.message };
  }
};

// ============================================
// EMPLOYEE PROFILES (name, position, department)
// Table: employee_profiles (wallet_address, emp_id, name, position, department, email)
// ============================================

export const upsertEmployeeProfile = async (profile) => {
  try {
    const { data, error } = await supabase
      .from('employee_profiles')
      .upsert([{
        wallet_address: profile.walletAddress,
        emp_id: profile.empId || null,
        name: profile.name || null,
        position: profile.position || null,
        department: profile.department || null,
        email: profile.email || null,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'wallet_address' })
      .select();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error upserting employee profile:', error);
    return { success: false, error: error.message };
  }
};

export const getEmployeeProfile = async (walletAddress) => {
  try {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    return { success: false, error: error.message };
  }
};
