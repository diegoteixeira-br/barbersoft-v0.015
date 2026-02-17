import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, Scissors, Loader2, Clock, Check } from "lucide-react";
import { useServices, Service } from "@/hooks/useServices";
import { useCurrentUnit } from "@/contexts/UnitContext";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServiceFormModal } from "@/components/services/ServiceFormModal";
import { DeletionPasswordDialog } from "@/components/shared/DeletionPasswordDialog";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const EXAMPLE_SERVICES = [
  { name: "Corte Masculino", price: 45, duration_minutes: 30 },
  { name: "Barba", price: 30, duration_minutes: 20 },
  { name: "Corte + Barba", price: 65, duration_minutes: 45 },
  { name: "Corte Infantil", price: 35, duration_minutes: 25 },
  { name: "Sobrancelha", price: 15, duration_minutes: 10 },
  { name: "Pigmentação de Barba", price: 80, duration_minutes: 40 },
  { name: "Hidratação Capilar", price: 50, duration_minutes: 30 },
  { name: "Corte Degradê", price: 55, duration_minutes: 40 },
];

export default function Servicos() {
  const { currentUnitId, isLoading: unitLoading } = useCurrentUnit();
  const { services, isLoading, createService, updateService, deleteService } = useServices(currentUnitId);
  const { settings, verifyDeletionPassword } = useBusinessSettings();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedExamples, setSelectedExamples] = useState<Set<string>>(new Set());
  const [isSavingExamples, setIsSavingExamples] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const isDeletionPasswordActive = !!settings?.deletion_password_enabled && !!settings?.deletion_password_hash;

  const requirePassword = (action: () => void) => {
    if (isDeletionPasswordActive) {
      setPendingAction(() => action);
      setPasswordDialogOpen(true);
    } else {
      action();
    }
  };

  const handleOpenModal = (service?: Service) => {
    requirePassword(() => {
      setEditingService(service || null);
      setIsModalOpen(true);
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSubmit = (data: any) => {
    if (editingService) {
      updateService.mutate({ id: editingService.id, ...data }, {
        onSuccess: handleCloseModal
      });
    } else {
      createService.mutate(data, {
        onSuccess: handleCloseModal
      });
    }
  };

  const handleDelete = (id: string) => {
    requirePassword(() => {
      deleteService.mutate(id);
    });
  };

  const toggleExampleSelection = (name: string) => {
    setSelectedExamples(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const handleSaveSelectedExamples = async () => {
    if (selectedExamples.size === 0) return;
    
    setIsSavingExamples(true);
    const selectedServices = EXAMPLE_SERVICES.filter(s => selectedExamples.has(s.name));
    
    for (const example of selectedServices) {
      await new Promise<void>((resolve) => {
        createService.mutate({
          name: example.name,
          price: example.price,
          duration_minutes: example.duration_minutes,
          is_active: true,
        }, {
          onSettled: () => resolve()
        });
      });
    }
    
    setSelectedExamples(new Set());
    setIsSavingExamples(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (unitLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Serviços</h1>
            <p className="mt-1 text-muted-foreground">Cadastre cortes e defina preços</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : services.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <Scissors className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Comece com exemplos ou crie do zero</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecione os serviços que deseja adicionar
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EXAMPLE_SERVICES.map((example) => {
                const isSelected = selectedExamples.has(example.name);
                return (
                  <Card 
                    key={example.name}
                    className={cn(
                      "border-2 transition-colors cursor-pointer group",
                      isSelected 
                        ? "border-primary bg-primary/10" 
                        : "border-dashed hover:border-primary/50 hover:bg-accent/50"
                    )}
                    onClick={() => toggleExampleSelection(example.name)}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2 relative">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-primary/10 group-hover:bg-primary/20"
                      )}>
                        {isSelected ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Plus className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <h4 className="font-medium text-foreground">{example.name}</h4>
                      <p className="text-lg font-semibold text-primary">{formatPrice(example.price)}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{example.duration_minutes} min</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              {selectedExamples.size > 0 && (
                <Button 
                  onClick={handleSaveSelectedExamples} 
                  disabled={isSavingExamples}
                  className="gap-2"
                >
                  {isSavingExamples ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Salvar {selectedExamples.size} serviço{selectedExamples.size > 1 ? 's' : ''}
                </Button>
              )}
              <Button variant="outline" onClick={() => handleOpenModal()} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar serviço personalizado
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={handleOpenModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <ServiceFormModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        service={editingService}
        onSubmit={handleSubmit}
        isLoading={createService.isPending || updateService.isPending}
      />

      <DeletionPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onVerify={async (password) => {
          const valid = await verifyDeletionPassword(password);
          if (valid && pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
          return valid;
        }}
        title="Senha de Segurança"
        description="Digite a senha de segurança para editar ou excluir este serviço."
      />
    </DashboardLayout>
  );
}
