// Heurística simples de força de senha — sem libs externas.
// Critérios alinhados com OWASP ASVS L1 (12+ chars + variedade).

export function scorePassword(value) {
  if (!value) return { score: 0, label: 'vazio', hints: [] }
  const length = value.length
  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  const hasDigit = /\d/.test(value)
  const hasSymbol = /[^A-Za-z0-9]/.test(value)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

  let score = 0
  if (length >= 8) score++
  if (length >= 12) score++
  if (variety >= 2) score++
  if (variety >= 3) score++
  if (length >= 16 && variety === 4) score++
  score = Math.min(score, 4)

  const hints = []
  if (length < 12) hints.push('Use ao menos 12 caracteres')
  if (!hasUpper) hints.push('Adicione uma letra maiúscula')
  if (!hasDigit) hints.push('Adicione um número')
  if (!hasSymbol) hints.push('Adicione um símbolo (!@#$…)')

  const labels = ['muito fraca', 'fraca', 'razoável', 'forte', 'excelente']
  return { score, label: labels[score], hints }
}
