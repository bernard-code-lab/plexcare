import * as React from 'react'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const DEFAULT_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
]

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const inputClass =
  'border-white/10 bg-white/[0.03] text-cream placeholder:text-mute focus-visible:border-teal-300/50 focus-visible:ring-teal-400/20'

function CalendarScheduler({ timeSlots = DEFAULT_SLOTS, onConfirm, className }) {
  const [date, setDate] = React.useState(new Date())
  const [time, setTime] = React.useState()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const phoneDigits = phone.replace(/\D/g, '')
  const valid = !!date && !!time && name.trim().length > 1 && isEmail(email) && phoneDigits.length >= 10

  function reset() {
    setDate(undefined)
    setTime(undefined)
    setName('')
    setEmail('')
    setPhone('')
  }

  return (
    <Card className={cn('w-full border-none bg-transparent shadow-none', className)}>
      <CardHeader className="px-0">
        <CardTitle className="text-base text-cream">Escolha data e horário</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0 md:flex-row">
        {/* Calendar */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={date}
            onSelect={setDate}
            disabled={{ before: today }}
            className="rounded-md"
          />
        </div>

        {/* Time slots */}
        <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="mb-3 text-sm font-medium text-mute">Escolha um horário</p>
          <div className="grid grid-cols-3 gap-2">
            {timeSlots.map((slot) => (
              <Button
                key={slot}
                variant={time === slot ? 'default' : 'outline'}
                size="sm"
                className={cn('w-full tabular-nums', time === slot && 'ring-2 ring-primary')}
                onClick={() => setTime(slot)}
              >
                {slot}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Contact details */}
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="sch-name" className="text-xs font-medium text-mute">
            Nome
          </label>
          <Input
            id="sch-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como podemos te chamar?"
            className={inputClass}
            autoComplete="name"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="sch-email" className="text-xs font-medium text-mute">
              Email
            </label>
            <Input
              id="sch-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@clinica.com.br"
              className={inputClass}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sch-phone" className="text-xs font-medium text-mute">
              Celular / WhatsApp
            </label>
            <Input
              id="sch-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className={inputClass}
              autoComplete="tel"
            />
          </div>
        </div>
      </div>

      <CardFooter className="mt-2 flex justify-between px-0 pb-0">
        <Button variant="ghost" size="sm" onClick={reset}>
          Limpar
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm?.({ date, time, name: name.trim(), email: email.trim(), phone })}
          disabled={!valid}
        >
          Confirmar agendamento
        </Button>
      </CardFooter>
    </Card>
  )
}

export { CalendarScheduler }
