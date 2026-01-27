export interface Company {
  id: string;
  name: string;
  max_class_assistants: number;
  class_block_mins: number;
  class_unenroll_mins: number;
  logo_path?: string;
  domain?: string;
  open_time: string;
  close_time: string;
  default_appointment_duration: number;
  default_class_duration: number;
  /** Permite que los clientes auto-programen citas según disponibilidad */
  self_schedule?: boolean;
  created?: string;
  updated?: string;
}
