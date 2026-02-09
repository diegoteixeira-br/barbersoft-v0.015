import { InstitutionalLayout } from '@/layouts/InstitutionalLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Phone, MessageCircle, Clock, MapPin } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const RECAPTCHA_SITE_KEY = '6Le2q2EsAAAAALT1XXCEYyPsT3gfauLb_0JgYXs7';

// Window type is extended in useRecaptcha.ts

const Contato = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Load reCAPTCHA Enterprise script
  useEffect(() => {
    if (window.grecaptcha?.enterprise) {
      window.grecaptcha.enterprise.ready(() => setIsRecaptchaReady(true));
      return;
    }

    const existingScript = document.querySelector('script[src*="recaptcha/enterprise.js"]');
    if (existingScript) {
      const checkReady = setInterval(() => {
        if (window.grecaptcha?.enterprise) {
          window.grecaptcha.enterprise.ready(() => {
            setIsRecaptchaReady(true);
            clearInterval(checkReady);
          });
        }
      }, 100);
      return () => clearInterval(checkReady);
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      window.grecaptcha.enterprise.ready(() => {
        setIsRecaptchaReady(true);
      });
    };

    script.onerror = () => {
      console.error('Failed to load reCAPTCHA script');
      setIsRecaptchaReady(true);
    };

    document.head.appendChild(script);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formRef.current) return;
    
    setIsSubmitting(true);

    try {
      const formData = new FormData(formRef.current);
      const name = formData.get('name') as string;
      const phone = formData.get('phone') as string;
      const email = formData.get('email') as string;
      const subject = formData.get('subject') as string;
      const message = formData.get('message') as string;

      // Basic validation
      if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
        toast.error('Por favor, preencha todos os campos obrigatórios.');
        setIsSubmitting(false);
        return;
      }

      // Get reCAPTCHA token
      let recaptchaToken = '';
      
      if (window.grecaptcha?.enterprise) {
        try {
          recaptchaToken = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, {
            action: 'contact_form'
          });
        } catch (recaptchaError) {
          console.error('reCAPTCHA error:', recaptchaError);
          toast.error('Erro na verificação de segurança. Tente novamente.');
          setIsSubmitting(false);
          return;
        }
      } else {
        toast.error('Verificação de segurança não disponível. Recarregue a página.');
        setIsSubmitting(false);
        return;
      }

      // Send to edge function
      const { data, error } = await supabase.functions.invoke('contact-form', {
        body: {
          name: name.trim(),
          phone: phone?.trim() || '',
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          recaptchaToken
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error(error.message || 'Erro ao enviar mensagem. Tente novamente.');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(data?.message || 'Mensagem enviada com sucesso! Retornaremos em breve.');
      formRef.current.reset();

    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    mainEntity: {
      '@type': 'Organization',
      name: 'BarberSoft',
      email: 'contato@dtsolucoesdigital.com.br',
      telephone: '+55-65-99302-5105'
    }
  };

  return (
    <InstitutionalLayout breadcrumbs={[{ label: 'Contato' }]}>
      <SEOHead
        title="Contato"
        description="Entre em contato com a equipe BarberSoft. Atendimento via WhatsApp, e-mail e formulário. Estamos prontos para ajudar sua barbearia a crescer."
        canonical="/contato"
        schema={schema}
      />

      <article>
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Fale Conosco</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Estamos aqui para ajudar. Entre em contato e nossa equipe responderá o mais rápido possível.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <MessageCircle className="h-10 w-10 text-primary mx-auto mb-4" />
              <CardTitle className="mb-2">WhatsApp</CardTitle>
              <CardDescription className="mb-4">Atendimento rápido e direto</CardDescription>
              <Button variant="outline" className="w-full" asChild>
                <a href="https://wa.me/5565993025105" target="_blank" rel="noopener noreferrer">
                  (65) 99302-5105
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Mail className="h-10 w-10 text-primary mx-auto mb-4" />
              <CardTitle className="mb-2">E-mail</CardTitle>
              <CardDescription className="mb-4">Para dúvidas e parcerias</CardDescription>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:contato@dtsolucoesdigital.com.br">
                  contato@dtsolucoesdigital.com.br
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Clock className="h-10 w-10 text-primary mx-auto mb-4" />
              <CardTitle className="mb-2">Horário</CardTitle>
              <CardDescription className="mb-4">Atendimento humanizado</CardDescription>
              <p className="text-sm font-medium">Seg - Sex: 9h às 18h</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <Card>
            <CardHeader>
              <CardTitle>Envie uma mensagem</CardTitle>
              <CardDescription>
                Preencha o formulário abaixo que entraremos em contato.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" name="name" placeholder="Seu nome" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input id="subject" name="subject" placeholder="Como podemos ajudar?" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea 
                    id="message" 
                    name="message"
                    placeholder="Descreva sua dúvida ou solicitação..." 
                    rows={5}
                    required 
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting || !isRecaptchaReady}
                >
                  {isSubmitting ? 'Enviando...' : !isRecaptchaReady ? 'Carregando...' : 'Enviar Mensagem'}
                </Button>
                
                {/* reCAPTCHA legal text (required by Google) */}
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Este site é protegido pelo reCAPTCHA e a{' '}
                  <a 
                    href="https://policies.google.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Política de Privacidade
                  </a>{' '}
                  e{' '}
                  <a 
                    href="https://policies.google.com/terms" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Termos de Serviço
                  </a>{' '}
                  do Google se aplicam.
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Perguntas Frequentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1">Quanto tempo leva para receber resposta?</h4>
                  <p className="text-sm text-muted-foreground">
                    Respondemos em até 24 horas úteis. WhatsApp é mais rápido.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Vocês oferecem suporte por telefone?</h4>
                  <p className="text-sm text-muted-foreground">
                    Sim! Nosso time está disponível de segunda a sexta.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Como faço para cancelar minha assinatura?</h4>
                  <p className="text-sm text-muted-foreground">
                    Acesse Configurações no app ou entre em contato conosco.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <MapPin className="h-6 w-6 text-primary flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Endereço</h4>
                    <p className="text-sm text-muted-foreground">
                      Rua das Seriemas, 345 - Vila Mariana<br />
                      Cáceres - MT
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </article>
    </InstitutionalLayout>
  );
};

export default Contato;
