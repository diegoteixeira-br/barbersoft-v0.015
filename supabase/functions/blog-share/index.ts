import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static blog posts fallback
const staticPosts = [
  {
    slug: 'dicas-aumentar-faturamento-barbearia',
    title: '10 Dicas para Aumentar o Faturamento da Sua Barbearia',
    excerpt: 'Descubra estratégias comprovadas para atrair mais clientes e aumentar o ticket médio do seu negócio.',
    image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&h=630&fit=crop',
  },
  {
    slug: 'ia-revolucionando-atendimento-barbearias',
    title: 'Como a IA Está Revolucionando o Atendimento em Barbearias',
    excerpt: 'Entenda como a inteligência artificial pode automatizar seu atendimento no WhatsApp e aumentar conversões.',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop',
  },
  {
    slug: 'marketing-digital-barbearias-guia-2025',
    title: 'Marketing Digital para Barbearias: Guia Completo 2025',
    excerpt: 'Aprenda a usar redes sociais, Google Meu Negócio e WhatsApp Marketing para atrair clientes.',
    image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&h=630&fit=crop',
  },
  {
    slug: 'tendencias-cortes-masculinos-2025',
    title: 'Tendências de Cortes Masculinos para 2025',
    excerpt: 'Os estilos que estarão em alta no próximo ano e como preparar sua equipe para atendê-los.',
    image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&h=630&fit=crop',
  },
  {
    slug: 'reduzir-faltas-cancelamentos-barbearia',
    title: 'Como Reduzir Faltas e Cancelamentos na Sua Barbearia',
    excerpt: 'Estratégias eficazes de confirmação automática e política de cancelamento que funcionam.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&h=630&fit=crop',
  },
  {
    slug: 'gestao-financeira-comissoes-despesas',
    title: 'Gestão Financeira: Controle de Comissões e Despesas',
    excerpt: 'Organize as finanças da sua barbearia e tenha clareza sobre lucros e despesas mensais.',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&h=630&fit=crop',
  },
];

const SITE_URL = 'https://barbersoft.com.br';
const SITE_NAME = 'BarberSoft';
const FALLBACK_IMAGE = `${SITE_URL}/og-social-final.png`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    console.log('Blog share request for slug:', slug);

    if (!slug) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': `${SITE_URL}/blog` },
      });
    }

    // 1. Try static posts first
    let post = staticPosts.find(p => p.slug === slug);

    // 2. If not found, query from database
    if (!post) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data } = await supabase
          .from("blog_posts")
          .select("slug, title, excerpt, image_url")
          .eq("slug", slug)
          .maybeSingle();

        if (data) {
          post = {
            slug: data.slug,
            title: data.title,
            excerpt: data.excerpt || '',
            image: data.image_url || FALLBACK_IMAGE,
          };
        }
      } catch (dbError) {
        console.error('DB lookup error:', dbError);
      }
    }

    if (!post) {
      console.log('Post not found, redirecting to blog');
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': `${SITE_URL}/blog` },
      });
    }

    const articleUrl = `${SITE_URL}/blog/${post.slug}`;
    const fullTitle = `${post.title} | ${SITE_NAME}`;
    const imageUrl = post.image || FALLBACK_IMAGE;

    console.log('Generating HTML for post:', post.title);
    console.log('Image URL:', imageUrl);

    const html = `<!DOCTYPE html>
<html lang="pt-BR" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${fullTitle}</title>
  <meta name="title" content="${fullTitle}">
  <meta name="description" content="${post.excerpt}">
  
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:title" content="${post.title}">
  <meta property="og:description" content="${post.excerpt}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:url" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${post.title}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="pt_BR">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${articleUrl}">
  <meta name="twitter:title" content="${post.title}">
  <meta name="twitter:description" content="${post.excerpt}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <meta http-equiv="refresh" content="0;url=${articleUrl}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a1a;
      color: #fff;
    }
    .loading { text-align: center; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #333;
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    a { color: #d4af37; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Redirecionando para o artigo...</p>
    <p><a href="${articleUrl}">Clique aqui se não for redirecionado</a></p>
  </div>
  <script>window.location.replace("${articleUrl}");</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error in blog-share function:', error);
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/blog` },
    });
  }
});
