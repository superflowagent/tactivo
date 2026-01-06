export interface Cliente {
  id?: string;
  name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
  company: string;
  session_credits?: number;
  class_credits?: number;
  photo?: string;
  photo_path?: string | null;
  photoUrl?: string | null;
  birth_date?: string;
  address?: string;
  occupation?: string;
  sport?: string;
  history?: string;
  diagnosis?: string;
  allergies?: string;
  notes?: string;
}
