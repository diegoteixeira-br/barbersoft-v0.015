import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, Download, Bell } from "lucide-react";
import { useBlogPosts, type BlogPost } from "@/hooks/useBlogPosts";
import { BlogPostFormModal } from "@/components/admin/BlogPostFormModal";
import { blogPosts as staticPosts } from "@/data/blogPosts";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminBlog() {
  const { posts, isLoading, createPost, updatePost, deletePost } = useBlogPosts();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [notifying, setNotifying] = useState<string | null>(null);

  const notifyUsers = async (post: { title: string; slug: string; excerpt?: string | null; image_url?: string | null }) => {
    setNotifying(post.slug);
    try {
      const { data, error } = await supabase.functions.invoke("notify-blog-post", {
        body: { title: post.title, slug: post.slug, excerpt: post.excerpt, image_url: post.image_url },
      });
      if (error) throw error;
      toast.success(`Notificação enviada! ${data.sent} email(s) enviado(s)${data.failed ? `, ${data.failed} falha(s)` : ""}`);
    } catch (err: any) {
      toast.error("Erro ao notificar: " + (err.message || "Erro desconhecido"));
    } finally {
      setNotifying(null);
    }
  };

  const handleSave = (data: any) => {
    if (data.id) {
      updatePost.mutate(data, { onSuccess: () => setFormOpen(false) });
    } else {
      createPost.mutate(data, {
        onSuccess: (newPost) => {
          setFormOpen(false);
          // Auto-notify on new post creation
          if (newPost) {
            notifyUsers(newPost);
          }
        },
      });
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingPost(null);
    setFormOpen(true);
  };

  const handleImportLegacy = async () => {
    setImporting(true);
    try {
      const existingSlugs = posts.map(p => p.slug);
      const toImport = staticPosts.filter(sp => !existingSlugs.includes(sp.slug));
      
      if (toImport.length === 0) {
        toast.info("Todos os artigos legados já foram importados.");
        setImporting(false);
        return;
      }

      const rows = toImport.map(sp => ({
        slug: sp.slug,
        title: sp.title,
        excerpt: sp.excerpt,
        content: sp.content.trim(),
        category: sp.category,
        image_url: sp.image,
        read_time: sp.readTime,
        author: sp.author,
      }));

      const { error } = await supabase.from("blog_posts" as any).insert(rows as any);
      if (error) throw error;

      toast.success(`${toImport.length} artigo(s) importado(s) com sucesso!`);
      // Refresh the list
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const legacySlugs = staticPosts.map(sp => sp.slug);
  const hasUnimportedLegacy = legacySlugs.some(slug => !posts.map(p => p.slug).includes(slug));

  const confirmDelete = () => {
    if (deleteId) {
      deletePost.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gerenciador de Blog</h1>
            <p className="text-slate-400">Crie e gerencie artigos do blog com IA</p>
          </div>
          <div className="flex gap-2">
            {hasUnimportedLegacy && (
              <Button onClick={handleImportLegacy} variant="outline" className="gap-2" disabled={importing}>
                <Download className="h-4 w-4" />
                {importing ? "Importando..." : "Importar Legados"}
              </Button>
            )}
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Artigo
            </Button>
          </div>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Artigos ({posts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-slate-400 text-center py-8">Carregando...</p>
            ) : posts.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                Nenhum artigo criado ainda. Clique em "Novo Artigo" para começar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Título</TableHead>
                    <TableHead className="text-slate-300">Categoria</TableHead>
                    <TableHead className="text-slate-300">Data</TableHead>
                    <TableHead className="text-slate-300 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id} className="border-slate-700">
                      <TableCell className="text-white font-medium max-w-xs truncate">
                        {post.title}
                      </TableCell>
                      <TableCell>
                        {post.category && (
                          <Badge variant="secondary">{post.category}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {format(new Date(post.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => notifyUsers(post)}
                            disabled={notifying === post.slug}
                            className="text-orange-400 hover:text-orange-300"
                            title="Notificar usuários por email"
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(post)}
                            className="text-slate-300 hover:text-white"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(post.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <BlogPostFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        post={editingPost}
        onSave={handleSave}
        isSaving={createPost.isPending || updatePost.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O artigo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
