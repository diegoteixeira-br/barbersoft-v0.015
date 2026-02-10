import { useMemo, useState, useRef, useLayoutEffect } from "react";
import { format, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "./CalendarEvent";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import type { Appointment } from "@/hooks/useAppointments";
import type { Barber } from "@/hooks/useBarbers";
import type { BusinessHour, Holiday } from "@/hooks/useBusinessHours";
import { Coffee } from "lucide-react";

interface TimeSlot {
  hour: number;
  minute: number;
  key: string;
}

interface CalendarDayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  barbers: Barber[];
  selectedBarberId: string | null;
  onAppointmentClick: (appointment: Appointment) => void;
  onSlotClick: (date: Date, barberId?: string) => void;
  openingTime?: string;
  closingTime?: string;
  timezone?: string;
  isCompactMode?: boolean;
  businessHours?: BusinessHour[];
  holidays?: Holiday[];
  isOpenOnDate?: (date: Date) => boolean;
  getOpeningHours?: (date: Date) => { opening: string; closing: string } | null;
  isHoliday?: (date: Date) => Holiday | undefined;
  showBusinessHoursOnly?: boolean;
}

const DEFAULT_SLOT_HEIGHT = 28;
const MIN_SLOT_HEIGHT = 20;
const HEADER_HEIGHT = 64;

function generateTimeSlots(startHour: number, endHour: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push({
        hour: h,
        minute: m,
        key: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      });
    }
  }
  return slots;
}

function slotKeyFromDate(date: Date): string {
  const h = date.getHours();
  const m = Math.floor(date.getMinutes() / 15) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function CalendarDayView({
  currentDate,
  appointments,
  barbers,
  selectedBarberId,
  onAppointmentClick,
  onSlotClick,
  openingTime,
  closingTime,
  timezone,
  isCompactMode = false,
  isOpenOnDate,
  getOpeningHours,
  isHoliday,
  showBusinessHoursOnly = false,
}: CalendarDayViewProps) {
  const activeBarbers = useMemo(
    () => barbers.filter(b => b.is_active && (!selectedBarberId || b.id === selectedBarberId)),
    [barbers, selectedBarberId]
  );

  const { hour: currentHour, minute: currentMinute, isToday } = useCurrentTime(timezone);
  const today = isToday(currentDate);
  const isClosed = isOpenOnDate ? !isOpenOnDate(currentDate) : false;
  const holiday = isHoliday ? isHoliday(currentDate) : undefined;

  const dayHours = getOpeningHours ? getOpeningHours(currentDate) : null;
  const openingHour = dayHours 
    ? parseInt(dayHours.opening.split(":")[0], 10) 
    : (openingTime ? parseInt(openingTime.split(":")[0], 10) : 7);
  const closingHour = dayHours 
    ? parseInt(dayHours.closing.split(":")[0], 10) 
    : (closingTime ? parseInt(closingTime.split(":")[0], 10) : 21);

  const TIME_SLOTS = useMemo(() => {
    if (showBusinessHoursOnly) {
      return generateTimeSlots(openingHour, closingHour);
    }
    return generateTimeSlots(7, 23);
  }, [showBusinessHoursOnly, openingHour, closingHour]);

  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const updateHeight = () => {
      if (containerRef.current) setContainerHeight(containerRef.current.clientHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const slotHeight = useMemo(() => {
    if (!isCompactMode) return DEFAULT_SLOT_HEIGHT;
    const effectiveHeight = containerHeight > 0 ? containerHeight : window.innerHeight - 220;
    const availableHeight = effectiveHeight - HEADER_HEIGHT;
    const calculatedHeight = Math.floor(availableHeight / TIME_SLOTS.length);
    return Math.max(MIN_SLOT_HEIGHT, calculatedHeight);
  }, [isCompactMode, containerHeight, TIME_SLOTS.length]);

  const appointmentsByBarberAndSlot = useMemo(() => {
    const map: Record<string, Record<string, Appointment[]>> = {};
    activeBarbers.forEach(barber => {
      map[barber.id] = {};
      TIME_SLOTS.forEach(slot => { map[barber.id][slot.key] = []; });
    });
    appointments.forEach(apt => {
      if (!apt.barber_id) return;
      const sk = slotKeyFromDate(new Date(apt.start_time));
      if (map[apt.barber_id] && map[apt.barber_id][sk]) {
        map[apt.barber_id][sk].push(apt);
      }
    });
    return map;
  }, [appointments, activeBarbers, TIME_SLOTS]);

  const firstSlot = TIME_SLOTS[0];
  const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];
  const firstSlotMinutes = firstSlot.hour * 60 + firstSlot.minute;
  const lastSlotMinutes = lastSlot.hour * 60 + lastSlot.minute + 15;
  const currentMinutes = currentHour * 60 + currentMinute;
  const showTimeIndicator = today && currentMinutes >= firstSlotMinutes && currentMinutes < lastSlotMinutes;
  const timeIndicatorPosition = ((currentMinutes - firstSlotMinutes) / 15) * slotHeight;

  const isWithinBusinessHours = (hour: number, minute: number) => {
    const slotMin = hour * 60 + minute;
    return slotMin >= openingHour * 60 && slotMin < closingHour * 60;
  };

  const isWithinLunchBreak = (barber: Barber, hour: number, minute: number) => {
    if (!barber.lunch_break_enabled || !barber.lunch_break_start || !barber.lunch_break_end) {
      return false;
    }
    
    const [startH, startM] = barber.lunch_break_start.split(":").map(Number);
    const [endH, endM] = barber.lunch_break_end.split(":").map(Number);
    const slotMin = hour * 60 + minute;
    const lunchStart = startH * 60 + (startM || 0);
    const lunchEnd = endH * 60 + (endM || 0);
    
    return slotMin >= lunchStart && slotMin < lunchEnd;
  };

  return (
    <div ref={containerRef} data-calendar-day-container className="h-full flex flex-col overflow-hidden">
      <div className={`min-w-[600px] ${activeBarbers.length > 3 ? "min-w-[900px]" : ""} h-full flex flex-col overflow-hidden`}>
        <div 
          className={`grid border-b border-border bg-card z-10 shrink-0 ${isClosed ? "bg-muted/50" : ""}`}
          style={{ gridTemplateColumns: `80px repeat(${activeBarbers.length}, 1fr)`, height: HEADER_HEIGHT }}
        >
          <div className="p-3 text-center border-r border-border flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground capitalize">{format(currentDate, "EEEE", { locale: ptBR })}</p>
            <p className={`text-2xl font-bold ${today ? "text-primary" : ""} ${isClosed ? "text-muted-foreground" : ""}`}>{format(currentDate, "d")}</p>
            {holiday && <p className="text-[10px] text-orange-600 dark:text-orange-400">{holiday.name}</p>}
            {isClosed && !holiday && <p className="text-[10px] text-muted-foreground">Fechado</p>}
          </div>
          {activeBarbers.map(barber => (
            <div key={barber.id} className="p-3 text-center border-r border-border last:border-r-0 flex items-center justify-center" style={{ borderTop: `3px solid ${barber.calendar_color || "#FF6B00"}` }}>
              <p className="font-semibold text-foreground">{barber.name}</p>
            </div>
          ))}
        </div>

        {isClosed ? (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="bg-muted/80 text-muted-foreground px-6 py-3 rounded-lg text-lg font-medium">
              {holiday ? `Fechado - ${holiday.name}` : "Fechado"}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
            <div className="grid relative" style={{ gridTemplateColumns: `80px repeat(${activeBarbers.length}, 1fr)` }}>
              {showTimeIndicator && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${timeIndicatorPosition}px` }}>
                  <div className="relative flex items-center">
                    <div className="absolute left-[68px] w-3 h-3 bg-red-500 rounded-full shadow-sm" />
                    <div className="ml-[80px] flex-1 h-0.5 bg-red-500" />
                  </div>
                </div>
              )}
              <div className="border-r border-border">
                {TIME_SLOTS.map(slot => {
                  const withinHours = isWithinBusinessHours(slot.hour, slot.minute);
                  const isHourBoundary = slot.minute === 0;
                  return (
                    <div 
                      key={slot.key} 
                      className={`${isHourBoundary ? "border-b border-border" : "border-b border-border/30"} flex items-start justify-end pr-2 pt-0.5 ${
                        withinHours ? "bg-blue-100/40 dark:bg-blue-900/20" : ""
                      } ${slot.minute === 0 ? "font-medium" : ""}`} 
                      style={{ height: slotHeight }}
                    >
                      <span className={`text-xs text-muted-foreground ${slot.minute !== 0 ? "text-muted-foreground/60" : ""}`}>
                        {slot.key}
                      </span>
                    </div>
                  );
                })}
              </div>
              {activeBarbers.map(barber => (
                <div key={barber.id} className="border-r border-border last:border-r-0">
                  {TIME_SLOTS.map(slot => {
                    const slotAppointments = appointmentsByBarberAndSlot[barber.id]?.[slot.key] || [];
                    const slotDate = setMinutes(setHours(currentDate, slot.hour), slot.minute);
                    const withinHours = isWithinBusinessHours(slot.hour, slot.minute);
                    const isLunchBreak = isWithinLunchBreak(barber, slot.hour, slot.minute);
                    const isHourBoundary = slot.minute === 0;
                    
                    return (
                      <div 
                        key={slot.key} 
                        className={`${isHourBoundary ? "border-b border-border" : "border-b border-border/30"} p-0.5 transition-colors ${
                          isLunchBreak 
                            ? "bg-orange-100/60 dark:bg-orange-900/20 cursor-not-allowed" 
                            : `cursor-pointer hover:bg-muted/30 ${
                                withinHours 
                                  ? "bg-blue-100/40 dark:bg-blue-900/20" 
                                  : ""
                              } ${today && withinHours ? "bg-blue-100/50 dark:bg-blue-900/30" : ""}`
                        }`}
                        style={{ height: slotHeight }} 
                        onClick={() => !isLunchBreak && onSlotClick(slotDate, barber.id)}
                      >
                        {isLunchBreak && slotAppointments.length === 0 && slot.minute === 0 ? (
                          <div className="h-full flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                            <Coffee className="h-3 w-3" />
                            <span className="text-[10px] font-medium">Intervalo</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5 overflow-hidden h-full">
                            {slotAppointments.map(apt => (
                              <CalendarEvent key={apt.id} appointment={apt} onClick={() => onAppointmentClick(apt)} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
