import { useMemo, useState, useRef, useLayoutEffect } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, setHours, setMinutes, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "./CalendarEvent";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import type { Appointment } from "@/hooks/useAppointments";
import type { BusinessHour, Holiday } from "@/hooks/useBusinessHours";
import { Coffee } from "lucide-react";

interface Barber {
  id: string;
  name: string;
  calendar_color: string | null;
  is_active: boolean | null;
  lunch_break_enabled?: boolean;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
}

interface TimeSlot {
  hour: number;
  minute: number;
  key: string; // "HH:MM"
}

interface CalendarWeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onSlotClick: (date: Date, barberId?: string) => void;
  openingTime?: string;
  closingTime?: string;
  timezone?: string;
  isCompactMode?: boolean;
  barbers?: Barber[];
  selectedBarberId?: string | null;
  businessHours?: BusinessHour[];
  holidays?: Holiday[];
  isOpenOnDate?: (date: Date) => boolean;
  getOpeningHours?: (date: Date) => { opening: string; closing: string } | null;
  isHoliday?: (date: Date) => Holiday | undefined;
  showBusinessHoursOnly?: boolean;
}

const DEFAULT_SLOT_HEIGHT = 28;
const MIN_SLOT_HEIGHT = 20;
const HEADER_HEIGHT = 56;

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

export function CalendarWeekView({ 
  currentDate, 
  appointments, 
  onAppointmentClick, 
  onSlotClick,
  openingTime,
  closingTime,
  timezone,
  isCompactMode = false,
  barbers = [],
  selectedBarberId = null,
  businessHours = [],
  holidays = [],
  isOpenOnDate,
  getOpeningHours,
  isHoliday,
  showBusinessHoursOnly = false,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const { hour: currentHour, minute: currentMinute, isToday } = useCurrentTime(timezone);

  const showAllBarbers = selectedBarberId === null && barbers.length > 0;

  const fallbackOpeningHour = openingTime ? parseInt(openingTime.split(":")[0], 10) : 7;
  const fallbackClosingHour = closingTime ? parseInt(closingTime.split(":")[0], 10) : 21;

  const { minHour, maxHour } = useMemo(() => {
    let min = fallbackOpeningHour;
    let max = fallbackClosingHour;
    
    if (getOpeningHours) {
      days.forEach(day => {
        const hours = getOpeningHours(day);
        if (hours) {
          const dayOpen = parseInt(hours.opening.split(":")[0], 10);
          const dayClose = parseInt(hours.closing.split(":")[0], 10);
          min = Math.min(min, dayOpen);
          max = Math.max(max, dayClose);
        }
      });
    }
    
    return { minHour: min, maxHour: max };
  }, [days, getOpeningHours, fallbackOpeningHour, fallbackClosingHour]);

  const TIME_SLOTS = useMemo(() => {
    if (showBusinessHoursOnly) {
      return generateTimeSlots(minHour, maxHour);
    }
    return generateTimeSlots(7, 23);
  }, [showBusinessHoursOnly, minHour, maxHour]);

  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
      if (scrollContainerRef.current) {
        const width = scrollContainerRef.current.offsetWidth - scrollContainerRef.current.clientWidth;
        setScrollbarWidth(width);
      }
    };
    
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);

  const slotHeight = useMemo(() => {
    if (!isCompactMode) return DEFAULT_SLOT_HEIGHT;
    
    const effectiveHeight = containerHeight > 0 
      ? containerHeight 
      : window.innerHeight - 220;
    
    const availableHeight = effectiveHeight - HEADER_HEIGHT;
    const calculatedHeight = Math.floor(availableHeight / TIME_SLOTS.length);
    return Math.max(MIN_SLOT_HEIGHT, calculatedHeight);
  }, [isCompactMode, containerHeight, TIME_SLOTS.length]);

  const appointmentsByDayAndSlot = useMemo(() => {
    const map: Record<string, Record<string, Appointment[]>> = {};
    
    days.forEach(day => {
      const dayKey = format(day, "yyyy-MM-dd");
      map[dayKey] = {};
      TIME_SLOTS.forEach(slot => {
        map[dayKey][slot.key] = [];
      });
    });

    appointments.forEach(apt => {
      const aptDate = new Date(apt.start_time);
      const dayKey = format(aptDate, "yyyy-MM-dd");
      const sk = slotKeyFromDate(aptDate);
      
      if (map[dayKey] && map[dayKey][sk]) {
        map[dayKey][sk].push(apt);
      }
    });

    return map;
  }, [appointments, days, TIME_SLOTS]);

  const firstSlot = TIME_SLOTS[0];
  const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];
  const firstSlotMinutes = firstSlot.hour * 60 + firstSlot.minute;
  const lastSlotMinutes = lastSlot.hour * 60 + lastSlot.minute + 15;
  const currentMinutes = currentHour * 60 + currentMinute;
  const showTimeIndicator = currentMinutes >= firstSlotMinutes && currentMinutes < lastSlotMinutes;
  const timeIndicatorPosition = ((currentMinutes - firstSlotMinutes) / 15) * slotHeight;

  const isWithinBusinessHoursForDay = (day: Date, hour: number, minute: number) => {
    if (getOpeningHours) {
      const hours = getOpeningHours(day);
      if (hours) {
        const dayOpenParts = hours.opening.split(":");
        const dayCloseParts = hours.closing.split(":");
        const dayOpenMin = parseInt(dayOpenParts[0], 10) * 60 + parseInt(dayOpenParts[1] || "0", 10);
        const dayCloseMin = parseInt(dayCloseParts[0], 10) * 60 + parseInt(dayCloseParts[1] || "0", 10);
        const slotMin = hour * 60 + minute;
        return slotMin >= dayOpenMin && slotMin < dayCloseMin;
      }
    }
    const slotMin = hour * 60 + minute;
    return slotMin >= fallbackOpeningHour * 60 && slotMin < fallbackClosingHour * 60;
  };

  const isWithinLunchBreak = (hour: number, minute: number) => {
    if (!selectedBarberId) return false;
    
    const barber = barbers.find(b => b.id === selectedBarberId);
    if (!barber?.lunch_break_enabled || !barber.lunch_break_start || !barber.lunch_break_end) {
      return false;
    }
    
    const [startH, startM] = barber.lunch_break_start.split(":").map(Number);
    const [endH, endM] = barber.lunch_break_end.split(":").map(Number);
    const slotMin = hour * 60 + minute;
    const lunchStart = startH * 60 + (startM || 0);
    const lunchEnd = endH * 60 + (endM || 0);
    
    return slotMin >= lunchStart && slotMin < lunchEnd;
  };

  const selectedBarber = selectedBarberId ? barbers.find(b => b.id === selectedBarberId) : null;

  return (
    <div 
      ref={containerRef}
      data-calendar-container
      className="h-full flex flex-col overflow-hidden"
    >
      <div className="min-w-[800px] h-full flex flex-col overflow-hidden">
        {/* Header with days - FIXED */}
        <div 
          className="grid grid-cols-8 border-b border-border bg-card z-10 shrink-0" 
          style={{ height: HEADER_HEIGHT, paddingRight: scrollbarWidth }}
        >
          <div className="p-2 text-center text-xs text-muted-foreground border-r border-border flex items-center justify-center">
            Horário
          </div>
          {days.map(day => {
            const isClosed = isOpenOnDate ? !isOpenOnDate(day) : false;
            const holiday = isHoliday ? isHoliday(day) : undefined;
            
            return (
              <div
                key={day.toISOString()}
                className={`p-2 text-center border-r border-border last:border-r-0 flex flex-col items-center justify-center ${
                  isToday(day) ? "bg-primary/10" : ""
                } ${isClosed ? "bg-muted/50" : ""}`}
              >
                <p className="text-xs text-muted-foreground capitalize">
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p className={`text-lg font-semibold ${isToday(day) ? "text-primary" : ""} ${isClosed ? "text-muted-foreground" : ""}`}>
                  {format(day, "d")}
                </p>
                {holiday && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 truncate max-w-full">
                    {holiday.name}
                  </p>
                )}
                {isClosed && !holiday && (
                  <p className="text-[10px] text-muted-foreground">Fechado</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Time slots - SCROLLABLE */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-scroll overflow-x-hidden min-h-0 overscroll-contain">
          <div className="grid grid-cols-8 relative">
            {/* Time column */}
            <div className="border-r border-border">
              {TIME_SLOTS.map(slot => (
                <div
                  key={slot.key}
                  className={`border-b border-border text-xs text-muted-foreground text-right pr-2 flex items-start justify-end pt-0.5 ${
                    slot.minute === 0 ? "font-medium" : "text-muted-foreground/60"
                  }`}
                  style={{ height: slotHeight }}
                >
                  {slot.key}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const isDayToday = isToday(day);
              const isClosed = isOpenOnDate ? !isOpenOnDate(day) : false;
              
              return (
                <div key={day.toISOString()} className={`border-r border-border last:border-r-0 relative ${isClosed ? "bg-muted/30" : ""}`}>
                  {/* Current time indicator */}
                  {isDayToday && showTimeIndicator && !isClosed && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: `${timeIndicatorPosition}px` }}
                    >
                      <div className="relative flex items-center">
                        <div className="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full shadow-sm" />
                        <div className="w-full h-0.5 bg-red-500" />
                      </div>
                    </div>
                  )}
                  
                  {/* Closed overlay */}
                  {isClosed && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="bg-muted/80 text-muted-foreground px-3 py-1 rounded text-sm font-medium">
                        Fechado
                      </div>
                    </div>
                  )}
                  
                  {TIME_SLOTS.map(slot => {
                    const slotAppointments = appointmentsByDayAndSlot[dayKey]?.[slot.key] || [];
                    const slotDate = setMinutes(setHours(day, slot.hour), slot.minute);
                    const withinHours = isWithinBusinessHoursForDay(day, slot.hour, slot.minute);
                    const isLunchBreak = isWithinLunchBreak(slot.hour, slot.minute);
                    const isHourBoundary = slot.minute === 0;

                    return (
                      <div
                        key={slot.key}
                        className={`${isHourBoundary ? "border-b border-border" : "border-b border-border/30"} p-0.5 transition-colors ${
                          isClosed 
                            ? "bg-muted/40 cursor-not-allowed" 
                            : isLunchBreak
                              ? "bg-orange-100/60 dark:bg-orange-900/20 cursor-not-allowed"
                              : `cursor-pointer hover:bg-muted/30 ${
                                  withinHours 
                                    ? "bg-blue-100/40 dark:bg-blue-900/20" 
                                    : ""
                                } ${isDayToday && withinHours ? "bg-blue-100/50 dark:bg-blue-900/30" : ""}`
                        }`}
                        style={{ height: slotHeight }}
                        onClick={() => !isClosed && !isLunchBreak && onSlotClick(slotDate)}
                      >
                        {isLunchBreak && slotAppointments.length === 0 && !isClosed && slot.minute === 0 ? (
                          <div className="h-full flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                            <Coffee className="h-3 w-3" />
                            <span className="text-[10px] font-medium">Intervalo</span>
                          </div>
                        ) : (
                          <div className={`space-y-0.5 h-full ${
                            showAllBarbers && slotAppointments.length > 1 
                              ? "overflow-y-auto" 
                              : "overflow-hidden"
                          }`}>
                            {slotAppointments.map(apt => (
                              <CalendarEvent
                                key={apt.id}
                                appointment={apt}
                                onClick={() => onAppointmentClick(apt)}
                                ultraCompact={showAllBarbers}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
