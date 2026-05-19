import { User } from '@supabase/supabase-js';

export interface Message {
  body: string;
  created_at: string;
  id: string;
  room_id: string;
  user_id: User['id'];
}

export interface MessageWithProfile extends Message {
  profiles: { full_name: null | string; username: string } | null;
}
