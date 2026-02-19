import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { InstitutionalLayout } from '@/layouts/InstitutionalLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, ArrowLeft, Share2, Facebook, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: dbPost, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts' as any)
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!slug,
  });

  // Fetch related posts from DB
  const { data: dbRelatedPosts = [] } = useQuery({
    queryKey: ['blog-related', dbPost?.category, dbPost?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts' as any)
        .select('*')
        .eq('category', dbPost.category)
        .neq('id', dbPost.id)
        .order('created_at', { ascending: false })
        .limit(2);
      return (data || []) as any[];
    },
    enabled: !!dbPost?.category && !!dbPost?.id,
  });

  if (isLoading) {
    return (
      <InstitutionalLayout breadcrumbs={[{ label: 'Blog', href: '/blog' }, { label: 'Carregando...' }]}>
        <div className="text-center py-12">Carregando...</div>
      </InstitutionalLayout>
    );
  }

  const post = dbPost
    ? {
        title: dbPost.title,
        excerpt: dbPost.excerpt || '',
        category: dbPost.category || '',
        image: dbPost.image_url || '/placeholder.svg',
        date: format(new Date(dbPost.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR }),
        readTime: dbPost.read_time || '5 min',
        author: dbPost.author || 'Equipe BarberSoft',
        content: dbPost.content || '',
        slug: dbPost.slug,
        isMarkdown: true,
        id: dbPost.id,
      }
    : null;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const relatedPosts = dbRelatedPosts.map((rp: any) => ({
    id: rp.id,
    slug: rp.slug,
    title: rp.title,
    category: rp.category || '',
    image: rp.image_url || '/placeholder.svg',
    date: format(new Date(rp.created_at), "dd MMM yyyy", { locale: ptBR }),
    readTime: rp.read_time || '5 min',
  }));

  const siteUrl = `https://barbersoft.com.br/blog/${post.slug}`;
  const edgeFunctionUrl = `https://lgrugpsyewvinlkgmeve.supabase.co/functions/v1/blog-share?slug=${post.slug}`;
  const shareText = encodeURIComponent(post.title);
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const encodedEdgeFunctionUrl = encodeURIComponent(edgeFunctionUrl);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.image,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'BarberSoft' },
    datePublished: post.date,
  };

  return (
    <InstitutionalLayout
      breadcrumbs={[
        { label: 'Blog', href: '/blog' },
        { label: post.title }
      ]}
    >
      <SEOHead
        title={post.title}
        description={post.excerpt}
        canonical={`/blog/${post.slug}`}
        ogImage={post.image}
        ogType="article"
        schema={schema}
      />

      <article className="max-w-4xl mx-auto">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Blog
        </Link>

        <header className="mb-8">
          <Badge variant="secondary" className="mb-4">{post.category}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
          <p className="text-xl text-muted-foreground mb-6">{post.excerpt}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{post.date}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{post.readTime} de leitura</span>
            <span>Por {post.author}</span>
          </div>
        </header>

        <div className="aspect-video rounded-xl overflow-hidden mb-8">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
        </div>

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        {/* Share Buttons */}
        <div className="border-t border-b py-6 mb-12">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Share2 className="h-4 w-4" />Compartilhar:
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedEdgeFunctionUrl}`} target="_blank" rel="noopener noreferrer">
                  <Facebook className="h-4 w-4 mr-2" />Facebook
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.instagram.com/`} target="_blank" rel="noopener noreferrer">
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  Instagram
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.tiktok.com/`} target="_blank" rel="noopener noreferrer">
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.16z"/></svg>
                  TikTok
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://api.whatsapp.com/send?text=${shareText}%20${encodedEdgeFunctionUrl}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>

        {relatedPosts.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Artigos Relacionados</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link key={relatedPost.id} to={`/blog/${relatedPost.slug}`}>
                  <Card className="group cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                      <img src={relatedPost.image} alt={relatedPost.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <CardHeader>
                      <Badge variant="secondary" className="w-fit mb-2">{relatedPost.category}</Badge>
                      <CardTitle className="group-hover:text-primary transition-colors line-clamp-2">{relatedPost.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{relatedPost.date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{relatedPost.readTime}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="text-center bg-muted p-8 rounded-xl mt-12">
          <h2 className="text-2xl font-bold mb-4">Pronto para transformar sua barbearia?</h2>
          <p className="text-muted-foreground mb-6">Experimente o BarberSoft gratuitamente e veja como podemos ajudar seu negócio a crescer.</p>
          <Button asChild size="lg"><Link to="/auth">Começar Grátis</Link></Button>
        </section>
      </article>
    </InstitutionalLayout>
  );
};

export default BlogPost;
