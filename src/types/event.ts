export interface Event {
  id?: string;
  type: 'appointment' | 'class' | 'vacation';
  datetime: string;
  duration: number;
  day?: number;
  time?: string | null;
  client?: string[];
  professional?: string[];
  company: string;
  cost: number;
  paid: boolean;
  notes?: string;
  created?: string;
  updated?: string;
  expand?: {
    professional?: any[] | any;
    client?: any[] | any;
  };
}
