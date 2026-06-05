// Banner persistente no rodapé das telas de sala (waiting/live/feedback).
// Atende exigência de informar enquadramento legal — Res. CFM 2.314/2022 +
// LGPD — em todo contexto de teleconsulta. NÃO remover sem ADR de compliance.
export default function ComplianceBanner() {
  return (
    <footer
      data-testid="compliance-banner"
      className="border-t border-border bg-ink-900/80 px-4 py-2 text-center text-[11px] leading-snug text-mute backdrop-blur"
    >
      Teleconsulta sob a Resolução CFM 2.314/2022. Dados pessoais protegidos pela LGPD (Lei 13.709/2018).
      Em caso de gravação, o profissional notificará as partes antes do início.
    </footer>
  )
}
