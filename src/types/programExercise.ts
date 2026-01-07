export interface ExerciseRef {
  id: string;
  name?: string;
  description?: string;
  file?: string;
  company?: string;
}

export interface ProgramExercise {
  id?: string;
  tempId?: string;
  program: string;
  exercise: ExerciseRef;
  company?: string;
  position?: number;
  notes?: string | null;
  day?: string | null;
  reps?: number | null;
  sets?: number | null;
  weight?: number | null;
  secs?: number | null;
  created_at?: string;
}
