import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const PEOPLE = [
  { src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces', fb: 'AC' },
  { src: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces', fb: 'DR' },
  { src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces', fb: 'MF' },
  { src: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=faces', fb: 'JS' },
]

function Component() {
  return (
    <div className="flex items-center rounded-full border border-white/10 bg-ink-900 p-1 shadow shadow-black/40">
      <div className="flex -space-x-1.5">
        {PEOPLE.map((p, i) => (
          <Avatar key={i} className="h-5 w-5 ring-1 ring-ink-900">
            <AvatarImage src={p.src} alt={`Avatar ${i + 1}`} />
            <AvatarFallback className="text-[0.55rem]">{p.fb}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <p className="px-2 text-xs text-mute">
        Trusted by <strong className="font-medium text-cream">60K+</strong> developers.
      </p>
    </div>
  )
}

export { Component }
