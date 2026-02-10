import { MoreVertical, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Product } from "@/hooks/useProducts";

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onAdjustStock: (product: Product) => void;
}

export function ProductsTable({ products, isLoading, onEdit, onDelete, onAdjustStock }: ProductsTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum produto cadastrado</p>
        <p className="text-sm text-muted-foreground">Clique em "Novo Produto" para começar</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Produto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Venda</TableHead>
            <TableHead className="text-center">Margem</TableHead>
            <TableHead className="text-center">Markup</TableHead>
            <TableHead className="text-center">Estoque</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const isLowStock = product.stock_quantity <= (product.min_stock_alert || 5);
            
            return (
              <TableRow key={product.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {product.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.sku || "-"}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(product.cost_price))}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(product.sale_price))}
                </TableCell>
                <TableCell className="text-center">
                  {Number(product.cost_price) > 0 && Number(product.sale_price) > 0 ? (() => {
                    const margin = ((Number(product.sale_price) - Number(product.cost_price)) / Number(product.sale_price)) * 100;
                    const color = margin >= 30 ? "bg-green-500/20 text-green-400 border-green-500/30" 
                      : margin >= 10 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" 
                      : "bg-red-500/20 text-red-400 border-red-500/30";
                    return <Badge className={color}>{margin.toFixed(1)}%</Badge>;
                  })() : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-center">
                  {Number(product.cost_price) > 0 && Number(product.sale_price) > 0 ? (() => {
                    const markup = ((Number(product.sale_price) - Number(product.cost_price)) / Number(product.cost_price)) * 100;
                    const color = markup >= 30 ? "bg-green-500/20 text-green-400 border-green-500/30" 
                      : markup >= 10 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" 
                      : "bg-red-500/20 text-red-400 border-red-500/30";
                    return <Badge className={color}>{markup.toFixed(1)}%</Badge>;
                  })() : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className={isLowStock ? "text-orange-500 font-semibold" : ""}>
                      {product.stock_quantity}
                    </span>
                    {isLowStock && (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {product.is_active ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onAdjustStock(product)}>
                        <Package className="mr-2 h-4 w-4" />
                        Ajustar Estoque
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(product)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(product.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
