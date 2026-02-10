import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useProducts, Product } from "@/hooks/useProducts";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  sku: z.string().optional(),
  cost_price: z.coerce.number().min(0, "Preço de custo deve ser maior ou igual a zero"),
  sale_price: z.coerce.number().positive("Preço de venda deve ser maior que zero"),
  stock_quantity: z.coerce.number().int().min(0, "Quantidade não pode ser negativa"),
  min_stock_alert: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductFormModal({ open, onOpenChange, product }: ProductFormModalProps) {
  const { createProduct, updateProduct } = useProducts();
  const isEditing = !!product;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      cost_price: 0,
      sale_price: 0,
      stock_quantity: 0,
      min_stock_alert: 5,
      is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || "",
        sku: product.sku || "",
        cost_price: Number(product.cost_price),
        sale_price: Number(product.sale_price),
        stock_quantity: product.stock_quantity,
        min_stock_alert: product.min_stock_alert || 5,
        is_active: product.is_active ?? true,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        sku: "",
        cost_price: 0,
        sale_price: 0,
        stock_quantity: 0,
        min_stock_alert: 5,
        is_active: true,
      });
    }
  }, [product, form]);

  const onSubmit = async (data: FormData) => {
    if (isEditing && product) {
      await updateProduct.mutateAsync({
        id: product.id,
        name: data.name,
        description: data.description,
        sku: data.sku,
        cost_price: data.cost_price,
        sale_price: data.sale_price,
        stock_quantity: data.stock_quantity,
        min_stock_alert: data.min_stock_alert,
        is_active: data.is_active,
      });
    } else {
      await createProduct.mutateAsync({
        name: data.name,
        description: data.description,
        sku: data.sku,
        cost_price: data.cost_price,
        sale_price: data.sale_price,
        stock_quantity: data.stock_quantity,
        min_stock_alert: data.min_stock_alert,
        is_active: data.is_active,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Gel Modelador" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código (SKU)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: GEL001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade em Estoque *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Custo (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Venda (R$) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {(() => {
              const costPrice = Number(form.watch("cost_price"));
              const salePrice = Number(form.watch("sale_price"));
              if (!costPrice || !salePrice) return null;
              const margin = ((salePrice - costPrice) / salePrice) * 100;
              const markup = ((salePrice - costPrice) / costPrice) * 100;
              const marginColor = margin >= 30 ? "text-green-400" : margin >= 10 ? "text-yellow-400" : "text-red-400";
              const markupColor = markup >= 30 ? "text-green-400" : markup >= 10 ? "text-yellow-400" : "text-red-400";
              return (
                <div className="flex flex-col gap-1">
                  <div className={`text-sm font-medium ${marginColor} flex items-center gap-1`}>
                    Margem: {margin.toFixed(1)}%
                    <span className="text-xs text-muted-foreground">(sobre venda)</span>
                    {margin < 0 && <span className="text-xs">(prejuízo)</span>}
                  </div>
                  <div className={`text-sm font-medium ${markupColor} flex items-center gap-1`}>
                    Markup: {markup.toFixed(1)}%
                    <span className="text-xs text-muted-foreground">(sobre custo)</span>
                  </div>
                </div>
              );
            })()}

            <FormField
              control={form.control}
              name="min_stock_alert"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alerta de Estoque Mínimo</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="5" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Receba alerta quando o estoque ficar abaixo deste valor
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do produto..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Produto Ativo</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Produtos inativos não aparecem para venda
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProduct.isPending || updateProduct.isPending}
              >
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
