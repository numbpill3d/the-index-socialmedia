export interface Drawer {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Card {
  id: string;
  drawer_id: string;
  title: string;
  url: string;
  description: string;
  submitted_by: string;
  submitted_by_name?: string;
  created_at: string;
  stamp_count: number;
  image_url?: string;
  embed_type: 'none' | 'image' | 'iframe';
  iframe_url?: string;
}

export interface Stamp {
  id: string;
  user_id: string;
  card_id: string;
  created_at: string;
}
