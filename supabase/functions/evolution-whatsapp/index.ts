import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_GLOBAL_KEY = Deno.env.get('EVOLUTION_GLOBAL_KEY');
const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_KEY || !N8N_WEBHOOK_URL) {
      console.error('Missing environment variables:', {
        hasEvolutionUrl: !!EVOLUTION_API_URL,
        hasGlobalKey: !!EVOLUTION_GLOBAL_KEY,
        hasWebhookUrl: !!N8N_WEBHOOK_URL,
      });
      throw new Error('Variáveis de ambiente não configuradas');
    }

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Usuário não autenticado');
    }

    const body = await req.json();
    const { action, unit_id, instance_name } = body;
    console.log(`Action: ${action}, Unit ID: ${unit_id}, User: ${user.id}`);

    // For unit-based operations, validate the unit belongs to the user
    if (!unit_id) {
      throw new Error('ID da unidade é obrigatório');
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('*')
      .eq('id', unit_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (unitError) {
      console.error('Unit error:', unitError);
      throw new Error('Erro ao buscar unidade');
    }

    if (!unit) {
      throw new Error('Unidade não encontrada ou sem permissão');
    }

    switch (action) {
      case 'create': {
        // CLEANUP: Find and delete ALL existing instances for this unit (prevents duplicates)
        const unitPrefix = `unit_${unit.id.substring(0, 8)}_`;
        console.log(`Looking for existing instances with prefix: ${unitPrefix}`);
        
        try {
          const allInstancesRes = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            method: 'GET',
            headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
          });
          
          if (allInstancesRes.ok) {
            const allInstances = await allInstancesRes.json();
            const matchingInstances = Array.isArray(allInstances) 
              ? allInstances.filter((inst: any) => {
                  const name = inst.instanceName || inst.instance?.instanceName || '';
                  return name.startsWith(unitPrefix);
                })
              : [];
            
            console.log(`Found ${matchingInstances.length} existing instances for this unit`);
            
            for (const inst of matchingInstances) {
              const oldName = inst.instanceName || inst.instance?.instanceName;
              if (oldName) {
                console.log(`Deleting old instance: ${oldName}`);
                try {
                  await fetch(`${EVOLUTION_API_URL}/instance/logout/${oldName}`, {
                    method: 'DELETE',
                    headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
                  });
                } catch (e) { /* non-critical */ }
                try {
                  await fetch(`${EVOLUTION_API_URL}/instance/delete/${oldName}`, {
                    method: 'DELETE',
                    headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
                  });
                } catch (e) { /* non-critical */ }
              }
            }
          }
        } catch (e) {
          console.log('Fetch all instances error (non-critical):', e);
        }

        // Also cleanup the specific instance stored in DB if it has a different prefix
        if (unit.evolution_instance_name && !unit.evolution_instance_name.startsWith(unitPrefix)) {
          console.log(`Cleaning up DB instance with different prefix: ${unit.evolution_instance_name}`);
          try {
            await fetch(`${EVOLUTION_API_URL}/instance/logout/${unit.evolution_instance_name}`, {
              method: 'DELETE',
              headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
            });
          } catch (e) { /* non-critical */ }
          try {
            await fetch(`${EVOLUTION_API_URL}/instance/delete/${unit.evolution_instance_name}`, {
              method: 'DELETE',
              headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
            });
          } catch (e) { /* non-critical */ }
        }

        // Generate unique instance name and token
        const timestamp = Date.now();
        const instanceName = `unit_${unit.id.substring(0, 8)}_${timestamp}`;
        const instanceToken = generateToken();

        console.log(`Creating instance for unit ${unit.id}: ${instanceName}`);

        // Create instance with webhook configuration (Evolution API v2 format)
        const createPayload = {
          instanceName,
          token: instanceToken,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          // Webhook para n8n (chat-barbearia)
          // MESSAGES_UPSERT: recebe todas as mensagens
          // O n8n verifica se a mensagem é "SAIR" e redireciona para receptor-barber/process-opt-out
          webhook: {
            url: N8N_WEBHOOK_URL,
            byEvents: false,
            base64: true,
            events: ["MESSAGES_UPSERT"]
          }
        };

        console.log('Create payload:', JSON.stringify(createPayload));

        const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_GLOBAL_KEY!,
          },
          body: JSON.stringify(createPayload),
        });

        const createData = await createResponse.json();
        console.log('Create response:', JSON.stringify(createData));

        if (!createResponse.ok) {
          throw new Error(createData.message || 'Erro ao criar instância');
        }

        // Save instance info to units table
        const { error: updateError } = await supabase
          .from('units')
          .update({
            evolution_instance_name: instanceName,
            evolution_api_key: instanceToken,
          })
          .eq('id', unit.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw new Error('Erro ao salvar dados da instância');
        }

        // Configure instance behavior settings automatically
        const settingsPayload = {
          rejectCall: true,
          msgCall: "Não recebemos ligações neste número, só por mensagem de texto ou áudio.",
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          readStatus: true,
          syncFullHistory: false
        };

        console.log('Setting instance behavior:', JSON.stringify(settingsPayload));

        try {
          const settingsResponse = await fetch(
            `${EVOLUTION_API_URL}/settings/set/${instanceName}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_GLOBAL_KEY!,
              },
              body: JSON.stringify(settingsPayload),
            }
          );

          const settingsData = await settingsResponse.json();
          console.log('Settings response:', JSON.stringify(settingsData));

          if (!settingsResponse.ok) {
            console.warn('Failed to set behavior settings:', settingsData.message || 'Unknown error');
          } else {
            console.log('Instance behavior configured successfully');
          }
        } catch (settingsError) {
          console.warn('Error setting behavior (non-critical):', settingsError);
        }

        // Get QR Code with retry mechanism - Evolution API may take time to generate
        let extractedQR = null;
        let pairingCode = null;
        const maxRetries = 10;
        const retryDelay = 1000; // 1 second

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`QR fetch attempt ${attempt}/${maxRetries}`);
          
          const qrResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_GLOBAL_KEY!,
            },
          });

          const qrData = await qrResponse.json();
          console.log(`QR response attempt ${attempt}:`, JSON.stringify(qrData).substring(0, 200));
          
          // Extract QR code from various possible response formats
          extractedQR = qrData.base64 || qrData.qrcode?.base64 || qrData.code;
          pairingCode = qrData.pairingCode;

          if (extractedQR) {
            console.log(`QR code obtained on attempt ${attempt}`);
            break;
          }

          // Wait before next attempt (unless last attempt)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }

        if (!extractedQR) {
          console.warn('QR code not available after retries, returning without QR');
        }

        return new Response(JSON.stringify({
          success: true,
          instanceName,
          qrCode: extractedQR,
          pairingCode,
          qrPending: !extractedQR, // Flag to indicate QR needs to be fetched later
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'status': {
        if (!unit.evolution_instance_name) {
          return new Response(JSON.stringify({
            success: true,
            state: 'disconnected',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Checking status for unit ${unit.id}: ${unit.evolution_instance_name}`);

        // Check for stale instances (created more than 5 minutes ago but still in connecting state)
        const instanceParts = unit.evolution_instance_name.split('_');
        const instanceTimestamp = instanceParts.length >= 3 ? parseInt(instanceParts[2]) : 0;
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const isStaleInstance = instanceTimestamp > 0 && instanceTimestamp < fiveMinutesAgo;

        const statusResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${unit.evolution_instance_name}`,
          {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_GLOBAL_KEY!,
            },
          }
        );

        const statusData = await statusResponse.json();
        console.log('Status response:', JSON.stringify(statusData));

        if (!statusResponse.ok) {
          // Instance might not exist anymore - clean up database
          if (statusResponse.status === 404) {
            console.log('Instance not found in Evolution API, cleaning up database...');
            await supabase
              .from('units')
              .update({
                evolution_instance_name: null,
                evolution_api_key: null,
              })
              .eq('id', unit.id);

            return new Response(JSON.stringify({
              success: true,
              state: 'disconnected',
              cleaned: true,
              message: 'Instância não encontrada, dados limpos'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw new Error(statusData.message || 'Erro ao verificar status');
        }

        const state = statusData.state || statusData.instance?.state || 'unknown';

        // Auto-cleanup: ONLY delete if instance is stale (>5 minutes old) AND in 'close' or 'connecting' state
        // The 'close' state can briefly appear during connection, so we need to check timestamp
        const shouldCleanup = isStaleInstance && (state === 'close' || state === 'connecting');
        
        if (shouldCleanup) {
          console.log(`Instance needs cleanup: state=${state}, isStale=${isStaleInstance}`);
          console.log('Stale instance detected, cleaning up...');
          
          // Delete instance from Evolution API
          try {
            await fetch(
              `${EVOLUTION_API_URL}/instance/delete/${unit.evolution_instance_name}`,
              {
                method: 'DELETE',
                headers: {
                  'apikey': EVOLUTION_GLOBAL_KEY!,
                },
              }
            );
            console.log('Stale instance deleted from Evolution API');
          } catch (e) {
            console.log('Delete stale instance error (non-critical):', e);
          }

          // Clear database including profile data
          await supabase
            .from('units')
            .update({
              evolution_instance_name: null,
              evolution_api_key: null,
              whatsapp_name: null,
              whatsapp_phone: null,
              whatsapp_picture_url: null,
            })
            .eq('id', unit.id);

          return new Response(JSON.stringify({
            success: true,
            state: 'disconnected',
            cleaned: true,
            message: 'Instância expirada foi removida automaticamente'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // For 'close' state on recent instances, just return the state without cleaning up
        // This allows the user to refresh the QR code or retry the connection
        if (state === 'close') {
          console.log('Instance is in close state but still recent, not cleaning up');
          return new Response(JSON.stringify({
            success: true,
            state: 'close',
            instanceName: unit.evolution_instance_name,
            message: 'Sessão encerrada. Escaneie o QR Code novamente para reconectar.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // If connected (state === 'open'), fetch profile information
        if (state === 'open') {
          let profileName = null;
          let profilePhone = null;
          let profilePicture = null;

          // Get the instance owner number first
          try {
            const ownerRes = await fetch(
              `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${unit.evolution_instance_name}`,
              {
                method: 'GET',
                headers: {
                  'apikey': EVOLUTION_GLOBAL_KEY!,
                },
              }
            );
            const ownerData = await ownerRes.json();
            console.log('Instance data:', JSON.stringify(ownerData));
            
            if (Array.isArray(ownerData) && ownerData.length > 0) {
              const instance = ownerData[0];
              // ownerJid contains the phone number in format "55XXXXXXXXXXX@s.whatsapp.net"
              profilePhone = instance.ownerJid?.replace('@s.whatsapp.net', '') || 
                             instance.owner?.replace('@s.whatsapp.net', '') || null;
              profileName = instance.profileName || null;
              profilePicture = instance.profilePicUrl || null;
            }
          } catch (e) {
            console.log('Fetch instance data error:', e);
          }

          // Save profile to database if we have data
          if (profileName || profilePhone || profilePicture) {
            console.log('Saving profile data:', { profileName, profilePhone, profilePicture });
            await supabase
              .from('units')
              .update({
                whatsapp_name: profileName,
                whatsapp_phone: profilePhone,
                whatsapp_picture_url: profilePicture,
              })
              .eq('id', unit.id);
          }

          return new Response(JSON.stringify({
            success: true,
            state: 'open',
            instanceName: unit.evolution_instance_name,
            profile: {
              name: profileName,
              phone: profilePhone,
              pictureUrl: profilePicture,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          state,
          instanceName: unit.evolution_instance_name,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        if (!unit.evolution_instance_name) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Nenhuma instância conectada',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Disconnecting unit ${unit.id}: ${unit.evolution_instance_name}`);

        // Logout from instance
        try {
          await fetch(
            `${EVOLUTION_API_URL}/instance/logout/${unit.evolution_instance_name}`,
            {
              method: 'DELETE',
              headers: {
                'apikey': EVOLUTION_GLOBAL_KEY!,
              },
            }
          );
        } catch (e) {
          console.log('Logout error (non-critical):', e);
        }

        // Delete instance
        try {
          await fetch(
            `${EVOLUTION_API_URL}/instance/delete/${unit.evolution_instance_name}`,
            {
              method: 'DELETE',
              headers: {
                'apikey': EVOLUTION_GLOBAL_KEY!,
              },
            }
          );
        } catch (e) {
          console.log('Delete error (non-critical):', e);
        }

        // Clear database including profile data
        const { error: updateError } = await supabase
          .from('units')
          .update({
            evolution_instance_name: null,
            evolution_api_key: null,
            whatsapp_name: null,
            whatsapp_phone: null,
            whatsapp_picture_url: null,
          })
          .eq('id', unit.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw new Error('Erro ao limpar dados');
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Desconectado com sucesso',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'refresh-qr': {
        if (!unit.evolution_instance_name) {
          throw new Error('Nenhuma instância encontrada');
        }

        console.log(`Refreshing QR for unit ${unit.id}: ${unit.evolution_instance_name}`);

        // First check current status - if already connected, no need for QR
        const statusCheckResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${unit.evolution_instance_name}`,
          {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_GLOBAL_KEY!,
            },
          }
        );

        const statusCheckData = await statusCheckResponse.json();
        console.log('Status check before refresh QR:', JSON.stringify(statusCheckData));

        const currentState = statusCheckData.state || statusCheckData.instance?.state || 'unknown';

        // If already connected, return success with connected state
        if (currentState === 'open') {
          console.log('Instance already connected, no QR needed');
          return new Response(JSON.stringify({
            success: true,
            alreadyConnected: true,
            state: 'open',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Try to get new QR code
        const qrResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connect/${unit.evolution_instance_name}`,
          {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_GLOBAL_KEY!,
            },
          }
        );

        const qrData = await qrResponse.json();
        console.log('Refresh QR response:', JSON.stringify(qrData).substring(0, 300));
        
        // Extract QR code from various possible response formats
        const extractedQR = qrData.base64 || qrData.qrcode?.base64 || qrData.code;

        // Even if API returns error, if it's because already connected, handle gracefully
        if (!qrResponse.ok) {
          // Check if failure is because already connected
          if (qrData.message?.includes('connected') || qrData.message?.includes('open')) {
            return new Response(JSON.stringify({
              success: true,
              alreadyConnected: true,
              state: 'open',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          console.error('QR refresh error:', qrData);
          throw new Error(qrData.message || 'Erro ao atualizar QR Code');
        }

        return new Response(JSON.stringify({
          success: true,
          qrCode: extractedQR,
          pairingCode: qrData.pairingCode,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'cleanup': {
        // Cleanup action: delete instance by name passed directly (used when modal closes)
        const instanceToDelete = instance_name || unit.evolution_instance_name;
        
        console.log(`Cleanup requested for unit ${unit.id}, instance: ${instanceToDelete}`);

        if (instanceToDelete) {
          // Delete from Evolution API
          try {
            await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceToDelete}`, {
              method: 'DELETE',
              headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
            });
          } catch (e) {
            console.log('Cleanup logout error (non-critical):', e);
          }
          try {
            await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceToDelete}`, {
              method: 'DELETE',
              headers: { 'apikey': EVOLUTION_GLOBAL_KEY! },
            });
            console.log(`Instance ${instanceToDelete} deleted from Evolution API`);
          } catch (e) {
            console.log('Cleanup delete error (non-critical):', e);
          }
        }

        // Clear database
        await supabase
          .from('units')
          .update({
            evolution_instance_name: null,
            evolution_api_key: null,
            whatsapp_name: null,
            whatsapp_phone: null,
            whatsapp_picture_url: null,
          })
          .eq('id', unit.id);

        return new Response(JSON.stringify({
          success: true,
          message: 'Instância removida com sucesso',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Ação inválida: ${action}`);
    }
  } catch (error) {
    console.error('Error in evolution-whatsapp:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
