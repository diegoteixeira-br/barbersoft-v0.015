import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { InstitutionalLayout } from '@/layouts/InstitutionalLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, ArrowLeft, Share2, Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { blogPosts } from '@/data/blogPosts';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  // Try to find in static posts first
  const staticPost = blogPosts.find(p => p.slug === slug);

  // Also check DB
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
    enabled: !staticPost && !!slug,
  });

  if (isLoading && !staticPost) {
    return (
      <InstitutionalLayout breadcrumbs={[{ label: 'Blog', href: '/blog' }, { label: 'Carregando...' }]}>
        <div className="text-center py-12">Carregando...</div>
      </InstitutionalLayout>
    );
  }

  // Build a unified post object
  const post = staticPost
    ? {
        title: staticPost.title,
        excerpt: staticPost.excerpt,
        category: staticPost.category,
        image: staticPost.image,
        date: staticPost.date,
        readTime: staticPost.readTime,
        author: staticPost.author,
        content: staticPost.content,
        slug: staticPost.slug,
        isMarkdown: false,
        id: staticPost.id,
      }
    : dbPost
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

  // Related posts from static
  const relatedPosts = blogPosts
    .filter(p => p.category === post.category && String(p.id) !== String(post.id))
    .slice(0, 2);

  const shareUrl = `https://lgrugpsyewvinlkgmeve.supabase.co/functions/v1/blog-share?slug=${encodeURIComponent(post.slug)}`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const shareText = encodeURIComponent(post.title);

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
          {post.isMarkdown ? (
            <ReactMarkdown>{post.content}</ReactMarkdown>
          ) : (
            post.content.split('\n').map((paragraph: string, index: number) => {
              if (paragraph.startsWith('## ')) return <h2 key={index} className="text-2xl font-bold mt-8 mb-4">{paragraph.replace('## ', '')}</h2>;
              if (paragraph.startsWith('### ')) return <h3 key={index} className="text-xl font-semibold mt-6 mb-3">{paragraph.replace('### ', '')}</h3>;
              if (paragraph.startsWith('- ')) return <li key={index} className="ml-6 mb-2">{paragraph.replace('- ', '')}</li>;
              if (paragraph.startsWith('**') && paragraph.endsWith('**')) return <p key={index} className="font-bold mb-4">{paragraph.replace(/\*\*/g, '')}</p>;
              if (paragraph.startsWith('```')) return null;
              if (paragraph.trim()) return <p key={index} className="mb-4 text-muted-foreground leading-relaxed">{paragraph}</p>;
              return null;
            })
          )}
        </div>

        {/* Share Buttons */}
        <div className="border-t border-b py-6 mb-12">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Share2 className="h-4 w-4" />Compartilhar:
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noopener noreferrer">
                  <Facebook className="h-4 w-4 mr-2" />Facebook
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://twitter.com/intent/tweet?url=${encodedShareUrl}&text=${shareText}`} target="_blank" rel="noopener noreferrer">
                  <Twitter className="h-4 w-4 mr-2" />Twitter
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedShareUrl}&title=${shareText}`} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4 mr-2" />LinkedIn
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://api.whatsapp.com/send?text=${shareText}%20${encodedShareUrl}`} target="_blank" rel="noopener noreferrer">
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
