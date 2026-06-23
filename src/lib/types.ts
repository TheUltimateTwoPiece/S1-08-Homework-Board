export type UserRole = "student" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "full_name">;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: Pick<Profile, "full_name">;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  created_by: string;
  read_at: string | null;
  created_at: string;
};

export type PostCompletion = {
  id: string;
  post_id: string;
  user_id: string;
  completed_at: string;
};
