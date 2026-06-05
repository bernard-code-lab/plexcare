export default function Divider({ children }) {
  return (
    <div className="relative my-6 flex items-center" role="separator" aria-orientation="horizontal">
      <span className="h-px flex-1 bg-border" />
      <span className="px-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-mute">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
