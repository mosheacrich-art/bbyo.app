const MAP: [string, string][] = [
  ["already_registered", "Ya está inscrito en este evento."],
  ["event_not_found", "No encontramos ese evento."],
  ["event_not_open", "Las inscripciones de este evento no están abiertas."],
  ["event_past", "Este evento ya ha empezado."],
  ["not_allowed", "No tienes permiso para hacer esto."],
  ["not_eligible", "Esta persona no puede inscribirse en este evento."],
  ["guardian_required", "Necesitamos que un padre o tutor verificado lo autorice."],
  ["invite_invalid", "El código no es válido, ha caducado o ya se usó."],
  ["approval_required", "Los eventos con coste o pernocta los aprueba Staff o Regional Board."],
];
export function friendly(message: string | undefined) {
  if (!message) return "Algo ha fallado. Inténtalo de nuevo.";
  const hit = MAP.find(([k]) => message.includes(k));
  return hit ? hit[1] : "Algo ha fallado. Inténtalo de nuevo.";
}
