import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  image_url: string | null;
  read_time: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
}

type BlogPostInput = Omit<BlogPost, "id" | "created_at" | "updated_at">;

const BLOG_POSTS_KEY = ["blog_posts"];

export function useBlogPosts() {
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: BLOG_POSTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BlogPost[];
    },
  });

  const createPost = useMutation({
    mutationFn: async (post: BlogPostInput): Promise<BlogPost> => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .insert(post as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOG_POSTS_KEY });
      toast.success("Artigo criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar artigo: " + error.message);
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...post }: Partial<BlogPost> & { id: string }) => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .update(post as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOG_POSTS_KEY });
      toast.success("Artigo atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar artigo: " + error.message);
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("blog_posts" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOG_POSTS_KEY });
      toast.success("Artigo excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir artigo: " + error.message);
    },
  });

  return { posts, isLoading, createPost, updatePost, deletePost };
}
