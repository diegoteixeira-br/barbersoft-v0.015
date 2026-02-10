import { ChevronLeft, ChevronRight, Plus, Calendar, Zap, RefreshCw, Tv, Maximize2, Minimize2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Barber } from "@/hooks/useBarbers";

export type CalendarViewType = "day" | "week" | "month";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarViewType;
  barbers: Barber[];
  selectedBarberId: string | null;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarViewType) => void;
  onBarberChange: (barberId: string | null) => void;
  onNewAppointment: () => void;
  onQuickService: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isCompactMode?: boolean;
  onToggleCompactMode?: () => void;
  showBusinessHoursOnly?: boolean;
  onToggleBusinessHours?: () => void;
}

export function CalendarHeader({
  currentDate,
  view,
  barbers,
  selectedBarberId,
  onDateChange,
  onViewChange,
  onBarberChange,
  onNewAppointment,
  onQuickService,
  onRefresh,
  isRefreshing,
  isCompactMode,
  onToggleCompactMode,
  showBusinessHoursOnly,
  onToggleBusinessHours,
}: CalendarHeaderProps) {
  const handleOpenDisplay = () => {
    window.open("/agenda/display", "_blank", "noopener,noreferrer");
  };
  const navigate = (direction: "prev" | "next") => {
    const isNext = direction === "next";
    switch (view) {
      case "day":
        onDateChange(isNext ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case "week":
        onDateChange(isNext ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case "month":
        onDateChange(isNext ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => onDateChange(new Date());

  const getDateRangeLabel = () => {
    switch (view) {
      case "day":
        return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
      case "week": {
        const weekStart = startOfWeek(currentDate, { locale: ptBR });
        const weekEnd = endOfWeek(currentDate, { locale: ptBR });
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${format(weekStart, "d", { locale: ptBR })} - ${format(weekEnd, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
        }
        return `${format(weekStart, "d 'de' MMM", { locale: ptBR })} - ${format(weekEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
      }
      case "month":
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border-b border-border bg-card/50">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => navigate("next")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={goToToday} className="hidden sm:flex">
          Hoje
        </Button>
        {onRefresh && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Atualizar agenda"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
        <h2 className="text-lg font-semibold capitalize ml-2">{getDateRangeLabel()}</h2>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={view} onValueChange={(v) => onViewChange(v as CalendarViewType)}>
          <SelectTrigger className="w-[120px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Dia</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedBarberId || "all"}
          onValueChange={(v) => onBarberChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos os barbeiros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os barbeiros</SelectItem>
            {barbers.filter(b => b.is_active).map((barber) => (
              <SelectItem key={barber.id} value={barber.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: barber.calendar_color || "#FF6B00" }}
                  />
                  {barber.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {view !== "month" && onToggleCompactMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onToggleCompactMode}>
                {isCompactMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isCompactMode ? "Modo normal (com scroll)" : "Modo compacto (caber na tela)"}
            </TooltipContent>
          </Tooltip>
        )}

        {view !== "month" && onToggleBusinessHours && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={showBusinessHoursOnly ? "default" : "outline"} 
                size="icon" 
                onClick={onToggleBusinessHours}
              >
                <Clock className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showBusinessHoursOnly ? "Mostrar todos os horários (7h-23h)" : "Somente horário comercial"}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleOpenDisplay}>
              <Tv className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Abrir em TV/Monitor</TooltipContent>
        </Tooltip>

        <Button variant="outline" onClick={onQuickService}>
          <Zap className="h-4 w-4 mr-2" />
          Atendimento Rápido
        </Button>

        <Button onClick={onNewAppointment} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>
    </div>
  );
}
